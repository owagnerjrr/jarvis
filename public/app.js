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
const tabButtons = document.querySelectorAll(".tab-button");
const panels = {
  chat: messagesEl,
  settings: document.querySelector("#settingsPanel"),
  tools: document.querySelector("#toolsPanel"),
  diagnostics: document.querySelector("#diagnosticsPanel")
};
const settingsForm = document.querySelector("#settingsForm");
const diagnosticsButton = document.querySelector("#diagnosticsButton");
const diagnosticsOutput = document.querySelector("#diagnosticsOutput");
const listFilesButton = document.querySelector("#listFilesButton");
const readFileButton = document.querySelector("#readFileButton");
const writeFileButton = document.querySelector("#writeFileButton");
const runCommandButton = document.querySelector("#runCommandButton");
const toolOutput = document.querySelector("#toolOutput");

const welcome = "Ola. Eu sou o Jarvis. Posso usar o modo local privado ou o modo programador forte quando a chave OpenAI estiver configurada.";
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let availableVoices = [];
let appConfig = {};

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

async function speakWithBestVoice(text) {
  if (!speakToggle.checked) return;

  const spoken = cleanSpokenText(text).slice(0, 4000);
  if (!spoken) return;

  if (appConfig.openaiTtsEnabled) {
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: spoken })
      });
      if (!response.ok) throw new Error("Voz neural indisponivel.");
      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
      return;
    } catch (error) {
      addMessage("error", `${error.message} Usando voz do navegador.`);
    }
  }

  speak(spoken);
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
    await speakWithBestVoice(response.answer);
  } catch (error) {
    addMessage("error", error.message);
  } finally {
    sendButton.disabled = false;
    voiceButton.disabled = false;
    messageInput.focus();
    refreshStatus().catch(() => {});
  }
}

function showTab(name) {
  for (const [panelName, panel] of Object.entries(panels)) {
    panel.classList.toggle("hidden", panelName !== name);
  }
  for (const button of tabButtons) {
    button.classList.toggle("active", button.dataset.tab === name);
  }
}

function setValue(id, value) {
  const element = document.querySelector(`#${id}`);
  if (!element) return;
  if (element.type === "checkbox") element.checked = Boolean(value);
  else element.value = value ?? "";
}

async function loadConfig() {
  appConfig = await api("/api/config");
  setValue("configPort", appConfig.port);
  setValue("configOllamaUrl", appConfig.ollamaUrl);
  setValue("configLocalModel", appConfig.localModel);
  setValue("configOpenaiModel", appConfig.openaiModel);
  setValue("configOpenaiReasoning", appConfig.openaiReasoning);
  setValue("configProjectsRoot", appConfig.projectsRoot);
  setValue("configAllowedDirs", (appConfig.allowedProjectDirs || []).join("\n"));
  setValue("configTtsEnabled", appConfig.openaiTtsEnabled);
  setValue("configTtsModel", appConfig.openaiTtsModel);
  setValue("configTtsVoice", appConfig.openaiTtsVoice);
}

async function saveSettings(event) {
  event.preventDefault();
  const openaiApiKey = document.querySelector("#configOpenaiApiKey").value.trim();
  const payload = {
    port: document.querySelector("#configPort").value,
    ollamaUrl: document.querySelector("#configOllamaUrl").value,
    localModel: document.querySelector("#configLocalModel").value,
    openaiModel: document.querySelector("#configOpenaiModel").value,
    openaiReasoning: document.querySelector("#configOpenaiReasoning").value,
    projectsRoot: document.querySelector("#configProjectsRoot").value,
    allowedProjectDirs: document.querySelector("#configAllowedDirs").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    openaiTtsEnabled: document.querySelector("#configTtsEnabled").checked,
    openaiTtsModel: document.querySelector("#configTtsModel").value,
    openaiTtsVoice: document.querySelector("#configTtsVoice").value
  };

  if (openaiApiKey) payload.openaiApiKey = openaiApiKey;

  appConfig = await api("/api/config", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  document.querySelector("#configOpenaiApiKey").value = "";
  addMessage("assistant", "Configuracao salva. Se voce alterou a porta, reinicie o Jarvis para aplicar.");
  refreshStatus().catch(() => {});
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

async function refreshDiagnostics() {
  const diagnostics = await api("/api/diagnostics");
  diagnosticsOutput.textContent = JSON.stringify(diagnostics, null, 2);
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

settingsForm.addEventListener("submit", (event) => {
  saveSettings(event).catch((error) => addMessage("error", error.message));
});

diagnosticsButton.addEventListener("click", () => {
  refreshDiagnostics().catch((error) => {
    diagnosticsOutput.textContent = error.message;
  });
});

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    showTab(button.dataset.tab);
    if (button.dataset.tab === "settings") loadConfig().catch((error) => addMessage("error", error.message));
    if (button.dataset.tab === "diagnostics") refreshDiagnostics().catch((error) => addMessage("error", error.message));
  });
}

listFilesButton.addEventListener("click", async () => {
  try {
    const result = await api("/api/tools/list", {
      method: "POST",
      body: JSON.stringify({ path: document.querySelector("#toolPath").value })
    });
    toolOutput.textContent = JSON.stringify(result.files, null, 2);
  } catch (error) {
    toolOutput.textContent = error.message;
  }
});

readFileButton.addEventListener("click", async () => {
  try {
    const result = await api("/api/tools/read", {
      method: "POST",
      body: JSON.stringify({ path: document.querySelector("#toolPath").value })
    });
    toolOutput.textContent = result.content;
    document.querySelector("#toolContent").value = result.content;
  } catch (error) {
    toolOutput.textContent = error.message;
  }
});

writeFileButton.addEventListener("click", async () => {
  if (!confirm("Gravar este arquivo dentro de uma pasta permitida?")) return;
  try {
    const result = await api("/api/tools/write", {
      method: "POST",
      body: JSON.stringify({
        path: document.querySelector("#toolPath").value,
        content: document.querySelector("#toolContent").value
      })
    });
    toolOutput.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    toolOutput.textContent = error.message;
  }
});

runCommandButton.addEventListener("click", async () => {
  if (!confirm("Rodar este comando dentro da pasta permitida?")) return;
  try {
    const result = await api("/api/tools/run", {
      method: "POST",
      body: JSON.stringify({
        cwd: document.querySelector("#toolPath").value,
        command: document.querySelector("#toolCommand").value,
        args: document.querySelector("#toolArgs").value.split(" ").filter(Boolean)
      })
    });
    toolOutput.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    toolOutput.textContent = error.message;
  }
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
showTab("chat");
loadConfig().catch((error) => addMessage("error", error.message));
refreshStatus().catch(() => {
  statusEl.classList.add("offline");
  statusEl.querySelector("span:last-child").textContent = "status indisponivel";
});
loadMemory().catch((error) => addMessage("error", error.message));
