import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body: any = await request.json();
    if (body.stream) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Stream "}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"works!"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new HttpResponse(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    return HttpResponse.json({
      choices: [{ message: { content: 'Hello! I am OpenAI.' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      model: 'gpt-4'
    });
  }),

  http.post('https://api.groq.com/openai/v1/chat/completions', async () => {
    return HttpResponse.json({
      choices: [{ message: { content: 'Hello from Groq!' } }],
      usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      model: 'llama3-8b'
    });
  }),

  http.post('https://api.anthropic.com/v1/messages', async () => {
    return HttpResponse.json({
      id: 'msg_123',
      content: [{ type: 'text', text: 'Hello from Anthropic!' }],
      model: 'claude-3',
      usage: { input_tokens: 10, output_tokens: 20 },
      stop_reason: 'end_turn'
    });
  }),

  http.post('https://generativelanguage.googleapis.com/v1beta/models/:modelId', async () => {
    return HttpResponse.json({
      candidates: [{ content: { parts: [{ text: 'Hello from Gemini!' }] } }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 10 }
    });
  }),

  http.post('http://127.0.0.1:11434/v1/chat/completions', async () => {
    return HttpResponse.json({
      choices: [{ message: { content: 'Hello from Ollama local!' } }],
      usage: { prompt_tokens: 7, completion_tokens: 9, total_tokens: 16 },
      model: 'llama3.2:latest'
    });
  }),

  http.head('https://www.google.com/generate_204', async () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
