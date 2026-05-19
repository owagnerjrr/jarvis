const statusEl = document.querySelector("#status");
const messagesEl = document.querySelector("#messages");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const memoryForm = document.querySelector("#memoryForm");
const memoryInput = document.querySelector("#memoryInput");
const memoryList = document.querySelector("#memoryList");
const refreshMemory = document.querySelector("#refreshMemory");

const welcome = "Ola. Eu sou o Jarvis. Quando o Ollama estiver rodando neste computador, eu respondo usando um modelo local.";

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

async function refreshStatus() {
  const status = await api("/api/status");
  statusEl.classList.toggle("online", status.ollama);
  statusEl.classList.toggle("offline", !status.ollama);
  statusEl.querySelector("span:last-child").textContent = status.ollama
    ? `online: ${status.model}`
    : "Ollama offline";
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
  const message = messageInput.value.trim();
  if (!message) return;

  addMessage("user", message);
  messageInput.value = "";
  sendButton.disabled = true;

  try {
    const response = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message })
    });
    addMessage("assistant", response.answer);
  } catch (error) {
    addMessage("error", error.message);
  } finally {
    sendButton.disabled = false;
    messageInput.focus();
    refreshStatus().catch(() => {});
  }
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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

addMessage("assistant", welcome);
refreshStatus().catch(() => {
  statusEl.classList.add("offline");
  statusEl.querySelector("span:last-child").textContent = "status indisponivel";
});
loadMemory().catch((error) => addMessage("error", error.message));
