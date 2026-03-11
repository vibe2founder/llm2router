# Relatório técnico profundo — Code Review, Funcionalidades e Arquitetura

## 1) Contexto do projeto
O projeto implementa uma camada unificada (`runLLM`) e uma API fluente (`sendPrompt`) para múltiplos provedores de LLM. A estratégia predominante é:
- normalização de entrada em `UnifiedLLMParams`;
- roteamento por `provider`;
- adaptação de payload para cada SDK HTTP nativo em `packages/*`.

## 2) Alterações implementadas nesta entrega

### 2.1 Suporte a Ollama local
- Novo provider `ollama` adicionado ao tipo de provedores.
- O roteamento reutiliza o caminho OpenAI-compatible com `baseURL` default `http://127.0.0.1:11434/v1`.
- `apiKey` tornou-se opcional para chamadas OpenAI-compatible no client (necessário para Ollama local).

### 2.2 Provider automático para cenário offline
- Novo seletor `provider: 'auto'`.
- Estratégia:
  - testa conectividade externa com `HEAD https://www.google.com/generate_204` e timeout curto;
  - sem internet => direciona para `ollama`;
  - com internet => direciona para `groq`.

## 3) Code review técnico (estado atual + recomendações)

### 3.1 Camada de tipagem
**Pontos fortes**
- Tipos semânticos e unificação boa de parâmetros.
- API pública enxuta.

**Riscos técnicos**
- `LLMProvider` e `LLMProviderSelection` agora coexistem; há risco de uso inconsistente em pontos internos.
- `messages` aceita `string | PromptContent | LLMMessage[]`; o narrowing poderia ser mais estrito para evitar casts.

**Ações recomendadas**
1. Introduzir funções type-guard para distinguir `string` vs `LLMMessage[]`.
2. Adicionar testes de tipo (`tsd` ou suite de compile-time) para impedir regressão.
3. Evitar `as any` em caminhos críticos de provider.

### 3.2 Adaptador de execução (`runLLM`)
**Pontos fortes**
- Estrutura clara por provider.
- Caminho OpenAI-compatible reaproveitado para múltiplos provedores.

**Riscos técnicos**
- Heurística de internet depende de endpoint único (`google.com/generate_204`). Em redes corporativas, pode falhar mesmo com internet funcional.
- Fallback `auto => groq` online pressupõe existência de API key de Groq.
- `resolveProvider` não considera preferência explícita do usuário por outro provedor online.

**Ações recomendadas**
1. Implementar estratégia de health-check com múltiplos endpoints (ex.: Cloudflare + OpenAI + Groq), quorum simples.
2. Em `auto`, escolher provedor online com base em prioridade + disponibilidade de API key no ambiente.
3. Log estruturado opcional de roteamento (`selectedProvider`, `reason`, `latencyCheckMs`) para observabilidade.

### 3.3 Cliente OpenAI-compatible
**Pontos fortes**
- Reuso de client único reduz duplicação.

**Riscos técnicos**
- Ausência de header Authorization é correta para Ollama, mas alguns gateways exigem token mesmo local/proxy.

**Ações recomendadas**
1. Manter `apiKey` opcional, mas permitir headers adicionais customizáveis via opções avançadas.
2. Adicionar teste unitário garantindo que o header não é enviado quando `apiKey` está ausente.

### 3.4 Testes
**Pontos fortes**
- Cobertura de integração com MSW para principais providers.
- Novo cenário `auto/offline` validado.

**Riscos técnicos**
- Mock de conectividade substitui `global.fetch` manualmente; pode afetar paralelismo se testes crescerem.
- Cenário `auto/online` não cobre seleção positiva e resolução por API key.

**Ações recomendadas**
1. Encapsular detector de conectividade em função injetável para simplificar mocking.
2. Criar matriz de testes `auto`:
   - offline -> ollama
   - online + groq key -> groq
   - online + sem groq key + openai key -> openai (após implementação de priorização)
3. Habilitar teste de stream atualmente `skip` com fixture SSE estável.

## 4) Avaliação arquitetural profunda

### 4.1 Arquitetura atual (boa base)
- **Boundary público**: `sendPrompt`.
- **Core orchestration**: `runLLM`.
- **Infra clients**: `packages/*`.

Essa separação é adequada para evoluir para estratégia multi-provider inteligente.

### 4.2 Próximos passos arquiteturais sugeridos
1. **Provider Registry**
   - Criar registro declarativo por provider (capabilities, baseURL default, auth mode, supports_stream/json/schema).
   - Evita `if/else` grande em `runLLM`.
2. **Selection Strategy**
   - Extrair `resolveProvider` para módulo dedicado com políticas (`auto`, `local-first`, `cost-first`, `latency-first`).
3. **Resiliência**
   - Retry/backoff por classe de erro (429/5xx/network).
   - Circuit breaker por provider.
4. **Observabilidade**
   - Métricas de latência por provider/model.
   - Taxa de fallback para `ollama`.

## 5) Funcionalidades sugeridas por prioridade

### Curto prazo (1-2 sprints)
- [ ] Priorização automática por API key disponível (não fixar em Groq).
- [ ] Configuração de endpoint de conectividade por env (`LLM_CONNECTIVITY_URL`).
- [ ] Documentação de setup local Ollama (`ollama serve`, pull de modelo, porta).

### Médio prazo (3-5 sprints)
- [ ] Failover em cascata: provider principal -> secundário -> ollama.
- [ ] Modo `local-first` explícito.
- [ ] Suporte a streaming Gemini no adapter nativo.

### Longo prazo
- [ ] Roteamento por custo/latência com telemetria histórica.
- [ ] Catálogo de capabilities por modelo (tool-calling, json_schema, context window).

## 6) Conclusão objetiva
A base atual já suporta o objetivo principal solicitado: operação local com Ollama e fallback automático em ausência de internet. O passo crítico seguinte é transformar a seleção automática de provider em um mecanismo orientado por disponibilidade real de credenciais, observabilidade e políticas configuráveis de roteamento.
