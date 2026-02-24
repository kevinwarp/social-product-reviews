import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not set — Gemini calls will fail.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Use Gemini 2.5 Flash for speed/cost by default; switch to Pro for quality-critical steps
export const geminiFlash = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
export const geminiPro = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

/**
 * Generate structured JSON output from Gemini.
 * Wraps the call with JSON parsing and error handling.
 */
export async function generateJSON<T>(
  prompt: string,
  options: { usePro?: boolean } = {}
): Promise<T> {
  const model = options.usePro ? geminiPro : geminiFlash;
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();
  return JSON.parse(text) as T;
}

/**
 * Generate plain text output from Gemini.
 */
export async function generateText(
  prompt: string,
  options: { usePro?: boolean } = {}
): Promise<string> {
  const model = options.usePro ? geminiPro : geminiFlash;
  const result = await model.generateContent(prompt);
  return result.response.text();
}
