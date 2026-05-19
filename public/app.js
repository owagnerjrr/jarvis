const statusEl = document.querySelector("#status");
const messagesEl = document.querySelector("#messages");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const memoryForm = document.querySelector("#memoryForm");
const memoryInput = document.querySelector("#memoryInput");
const memoryList = document.querySelector("#memoryList");
const refreshMemory = document.querySelector("#refreshMemory");
const modeSelect = document.querySelector("#modeSelect");
const voiceButton = document.querySelector("#voiceButton");
const speakToggle = document.querySelector("#speakToggle");
const voiceSelect = document.querySelector("#voiceSelect");

const welcome = "Ola. Eu sou o Jarvis. Posso usar o modo local privado ou o modo programador forte quando a chave OpenAI estiver configurada.";
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let availableVoices = [];

function addMessage(role, text) {
  const item = document.createElement("div");
  item.className = `message ${role}`;
  item.textContent = text;
  messagesEl.append(item);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Falha inesperada.");
  return payload;
}

function cleanSpokenText(text) {
  return text
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/```[\s\S]*?```/g, "codigo omitido na leitura")
    .replace(/[`*_#>~-]/g, "")
    .trim();
}

function pickVoice() {
  const selected = voiceSelect.value;
  if (selected) {
    return availableVoices.find((voice) => voice.name === selected) || null;
  }

  return availableVoices.find((voice) => voice.lang === "pt-BR")
    || availableVoices.find((voice) => voice.lang.startsWith("pt"))
    || availableVoices[0]
    || null;
}

function speak(text) {
  if (!speakToggle.checked || !("speechSynthesis" in window)) return;

  const spoken = cleanSpokenText(text);
  if (!spoken) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = "pt-BR";
  utterance.rate = 0.92;
  utterance.pitch = 0.82;
  utterance.volume = 1;

  const voice = pickVoice();
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

function loadVoices() {
  if (!("speechSynthesis" in window)) return;

  availableVoices = window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("pt"));

  voiceSelect.replaceChildren();

  const automatic = document.createElement("option");
  automatic.value = "";
  automatic.textContent = "Automatica pt-BR";
  voiceSelect.append(automatic);

  for (const voice of availableVoices) {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.append(option);
  }
}

async function sendMessage(message) {
  const text = message.trim();
  if (!text) return;

  addMessage("user", text);
  messageInput.value = "";
  sendButton.disabled = true;
  voiceButton.disabled = true;

  try {
    const response = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: text, mode: modeSelect.value })
    });
    const displayText = `[${response.provider} / ${response.model}]\n${response.answer}`;
    addMessage("assistant", displayText);
    speak(response.answer);
  } catch (error) {
    addMessage("error", error.message);
  } finally {
    sendButton.disabled = false;
    voiceButton.disabled = false;
    messageInput.focus();
    refreshStatus().catch(() => {});
  }
}

async function refreshStatus() {
  const status = await api("/api/status");
  const ready = status.ollama || status.openai;
  statusEl.classList.toggle("online", ready);
  statusEl.classList.toggle("offline", !ready);

  if (status.openai) {
    statusEl.querySelector("span:last-child").textContent = `programador: ${status.openaiModel}`;
    return;
  }

  statusEl.querySelector("span:last-child").textContent = status.ollama
    ? `local: ${status.model}`
    : "sem modelo ativo";
}

async function loadMemory() {
  const memory = await api("/api/memory");
  memoryList.replaceChildren();

  if (!memory.notes.length) {
    const empty = document.createElement("li");
    empty.textContent = "Nenhuma memoria salva ainda.";
    memoryList.append(empty);
    return;
  }

  for (const note of memory.notes) {
    const item = document.createElement("li");
    item.textContent = note;
    memoryList.append(item);
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendMessage(messageInput.value);
});

memoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const note = memoryInput.value.trim();
  if (!note) return;
  memoryInput.value = "";
  await api("/api/memory", {
    method: "POST",
    body: JSON.stringify({ note })
  });
  await loadMemory();
});

refreshMemory.addEventListener("click", () => {
  loadMemory().catch((error) => addMessage("error", error.message));
});

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.addEventListener("start", () => {
    isListening = true;
    voiceButton.classList.add("listening");
    voiceButton.textContent = "Ouvindo";
  });

  recognition.addEventListener("end", () => {
    isListening = false;
    voiceButton.classList.remove("listening");
    voiceButton.textContent = "Falar";
  });

  recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join(" ")
      .trim();
    if (transcript) sendMessage(transcript);
  });

  recognition.addEventListener("error", (event) => {
    addMessage("error", `Microfone indisponivel: ${event.error}`);
  });
} else {
  voiceButton.disabled = true;
  voiceButton.title = "Reconhecimento de voz nao suportado neste navegador.";
}

voiceButton.addEventListener("click", () => {
  if (!recognition) return;
  if (isListening) {
    recognition.stop();
    return;
  }
  recognition.start();
});

if ("speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
} else {
  speakToggle.checked = false;
  speakToggle.disabled = true;
  voiceSelect.disabled = true;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

addMessage("assistant", welcome);
refreshStatus().catch(() => {
  statusEl.classList.add("offline");
  statusEl.querySelector("span:last-child").textContent = "status indisponivel";
});
loadMemory().catch((error) => addMessage("error", error.message));
