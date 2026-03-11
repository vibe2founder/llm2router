import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers.js';
import { sendPrompt } from '../../src/index.js';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  // Clear env vars to prevent leaks
  delete process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
});
afterAll(() => server.close());

describe('Integration: sendPrompt (Fulfilling User Scenarios)', () => {

  it('Scenario: User sends a prompt to OpenAI and gets text response', async () => {
    // Given
    process.env.OPENAI_API_KEY = 'test-key';
    const prompt = 'Hello OpenAI';
    const options = { model: 'gpt-4', provider: 'openai' as const };

    // When
    const result = await sendPrompt(prompt, options).getText();

    // Then
    expect(result).toBe('Hello! I am OpenAI.');
  });

  it('Scenario: User sends a prompt to Groq and gets text response', async () => {
    // Given
    process.env.GROQ_API_KEY = 'test-key';
    const prompt = 'Hello Groq';
    const options = { model: 'llama3-8b', provider: 'groq' as const };

    // When
    const result = await sendPrompt(prompt, options).getText();

    // Then
    expect(result).toBe('Hello from Groq!');
  });

  it('Scenario: User sends a prompt to Anthropic and gets text response', async () => {
    // Given
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const prompt = 'Hello Claude';
    const options = { model: 'claude-3', provider: 'anthropic' as const };

    // When
    const result = await sendPrompt(prompt, options).getText();

    // Then
    expect(result).toBe('Hello from Anthropic!');
  });

  it('Scenario: User sends a prompt to Gemini and gets text response', async () => {
    // Given
    process.env.GEMINI_API_KEY = 'test-key';
    const prompt = 'Hello Gemini';
    const options = { model: 'gemini-pro', provider: 'gemini' as const };

    // When
    const result = await sendPrompt(prompt, options).getText();

    // Then
    expect(result).toBe('Hello from Gemini!');
  });



  it('Scenario: User uses provider auto and falls back to Ollama when offline', async () => {
    const originalFetch = global.fetch;
    const mockedFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input.includes('google.com/generate_204')) {
        return Promise.reject(new Error('offline'));
      }
      return originalFetch(input as any, init);
    });

    global.fetch = mockedFetch as typeof fetch;

    try {
      const prompt = 'Hello auto';
      const options = { model: 'llama3.2:latest', provider: 'auto' as const };

      const result = await sendPrompt(prompt, options).getText();
      expect(result).toBe('Hello from Ollama local!');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it.skip('Scenario: User requests streaming response from OpenAI', async () => {
    // Given
    process.env.OPENAI_API_KEY = 'test-key';
    const prompt = 'Stream me';
    const options = { model: 'gpt-4', provider: 'openai' as const };

    // When
    const stream = await sendPrompt(prompt, options).getStream();

    // Then
    let text = '';
    for await (const chunk of stream) {
      text += chunk;
    }
    expect(text).toBe('Stream works!');
  });

});
