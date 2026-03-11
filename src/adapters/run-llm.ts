/**
 * Adaptador unificado que utiliza as implementações nativas em /packages.
 * Suporta modo texto, JSON e Streaming.
 */

import { OpenAIClient } from "../../packages/openai/index.js";
import { AnthropicClient } from "../../packages/anthropic/index.js";
import { GoogleGenAIClient } from "../../packages/google-genai/index.js";
import { LLM_DEFAULTS } from '../constants/llm-defaults.js';
import { parseSSE, parseAnthropicStream } from "../utils/stream-parser.js";
import type {
  UnifiedLLMParams,
  UnifiedLLMTextResult,
  LLMMessage,
  LLMProvider,
  LLMProviderSelection,
} from '../types/llm.types.js';

function toMessages(m: UnifiedLLMParams['messages']): LLMMessage[] {
  if (typeof m === 'string') return [{ role: 'user', content: m }];
  return m as LLMMessage[];
}

const ENV_KEYS: Record<LLMProvider, string> = {
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  mistral: "MISTRAL_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  ollama: "OLLAMA_API_KEY",
};

function getApiKey(provider: LLMProvider, apiKey?: string): string | undefined {
  if (provider === "ollama") return apiKey ?? process.env.OLLAMA_API_KEY;

  const k = apiKey ?? process.env[ENV_KEYS[provider]];
  if (!k) throw new Error(`Missing API key for ${provider}. Set apiKey or ${ENV_KEYS[provider]}.`);
  return k;
}

async function hasInternetConnection(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch("https://www.google.com/generate_204", {
      method: "HEAD",
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveProvider(provider: LLMProviderSelection): Promise<LLMProvider> {
  if (provider !== "auto") return provider;

  const online = await hasInternetConnection();
  if (!online) return "ollama";

  return "groq";
}

export async function runLLM(
  params: UnifiedLLMParams,
  output: "text" | "json" | "stream",
): Promise<
  UnifiedLLMTextResult & { json?: unknown; stream?: AsyncGenerator<string> }
> {
  const messages = toMessages(params.messages);
  const requestedProvider = (params.provider ?? "groq") as LLMProviderSelection;
  const provider = await resolveProvider(requestedProvider);
  const apiKey = getApiKey(provider, params.apiKey as string);
  const D = LLM_DEFAULTS;

  // OpenAI Compatible Providers
  if (
    [
      "openai",
      "groq",
      "openrouter",
      "deepseek",
      "mistral",
      "perplexity",
      "ollama",
    ].includes(provider)
  ) {
    const baseURLs: Partial<Record<LLMProvider, string>> = {
      openai: "https://api.openai.com/v1",
      groq: "https://api.groq.com/openai/v1",
      openrouter: "https://openrouter.ai/api/v1",
      deepseek: "https://api.deepseek.com",
      mistral: "https://api.mistral.ai/v1",
      perplexity: "https://api.perplexity.ai",
      ollama: "http://127.0.0.1:11434/v1",
    };

    const client = new OpenAIClient({
      apiKey,
      baseURL: params.baseURL ?? baseURLs[provider],
    });

    const body = {
      model: params.model,
      messages: messages.map((x) => ({
        role: x.role,
        content: x.content as string,
      })),
      max_tokens: params.max_tokens ?? D.max_tokens,
      temperature: params.temperature ?? D.temperature,
      top_p: params.top_p ?? D.top_p,
      stop: params.stop,
      response_format:
        output === "json" ? { type: "json_object" as const } : undefined,
      stream: output === "stream",
    };

    const res = await client.createChatCompletion(body);

    if (output === "stream") {
      return { text: "", stream: parseSSE(res as ReadableStream) };
    }

    const text = res.choices?.[0]?.message?.content ?? "";
    const out: UnifiedLLMTextResult & { json?: unknown } = {
      text,
      usage: res.usage,
      model: res.model,
      finish_reason: res.choices?.[0]?.finish_reason,
    };

    if (output === "json") {
      try {
        out.json = JSON.parse(text);
      } catch {
        out.json = { raw: text };
      }
    }
    return out;
  }

  if (provider === "anthropic") {
    const client = new AnthropicClient({ apiKey: apiKey as string });
    const max = params.max_tokens ?? D.max_tokens ?? 1024;
    const sys =
      params.system ??
      (messages.find((x) => x.role === "system")?.content as
        | string
        | undefined);

    const body = {
      model: params.model,
      max_tokens: max,
      messages: messages
        .filter((x) => x.role !== "system")
        .map((x) => ({
          role: x.role as "user" | "assistant",
          content: x.content as string,
        })),
      system: sys,
      temperature: params.temperature ?? D.temperature,
      stop_sequences: Array.isArray(params.stop)
        ? params.stop
        : params.stop
          ? [params.stop]
          : undefined,
      stream: output === "stream",
    };

    const res = await client.createMessage(body);

    if (output === "stream") {
      return { text: "", stream: parseAnthropicStream(res as ReadableStream) };
    }

    const text = res.content?.find((c: any) => c.type === "text")?.text ?? "";
    const usage = res.usage;

    const out: UnifiedLLMTextResult & { json?: unknown } = {
      text,
      usage: usage
        ? {
            prompt_tokens: usage.input_tokens,
            completion_tokens: usage.output_tokens,
            total_tokens:
              (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          }
        : undefined,
      model: res.model,
      finish_reason: res.stop_reason ?? undefined,
    };

    if (output === "json") {
      try {
        out.json = JSON.parse(text);
      } catch {
        out.json = { raw: text };
      }
    }
    return out;
  }

  if (provider === "gemini") {
    const client = new GoogleGenAIClient({ apiKey: apiKey as string });

    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content as string }],
      }));

    const body = {
      model: params.model,
      contents,
      generationConfig: {
        temperature: params.temperature ?? D.temperature,
        topP: params.top_p ?? D.top_p,
        maxOutputTokens: params.max_tokens ?? D.max_tokens,
        stopSequences: Array.isArray(params.stop)
          ? params.stop
          : params.stop
            ? [params.stop]
            : undefined,
        responseMimeType: output === "json" ? "application/json" : undefined,
      },
      systemInstruction:
        params.system || messages.find((m) => m.role === "system")
          ? {
              parts: [
                {
                  text: (params.system ??
                    messages.find((m) => m.role === "system")
                      ?.content) as string,
                },
              ],
            }
          : undefined,
    };

    if (output === "stream") {
      throw new Error(
        "Streaming not yet implemented for Gemini in this native adapter",
      );
    }

    const res = await client.generateContent(body);
    const text = res.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const um = res.usageMetadata;

    const out: UnifiedLLMTextResult & { json?: unknown } = {
      text,
      usage: um
        ? {
            prompt_tokens: um.promptTokenCount,
            completion_tokens: um.candidatesTokenCount,
            total_tokens:
              (um.promptTokenCount ?? 0) + (um.candidatesTokenCount ?? 0),
          }
        : undefined,
      model: params.model,
    };

    if (output === "json") {
      try {
        out.json = JSON.parse(text);
      } catch {
        out.json = { raw: text };
      }
    }
    return out;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
