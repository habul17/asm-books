import "server-only";

import { FinishReason, GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";

import { SCAN_INSTRUCTIONS, SCANNED_BILL_JSON_SCHEMA } from "@/lib/bills/scan";

import { BillScanError, type BillFile, type BillReader } from "./reader";

const DEFAULT_MODEL = "gemini-3.8-flash";

/** HTTP status of a failed API call, when the error carries one. */
function statusOf(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { status?: unknown; statusCode?: unknown };
  const status = typeof e.status === "number" ? e.status : e.statusCode;
  return typeof status === "number" ? status : null;
}

/** Answers that mean "busy, try again": overloaded or a passing server problem. */
const BUSY = new Set([500, 502, 503, 504]);
const RETRY_WAITS_MS = [2000, 5000];

/** Tries again after a short wait when the service is busy, so one busy moment does not fail the scan. */
async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      const status = statusOf(err);
      if (status == null || !BUSY.has(status) || attempt >= RETRY_WAITS_MS.length) throw err;
      await new Promise((r) => setTimeout(r, RETRY_WAITS_MS[attempt]));
    }
  }
}

/** Reads bills with Google's Gemini API. */
export function geminiReader(apiKey: string, model = DEFAULT_MODEL): BillReader {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async read(file: BillFile) {
      let response;
      try {
        response = await withRetry(() => ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { text: "Read this purchase bill and return its contents." },
                // Photos and PDFs both go in as they are; PDFs keep their pages and printed text.
                { inlineData: { data: file.data, mimeType: file.mimeType } },
              ],
            },
          ],
          config: {
            systemInstruction: SCAN_INSTRUCTIONS,
            responseMimeType: "application/json",
            responseJsonSchema: SCANNED_BILL_JSON_SCHEMA,
            // Copying printed text needs little reasoning; more makes long bills slow.
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
          },
        }));
      } catch (err) {
        const status = statusOf(err);
        if (status != null && BUSY.has(status)) {
          throw new BillScanError("Google's bill reader is very busy right now. Try again in a minute, or enter the bill by hand.");
        }
        if (status === 429) {
          throw new BillScanError("The bill reader is busy or has reached today's free limit. Try again in a minute, or enter the bill by hand.");
        }
        if (status === 401 || status === 403) {
          throw new BillScanError("The bill reader's key was not accepted. Ask the owner to check the key.");
        }
        throw err;
      }

      const finish = response.candidates?.[0]?.finishReason;
      const text = response.text;
      if (!text || (finish && finish !== FinishReason.STOP)) {
        throw new BillScanError("The bill could not be read fully. Try a clearer photo, or one page at a time.");
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new BillScanError("The bill could not be read. Try a clearer photo.");
      }
    },
  };
}
