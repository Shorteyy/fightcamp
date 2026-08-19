const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = 'gemini-3.6-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export class GeminiError extends Error {}

// deno-lint-ignore no-explicit-any
export async function callGemini(prompt: string, responseSchema: Record<string, any>): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema },
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new GeminiError(e instanceof Error && e.name === 'TimeoutError' ? 'AI request timed out' : 'Could not reach the AI service');
  }

  if (res.status === 429) throw new GeminiError('Rate limited — the free AI tier is temporarily exhausted. Try again shortly.');
  if (!res.ok) throw new GeminiError(`AI service error (${res.status})`);

  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') throw new GeminiError('AI returned an unexpected response');

  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError('AI returned malformed JSON');
  }
}
