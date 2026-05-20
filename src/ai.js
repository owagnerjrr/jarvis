export function buildSystemPrompt(memory) {
  const notes = memory.notes.length
    ? memory.notes.map((note, index) => `${index + 1}. ${note}`).join("\n")
    : "Nenhuma nota permanente registrada ainda.";

  return [
    "Voce e Jarvis, uma IA particular, discreta, util e direta.",
    "Responda em portugues do Brasil, a menos que o usuario peca outro idioma.",
    "Priorize privacidade: nao sugira servicos em nuvem quando uma alternativa local for razoavel.",
    "Quando estiver em modo programador, aja como um engenheiro senior: leia o problema, proponha passos claros, escreva codigo completo quando fizer sentido, explique tradeoffs e destaque riscos de seguranca.",
    "Nao invente APIs, arquivos ou resultados de testes. Se algo depender do ambiente do usuario, diga isso claramente.",
    "Se faltar informacao, faca uma pergunta curta ou assuma de forma conservadora.",
    "Memorias permanentes do usuario:",
    notes
  ].join("\n");
}

function buildTranscript(messages) {
  return messages
    .map((message) => `${message.role === "assistant" ? "Jarvis" : "Usuario"}: ${message.content}`)
    .join("\n\n");
}

export async function askOllama(messages, memory, config) {
  const response = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: config.localModel,
      stream: false,
      messages: [
        { role: "system", content: buildSystemPrompt(memory) },
        ...messages
      ],
      options: { temperature: 0.6 }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Ollama respondeu ${response.status}: ${details}`);
  }

  const payload = await response.json();
  return payload.message?.content || "Nao recebi resposta do modelo local.";
}

export async function askOpenAI(messages, memory, config) {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY nao configurada. Configure nas opcoes do Jarvis ou no arquivo .env.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.openaiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiModel,
      instructions: buildSystemPrompt(memory),
      input: buildTranscript(messages),
      reasoning: { effort: config.openaiReasoning },
      max_output_tokens: 6000
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI respondeu ${response.status}: ${details}`);
  }

  const payload = await response.json();
  if (payload.output_text) return payload.output_text;

  const text = (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" || item.text)
    .map((item) => item.text)
    .join("\n")
    .trim();

  return text || "Nao recebi resposta do modelo OpenAI.";
}

export async function askJarvis(mode, messages, memory, config) {
  if (mode === "programmer") {
    return {
      provider: "openai",
      model: config.openaiModel,
      answer: await askOpenAI(messages, memory, config)
    };
  }

  if (mode === "auto" && config.openaiApiKey) {
    return {
      provider: "openai",
      model: config.openaiModel,
      answer: await askOpenAI(messages, memory, config)
    };
  }

  return {
    provider: "ollama",
    model: config.localModel,
    answer: await askOllama(messages, memory, config)
  };
}

export async function synthesizeSpeech(text, config) {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY nao configurada para voz neural.");
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.openaiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiTtsModel,
      voice: config.openaiTtsVoice,
      input: text,
      instructions: "Fale em portugues do Brasil como um assistente elegante, calmo, claro e tecnologico. A voz deve soar sintetica e original, sem imitar pessoas ou personagens existentes.",
      response_format: "mp3"
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI TTS respondeu ${response.status}: ${details}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
