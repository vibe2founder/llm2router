import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSecureFileTools, runToolCallingAgent } from '../../src/agent/tool-agent.js';

const tempRoots: string[] = [];

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-tools-'));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('tool agent', () => {
  it('deve executar ciclo de tool_call e retornar resposta final', async () => {
    const root = await createTempRoot();
    const tools = createSecureFileTools({ rootDir: root });

    const script = [
      { type: 'tool_call', name: 'write_file', arguments: { path: 'memoria/nota.txt', content: 'olá' } },
      { type: 'tool_call', name: 'read_file', arguments: { path: 'memoria/nota.txt' } },
      { type: 'final', content: 'Concluído com sucesso' },
    ];

    const answer = await runToolCallingAgent('salve e leia arquivo', {
      model: 'mock-model',
      tools,
      callModel: async () => script.shift() as any,
    });

    expect(answer).toBe('Concluído com sucesso');
    expect(await fs.readFile(path.join(root, 'memoria/nota.txt'), 'utf8')).toBe('olá');
  });

  it('deve bloquear path traversal fora do sandbox', async () => {
    const root = await createTempRoot();
    const tools = createSecureFileTools({ rootDir: root });
    const readTool = tools.find((t) => t.name === 'read_file');

    await expect(readTool?.execute({ path: '../segredo.txt' }, { step: 1 } as any)).rejects.toThrow(/Acesso negado/);
  });

  it('deve bloquear escrita quando allowWrite=false', async () => {
    const root = await createTempRoot();
    const tools = createSecureFileTools({ rootDir: root, allowWrite: false });
    const writeTool = tools.find((t) => t.name === 'write_file');

    await expect(writeTool?.execute({ path: 'a.txt', content: 'x' }, { step: 1 } as any)).rejects.toThrow(/desabilitada/);
  });
});
