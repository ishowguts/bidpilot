// LLM client for the stretch daily summary (ARCHITECTURE §12). Model output is untrusted input: callers validate it
// and fall back to a deterministic template when anything is wrong.
import { GoogleGenAI } from '@google/genai';

export interface LlmClient {
  readonly model: string;
  /** Asks for one JSON document and returns the raw text. Throws on transport failure or timeout. */
  generateJson(prompt: string): Promise<string>;
}

export const LLM_TIMEOUT_MS = 15_000;

/** Null when `GEMINI_API_KEY` or `GEMINI_MODEL` is unset: summaries then use the template. */
export function createLlmClient(apiKey: string | undefined, model: string | undefined): LlmClient | null {
  if (!apiKey || !model) return null;
  const client = new GoogleGenAI({ apiKey });
  return {
    model,
    async generateJson(prompt) {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0,
          // Thinking off: a short summary does not need it, and it keeps latency well inside the timeout.
          // gemini-3.8-flash accepts thinkingBudget (not thinkingLevel).
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        },
      });
      return response.text ?? '';
    },
  };
}

/** Strips a markdown code fence, which models add even in JSON mode. */
export function unfence(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}
