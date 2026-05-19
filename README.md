# Jarvis Local

Jarvis e uma IA particular para rodar no seu computador e abrir tambem no celular pela mesma rede Wi-Fi.

## O que ele faz agora

- Interface web instalavel no celular.
- Chat privado usando um modelo local via Ollama.
- Memorias permanentes salvas em `data/jarvis-memory.json`.
- Nenhuma chave de API ou nuvem por padrao.

## Instalar o modelo local

1. Instale o Ollama: <https://ollama.com/download>
2. Baixe um modelo:

```powershell
ollama pull llama3.1:8b
```

Para computadores mais fracos, teste:

```powershell
ollama pull llama3.2:3b
```

Depois rode o Jarvis com outro modelo assim:

```powershell
$env:JARVIS_MODEL="llama3.2:3b"; npm start
```

## Rodar no computador

```powershell
npm start
```

Abra:

```text
http://127.0.0.1:5173
```

Se a porta `5173` ja estiver ocupada:

```powershell
$env:PORT="5185"; npm start
```

Abra:

```text
http://127.0.0.1:5185
```

## Abrir no celular

1. Deixe o computador e o celular na mesma rede Wi-Fi.
2. Descubra o IP do computador:

```powershell
ipconfig
```

3. No celular, abra:

```text
http://IP-DO-SEU-COMPUTADOR:5173
```

Exemplo:

```text
http://192.168.0.25:5173
```

No Android ou iPhone, use a opcao do navegador para adicionar a tela inicial.

## Privacidade

O chat chama apenas o Ollama em `http://127.0.0.1:11434`. O historico e as memorias ficam na pasta local `data/`.

Se voce abrir o Jarvis fora da sua rede local, proteja o acesso antes. Esta primeira versao foi feita para uso domestico/local.
