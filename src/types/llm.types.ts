/**
 * Tipos unificados para qualquer provedor de LLM com Tipagem Semântica Nominal.
 */

export type Brand<K, T> = K & { __brand: T };

export type ApiKey = Brand<string, "ApiKey">;
export type ModelId = Brand<string, "ModelId">;
export type PromptContent = Brand<string, "PromptContent">;

/** Role de mensagem suportada em todos os LLMs (formato conversacional). */
export type LLMMessageRole = 'system' | 'user' | 'assistant';

/** Uma mensagem no formato unificado. */
export interface LLMMessage {
  role: LLMMessageRole;
  content: string | PromptContent;
}

/** Provedores suportados atualmente e novos adicionados. */
export type LLMProvider = 
  | 'groq' 
  | 'openrouter' 
  | 'anthropic' 
  | 'gemini' 
  | 'openai' 
  | 'ollama'
  | 'deepseek' 
  | 'mistral' 
  | 'perplexity';

/**
 * Interface unificada para parâmetros de LLM.
 */
export interface UnifiedLLMParams {
  /** Conteúdo do prompt (string) ou lista de mensagens para multi-turn. */
  messages: LLMMessage[] | string | PromptContent;

  /** ID do modelo. */
  model: ModelId | string;

  /** Máximo de tokens na resposta. */
  max_tokens?: number;

  /** Aleatoriedade. */
  temperature?: number;

  /** Nucleus sampling. */
  top_p?: number;

  /** Se true, retorna stream. */
  stream?: boolean;

  /** Sequências que interrompem a geração. */
  stop?: string | string[];

  /** Instrução de sistema. */
  system?: string;

  /** Formato desejado. */
  response_format?: "text" | "json_object" | "json_schema";

  /** Para json_schema: definição do schema. */
  response_schema?: Record<string, unknown>;

  /** Seed para reprodutibilidade. */
  seed?: number;

  /** Qual provedor usar. */
  provider?: LLMProviderSelection;

  /** Chave de API. */
  apiKey?: ApiKey | string;

  /** URL base customizada (opcional). */
  baseURL?: string;
}

/** Resposta unificada em modo texto. */
export interface UnifiedLLMTextResult {
  text: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  finish_reason?: string;
}

export interface UnifiedLLMJSONResult<T = any> extends UnifiedLLMTextResult {
  json: T;
}


/** Seletor de provedor incluindo modo automático. */
export type LLMProviderSelection = LLMProvider | 'auto';
