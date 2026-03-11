import { promises as fs } from 'node:fs';
import path from 'node:path';
import { runLLM } from '../adapters/run-llm.js';
import type { LLMProviderSelection, UnifiedLLMParams } from '../types/llm.types.js';

export interface ToolCallContext {
  step: number;
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: Record<string, unknown>, context: ToolCallContext) => Promise<string> | string;
}

export interface SecureFileToolsConfig {
  rootDir: string;
  allowWrite?: boolean;
  maxFileSizeBytes?: number;
  blockedPatterns?: RegExp[];
}

interface ToolCallMessage {
  type: 'tool_call';
  name: string;
  arguments?: Record<string, unknown>;
}

interface FinalMessage {
  type: 'final';
  content: string;
}

type AgentModelResponse = ToolCallMessage | FinalMessage;

export interface ToolCallingAgentOptions {
  model: string;
  provider?: LLMProviderSelection;
  apiKey?: string;
  systemPrompt?: string;
  maxSteps?: number;
  tools: AgentTool[];
  callModel?: (messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) => Promise<AgentModelResponse>;
}

function buildToolProtocol(tools: AgentTool[]) {
  return [
    'Você é um agente com tool calling estrito em JSON.',
    'Responda SOMENTE com JSON válido em UM destes formatos:',
    '{"type":"tool_call","name":"<tool>","arguments":{...}}',
    '{"type":"final","content":"<resposta final para o usuário>"}',
    'Nunca invente ferramentas. Só use uma destas:',
    ...tools.map((tool) => `- ${tool.name}: ${tool.description}`),
  ].join('\n');
}

async function defaultModelCaller(
  options: ToolCallingAgentOptions,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<AgentModelResponse> {
  const params: UnifiedLLMParams = {
    model: options.model,
    provider: options.provider,
    apiKey: options.apiKey,
    messages,
  };

  const response = await runLLM(params, 'json');
  const data = (response.json ?? {}) as Partial<AgentModelResponse>;

  if (data.type === 'tool_call' && typeof data.name === 'string') {
    return {
      type: 'tool_call',
      name: data.name,
      arguments: typeof data.arguments === 'object' && data.arguments ? data.arguments as Record<string, unknown> : {},
    };
  }

  const content = (data as { content?: unknown }).content;
  return {
    type: 'final',
    content: typeof content === 'string' ? content : response.text,
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}

function getSafePath(rootDir: string, targetPath: unknown): string {
  if (typeof targetPath !== 'string' || targetPath.trim().length === 0) {
    throw new Error('Parâmetro "path" inválido.');
  }

  const normalizedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(normalizedRoot, targetPath);
  const relative = path.relative(normalizedRoot, resolvedTarget);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Acesso negado: caminho fora do diretório permitido.');
  }

  return resolvedTarget;
}

function ensureNotBlocked(absolutePath: string, blockedPatterns: RegExp[]) {
  if (blockedPatterns.some((pattern) => pattern.test(absolutePath))) {
    throw new Error('Acesso negado: arquivo/pasta bloqueado por política de segurança.');
  }
}

export function createSecureFileTools(config: SecureFileToolsConfig): AgentTool[] {
  const rootDir = path.resolve(config.rootDir);
  const allowWrite = config.allowWrite ?? true;
  const maxFileSizeBytes = config.maxFileSizeBytes ?? 128 * 1024;
  const blockedPatterns = config.blockedPatterns ?? [/\.env/i, /id_rsa/i, /node_modules\//i, /\.git\//i];

  const resolveAndGuard = (inputPath: unknown) => {
    const absolutePath = getSafePath(rootDir, inputPath);
    ensureNotBlocked(absolutePath, blockedPatterns);
    return absolutePath;
  };

  return [
    {
      name: 'read_file',
      description: 'Lê um arquivo UTF-8 dentro do diretório permitido.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      async execute(input) {
        const absolutePath = resolveAndGuard(input.path);
        const stats = await fs.stat(absolutePath);
        if (stats.size > maxFileSizeBytes) {
          throw new Error(`Arquivo excede limite de ${maxFileSizeBytes} bytes.`);
        }
        return fs.readFile(absolutePath, 'utf8');
      },
    },
    {
      name: 'write_file',
      description: 'Escreve conteúdo UTF-8 em um arquivo (sobrescreve se existir).',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
      async execute(input) {
        if (!allowWrite) {
          throw new Error('Operação de escrita desabilitada por política de segurança.');
        }

        const absolutePath = resolveAndGuard(input.path);
        const content = typeof input.content === 'string' ? input.content : '';

        if (Buffer.byteLength(content, 'utf8') > maxFileSizeBytes) {
          throw new Error(`Conteúdo excede limite de ${maxFileSizeBytes} bytes.`);
        }

        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, content, 'utf8');
        return 'Arquivo salvo com sucesso.';
      },
    },
    {
      name: 'append_file',
      description: 'Adiciona conteúdo UTF-8 ao final de um arquivo.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
      async execute(input) {
        if (!allowWrite) {
          throw new Error('Operação de escrita desabilitada por política de segurança.');
        }

        const absolutePath = resolveAndGuard(input.path);
        const content = typeof input.content === 'string' ? input.content : '';

        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.appendFile(absolutePath, content, 'utf8');

        const stats = await fs.stat(absolutePath);
        if (stats.size > maxFileSizeBytes) {
          throw new Error(`Arquivo excede limite de ${maxFileSizeBytes} bytes após append.`);
        }

        return 'Conteúdo adicionado com sucesso.';
      },
    },
    {
      name: 'list_files',
      description: 'Lista arquivos e pastas de um diretório dentro do sandbox.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      async execute(input) {
        const absolutePath = resolveAndGuard((input.path as string | undefined) ?? '.');
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        return JSON.stringify(entries.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'dir' : 'file' })));
      },
    },
  ];
}

export async function runToolCallingAgent(userPrompt: string, options: ToolCallingAgentOptions): Promise<string> {
  const maxSteps = options.maxSteps ?? 8;
  const byName = new Map(options.tools.map((tool) => [tool.name, tool]));

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: buildToolProtocol(options.tools) },
  ];

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }

  messages.push({ role: 'user', content: userPrompt });

  for (let step = 1; step <= maxSteps; step += 1) {
    const caller = options.callModel ?? ((history) => defaultModelCaller(options, history));
    const response = await caller(messages);

    if (response.type === 'final') {
      return response.content;
    }

    const tool = byName.get(response.name);
    if (!tool) {
      messages.push({
        role: 'assistant',
        content: JSON.stringify({ tool_error: `Ferramenta não permitida: ${response.name}` }),
      });
      continue;
    }

    try {
      const result = await tool.execute(response.arguments ?? {}, { step });
      messages.push({ role: 'assistant', content: JSON.stringify({ tool_result: { name: tool.name, result } }) });
    } catch (error) {
      messages.push({ role: 'assistant', content: JSON.stringify({ tool_error: toErrorMessage(error), tool: tool.name }) });
    }
  }

  throw new Error(`Limite de ${maxSteps} passos atingido sem resposta final.`);
}
