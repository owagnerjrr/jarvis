# Jarvis Local

Jarvis e uma IA particular para rodar no seu computador e abrir tambem no celular pela mesma rede Wi-Fi.

## O que ele faz agora

- Interface web instalavel no celular.
- Chat privado usando um modelo local via Ollama.
- Modo hibrido com OpenAI API para programacao forte.
- Conversa por voz no navegador, com microfone e resposta falada em portugues.
- Memorias permanentes salvas em `data/jarvis-memory.json`.
- Tela de configuracao, diagnostico e ferramentas de programacao.
- Nenhuma chave de API ou nuvem por padrao; o modo OpenAI so liga se voce configurar `.env`.

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

## Rodar como aplicativo desktop

Para abrir o Jarvis em uma janela propria:

```powershell
npm run desktop
```

## Gerar o .exe

Depois de instalar as dependencias com `npm install`, rode:

```powershell
npm run dist
```

O executavel fica em:

```text
dist/win-unpacked/Jarvis.exe
```

Esse `.exe` deve ficar junto da pasta `win-unpacked`, porque ela contem os arquivos internos do Electron.

Esse build local nao e assinado digitalmente, entao o Windows pode mostrar um aviso do SmartScreen na primeira abertura.

Para tentar gerar instalador NSIS e versao portable:

```powershell
npm run dist:installer
```

No Windows, essa etapa pode exigir permissoes para criar links simbolicos. Se falhar, use o `dist/win-unpacked/Jarvis.exe`.

## Ativar o modo programador forte

1. Copie `.env.example` para `.env`.
2. Coloque sua chave da OpenAI em `OPENAI_API_KEY`.
3. Mantenha o modelo forte padrao:

```text
OPENAI_MODEL=gpt-5.5
OPENAI_REASONING=high
```

4. Rode o Jarvis de novo:

```powershell
npm start
```

Na tela, escolha:

- `Local privado`: usa Ollama no seu computador.
- `Programador forte`: usa OpenAI API.
- `Auto`: usa OpenAI se a chave existir; senao usa Ollama.

O arquivo `.env` fica fora do Git por seguranca.

## Conversar por voz

Na interface do Jarvis:

- Clique em `Falar` para ditar uma pergunta em portugues.
- Deixe `Responder em voz` ligado para ouvir a resposta.
- Escolha uma voz em `Voz`, quando o navegador oferecer opcoes em portugues.

O reconhecimento de voz usa os recursos do navegador. Em alguns celulares ou navegadores, pode ser necessario permitir o microfone ou usar Chrome/Edge.

No app desktop Electron, a resposta falada deve funcionar quando houver voz instalada no Windows. Se o botao `Falar` aparecer indisponivel, use a versao no Chrome/Edge para ditado por microfone enquanto adicionamos um motor de voz nativo.

A voz e configurada para soar como um assistente calmo, elegante e tecnologico em portugues do Brasil. Ela nao copia a voz original do Jarvis dos filmes, porque essa voz e uma identidade especifica, mas o tom pode ficar na mesma direcao de assistente premium.

Se `Usar voz neural OpenAI` estiver ligado na tela de configuracao, o Jarvis usa a API de voz da OpenAI para gerar MP3. Essa voz e sintetica e deve ser apresentada como voz gerada por IA.

## Configuracao e ferramentas

Na aba `Config`, defina:

- porta local;
- URL do Ollama;
- modelo local;
- chave/modelo OpenAI;
- pasta principal de projetos;
- pastas extras permitidas;
- modelo e voz de TTS.

Na aba `Projetos`, o Jarvis consegue:

- listar arquivos;
- ler arquivos;
- gravar arquivos dentro das pastas permitidas;
- rodar comandos permitidos: `npm`, `git` e `node`.

Comandos destrutivos nao entram nessa primeira lista. Antes de gravar arquivo ou rodar comando, a interface pede confirmacao.

No app desktop, configuracoes e memoria ficam na pasta segura do usuario do Windows, nao dentro do executavel.

## Diagnostico

Na aba `Diagnostico`, o Jarvis verifica:

- Ollama ligado;
- OpenAI configurada;
- voz neural configurada;
- pastas de projeto acessiveis;
- pasta de dados local;
- estado do microfone pela interface.

## APK para celular

O celular deve ficar vinculado ao computador de casa: o app Android abre a interface do Jarvis e conversa com o servidor local do PC pela rede Wi-Fi.

No computador de casa, rode o Jarvis com host liberado na rede:

```powershell
$env:HOST="0.0.0.0"; npm start
```

No celular, use o IP do PC, por exemplo:

```text
http://192.168.0.25:5185
```

O projeto esta preparado para adicionar Android com Capacitor. Se o Android SDK estiver instalado, use:

```powershell
npm run android:sync
npm run android:build
```

O APK debug esperado fica em:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Se o Gradle falhar baixando dependencias por certificado Java, abra o projeto `android/` no Android Studio uma vez ou ajuste o Java/SDK do Android Studio antes de rodar o build.

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

No modo local, o chat chama apenas o Ollama em `http://127.0.0.1:11434`. No modo programador forte, a pergunta e o contexto recente sao enviados para a OpenAI API. O historico e as memorias ficam na pasta local `data/`.

Se voce abrir o Jarvis fora da sua rede local, proteja o acesso antes. Esta primeira versao foi feita para uso domestico/local.
