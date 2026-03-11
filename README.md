# Polyglot LLM

Interface unificada e **Fluent** para **OpenAI**, Groq, OpenRouter, Claude (Anthropic), Gemini e **Ollama local**.

- [CHANGELOG](./CHANGELOG.md)

## Uso

```ts
import { sendPrompt } from 'one-llm-4-all';

// Texto
const txt = await sendPrompt('Explique LLMs em uma frase.', {
  model: 'llama-3.1-8b-instant',
  provider: 'groq',
  apiKey: process.env.GROQ_API_KEY,
}).getText();

// JSON (response_format json_object no provider)
const obj = await sendPrompt('Retorne apenas um JSON: { "ok": true }', {
  model: 'llama-3.1-8b-instant',
  provider: 'groq',
  apiKey: process.env.GROQ_API_KEY,
}).getJSONResponse();
```

## Interface unificada

`UnifiedLLMParams`: propriedades que valem para qualquer LLM.

| Obrigatórias | Opcionais (com default) |
|--------------|-------------------------|
| `messages` (string ou `LLMMessage[]`) | `max_tokens` = 1024 |
| `model` | `temperature` = 0.7 |
| | `top_p` = 1 |
| | `stream` = false |
| | `stop`, `system`, `response_format`, `seed` |
| | `provider`, `apiKey` |

## Padrão encadeável

`sendPrompt(...).getText()` e `.getJSONResponse()` usam:

- **Fluent Interface** (API fluente): métodos que retornam o “próximo passo” para encadear.
- **Builder Pattern**: montagem em etapas; `.getText()` e `.getJSONResponse()` são os métodos que executam a requisição.

## Provedores

- `openai` (**OpenAI**)
- `groq` (Groq)
- `openrouter` (OpenRouter)
- `anthropic` (Claude)
- `gemini` (Google Gemini)
- `ollama` (local em `http://127.0.0.1:11434/v1`)
- `auto` (seleciona `ollama` quando não há internet, senão `groq`)

API keys: `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` (ou `apiKey` nas opções). Para `ollama`, API key é opcional.


## CI/CD

- **CI (`.github/workflows/ci.yml`)**: executa build e testes automaticamente em todo PR e em pushes para `main/master`.
- **Release (`.github/workflows/release.yml`)**: publica no npm em tags semânticas (`v*.*.*`) ou via disparo manual (`workflow_dispatch`).

### Como publicar

1. Configure o secret do repositório: `NPM_TOKEN`.
2. Gere e envie uma tag de versão, por exemplo:

```bash
git tag v1.0.1
git push origin v1.0.1
```

A pipeline de release fará build, validação de pacote (`npm pack --dry-run`) e `npm publish`.

## Build

```bash
bun run build
```
