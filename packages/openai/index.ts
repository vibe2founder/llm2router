import { reqify } from '../reqify/index.js';

export interface OpenAIClientOptions {
  apiKey?: string;
  baseURL?: string;
}

export interface ChatCompletionParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
  response_format?: { type: 'json_object' | 'text' };
  stream?: boolean;
}

export class OpenAIClient {
  private apiKey?: string;
  private baseURL: string;

  constructor(options: OpenAIClientOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://api.openai.com/v1';
  }

  async createChatCompletion(params: ChatCompletionParams) {
    if (params.stream) {
      return this.createChatCompletionStream(params);
    }

    const response = await reqify.post(
      `${this.baseURL}/chat/completions`,
      params,
      {
        headers: this.apiKey
          ? {
              'Authorization': `Bearer ${this.apiKey}`,
            }
          : undefined,
      }
    );
    return response.data;
  }

  private async createChatCompletionStream(params: ChatCompletionParams) {
    const response = await reqify.postStream(
      `${this.baseURL}/chat/completions`,
      params,
      {
        headers: this.apiKey
          ? {
              'Authorization': `Bearer ${this.apiKey}`,
            }
          : undefined,
      }
    );
    return response.stream;
  }
}
