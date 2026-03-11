/**
 * one-llm-4-all: interface unificada e Fluent para OpenAI, Groq, OpenRouter, Claude e Gemini.
 *
 * @example
 * import { sendPrompt } from 'one-llm-4-all';
 * const txt = await sendPrompt('Olá', { model: 'llama-3.1-8b-instant', provider: 'groq' }).getText();
 * const json = await sendPrompt('Retorne {"ok":true}', { model: 'llama-3.1-8b-instant', provider: 'groq' }).getJSONResponse();
 */

export { sendPrompt } from './fluent/send-prompt.js';
export type { PromptFluent, SendPromptOptions } from './fluent/send-prompt.js';
export type {
  UnifiedLLMParams,
  LLMMessage,
  LLMMessageRole,
  LLMProvider,
  LLMProviderSelection,
  UnifiedLLMTextResult,
} from './types/llm.types.js';
export { LLM_DEFAULTS } from './constants/llm-defaults.js';
export type { LLMDefaults } from './constants/llm-defaults.js';
export { runLLM } from './adapters/run-llm.js';
