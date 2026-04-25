// Multi-provider LLM router for the tournament AI assistant.
// Selects provider based on the AI_PROVIDER env var (gemini | groq | openai).
// All providers use the same simple ChatMessage interface.

export type ChatRole = 'system' | 'user' | 'assistant';
export type ChatMessage = { role: ChatRole; content: string };

const TEMPERATURE = 0.2;
// Limite de tokens de saida. Pode ser sobrescrito via env AI_MAX_OUTPUT_TOKENS.
// Gemini 2.5 Flash suporta ate 8192. gpt-4o-mini ate 16384. Llama 3.3 70B ate 8192.
const DEFAULT_MAX_OUTPUT_TOKENS = 2000;

function getMaxOutputTokens(): number {
  const raw = Deno.env.get('AI_MAX_OUTPUT_TOKENS');
  if (!raw) return DEFAULT_MAX_OUTPUT_TOKENS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(parsed, 8000);
}

export class ProviderError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 502, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function callLLM(messages: ChatMessage[]): Promise<string> {
  const provider = (Deno.env.get('AI_PROVIDER') ?? 'gemini').toLowerCase();
  const customModel = Deno.env.get('AI_MODEL') ?? undefined;

  switch (provider) {
    case 'gemini':
      return callGemini(messages, customModel ?? 'gemini-2.5-flash');
    case 'groq':
      return callGroq(messages, customModel ?? 'llama-3.3-70b-versatile');
    case 'openai':
      return callOpenAI(messages, customModel ?? 'gpt-4o-mini');
    default:
      throw new ProviderError(`AI_PROVIDER desconhecido: "${provider}". Use gemini, groq ou openai.`, 500);
  }
}

// ----- Google Gemini --------------------------------------------------------

async function callGemini(messages: ChatMessage[], model: string): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new ProviderError('GEMINI_API_KEY nao configurada nos secrets.', 500);

  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body = {
    systemInstruction: systemText
      ? { role: 'system', parts: [{ text: systemText }] }
      : undefined,
    contents,
    generationConfig: {
      temperature: TEMPERATURE,
      maxOutputTokens: getMaxOutputTokens(),
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ProviderError(`Gemini retornou ${res.status}`, 502, text);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    throw new ProviderError('Gemini nao retornou candidates.', 502, data);
  }
  if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
    throw new ProviderError(`Gemini bloqueou a resposta (${candidate.finishReason}).`, 502, candidate);
  }
  const parts = candidate.content?.parts;
  if (!Array.isArray(parts)) {
    throw new ProviderError('Resposta do Gemini sem parts.', 502, data);
  }
  const text = parts
    .map((p: unknown) => (p && typeof p === 'object' && 'text' in p ? String((p as { text: string }).text ?? '') : ''))
    .join('');
  return text.trim();
}

// ----- OpenAI / Groq (mesmo schema) -----------------------------------------

async function callOpenAICompat(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  providerLabel: string,
): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: TEMPERATURE,
      max_tokens: getMaxOutputTokens(),
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ProviderError(`${providerLabel} retornou ${res.status}`, 502, text);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new ProviderError(`Resposta inesperada de ${providerLabel}.`, 502, data);
  }
  return text.trim();
}

function callGroq(messages: ChatMessage[], model: string): Promise<string> {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) throw new ProviderError('GROQ_API_KEY nao configurada nos secrets.', 500);
  return callOpenAICompat(
    'https://api.groq.com/openai/v1/chat/completions',
    key,
    model,
    messages,
    'Groq',
  );
}

function callOpenAI(messages: ChatMessage[], model: string): Promise<string> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new ProviderError('OPENAI_API_KEY nao configurada nos secrets.', 500);
  return callOpenAICompat(
    'https://api.openai.com/v1/chat/completions',
    key,
    model,
    messages,
    'OpenAI',
  );
}
