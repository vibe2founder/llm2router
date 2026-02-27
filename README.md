# Polyglot LLM

Interface unificada e **Fluent** para **OpenAI**, Groq, OpenRouter, Claude (Anthropic) e Gemini.

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

API keys: `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (ou `apiKey` nas opções).

## Build

```bash
bun run build
```
