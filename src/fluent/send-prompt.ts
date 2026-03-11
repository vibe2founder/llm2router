/**
 * Fluent Interface / Builder para enviar prompt e obter texto, JSON ou Stream.
 */

import { LLM_DEFAULTS } from '../constants/llm-defaults.js';
import { runLLM } from '../adapters/run-llm.js';
import type { UnifiedLLMParams, LLMMessage, LLMProviderSelection } from '../types/llm.types.js';

export type SendPromptOptions = Partial<Omit<UnifiedLLMParams, 'messages'>> & {
  model: string;
  provider?: LLMProviderSelection;
  apiKey?: string;
};

function buildParams(promptOrMessages: string | LLMMessage[], opts: SendPromptOptions): UnifiedLLMParams {
  const messages: LLMMessage[] =
    typeof promptOrMessages === 'string' ? [{ role: 'user', content: promptOrMessages }] : promptOrMessages;
  return {
    ...LLM_DEFAULTS,
    ...opts,
    messages,
    model: opts.model,
    provider: opts.provider ?? 'groq',
    apiKey: opts.apiKey,
  } as UnifiedLLMParams;
}

export interface PromptFluent {
  /** Retorna o texto puro da resposta. */
  getText(): Promise<string>;
  /** Retorna o corpo parseado como JSON. */
  getJSONResponse<T = unknown>(): Promise<T>;
  /** Retorna um AsyncGenerator para streaming de texto. */
  getStream(): Promise<AsyncGenerator<string>>;
}

function createFluent(params: UnifiedLLMParams): PromptFluent {
  return {
    async getText() {
      const r = await runLLM(params, "text");
      return r.text;
    },
    async getJSONResponse<T>() {
      const r = await runLLM(params, "json");
      return (r.json ?? {}) as T;
    },
    async getStream() {
      const r = await runLLM(params, "stream");
      if (!r.stream)
        throw new Error("Stream not available for this provider/configuration");
      return r.stream;
    },
  };
}

export function sendPrompt(
  prompt: string,
  options: SendPromptOptions,
): PromptFluent;
export function sendPrompt(
  messages: LLMMessage[],
  options: SendPromptOptions,
): PromptFluent;
export function sendPrompt(
  promptOrMessages: string | LLMMessage[],
  options: SendPromptOptions
): PromptFluent {
  const params = buildParams(promptOrMessages, options);
  return createFluent(params);
}
