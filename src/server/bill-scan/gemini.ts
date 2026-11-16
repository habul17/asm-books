import "server-only";

import { FinishReason, GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";

import { isVoiceMimeType } from "@/lib/bills/scan";

import { BillScanError, type BillFile, type BillReader, type ReadTask } from "./reader";

/** Said before the task when the file is the user speaking, not a document. */
const VOICE_NOTE = `The attached file is a voice recording of the shop owner or staff saying the details, not a printed document.
- They may speak English, Tamil or a mix. Return names and descriptions in English letters.
- Take every rule about "printed" or "as printed" to mean "as spoken".
- Part numbers are often said digit by digit ("one three zero one" is 1301) or with letters ("fifteen oh three T" is 1503T).
- A number said after a part number is the quantity or count, not part of the part number: "fifteen oh three T, twelve" is part 1503T with 12. Words like "pieces", "nos" or "set" mark a quantity.
- Amounts may be said in words ("two thousand five hundred" is 2500).
- Only return what was said. Never invent anything that was not said.`;

const DEFAULT_MODEL = "gemini-3.8-flash";
/** Asked when the main model is too slow or busy: newest models are sometimes overloaded for hours. */
const DEFAULT_FALLBACK_MODEL = "gemini-3.6-flash";
/** How long the main model gets before the fallback is asked, unless the task says otherwise. */
const FIRST_TRY_MS = 60_000;

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

const timedOut = (err: unknown) => err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");

/** Reads bills, receipts and slips with Google's Gemini API. */
export function geminiReader(apiKey: string, model = DEFAULT_MODEL, fallback: string | null = DEFAULT_FALLBACK_MODEL): BillReader {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async read(file: BillFile, task: ReadTask) {
      const noun = task.noun;
      const ask = (useModel: string, abortSignal?: AbortSignal) =>
        withRetry(() => ai.models.generateContent({
          model: useModel,
          contents: [
            {
              role: "user",
              parts: [
                { text: isVoiceMimeType(file.mimeType) ? `${VOICE_NOTE}\n\n${task.ask}` : task.ask },
                // Photos and PDFs both go in as they are; PDFs keep their pages and printed text.
                { inlineData: { data: file.data, mimeType: file.mimeType } },
              ],
            },
          ],
          config: {
            systemInstruction: task.instructions,
            responseMimeType: "application/json",
            responseJsonSchema: task.schema,
            // Copying printed text needs little reasoning; more makes long documents slow.
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
            abortSignal,
          },
        }));
      let response;
      try {
        try {
          response = await ask(model, fallback && fallback !== model ? AbortSignal.timeout(task.firstTryMs ?? FIRST_TRY_MS) : undefined);
        } catch (err) {
          const status = statusOf(err);
          const slowOrBusy = timedOut(err) || status === 429 || (status != null && BUSY.has(status));
          if (!fallback || fallback === model || !slowOrBusy) throw err;
          console.warn(`[scan] ${model} was ${timedOut(err) ? "too slow" : "busy"}; asking ${fallback}`);
          response = await ask(fallback);
        }
      } catch (err) {
        const status = statusOf(err);
        if (status != null && BUSY.has(status)) {
          throw new BillScanError(`Google's reader is very busy right now. Try again in a minute, or enter the ${noun} by hand.`);
        }
        if (status === 429) {
          throw new BillScanError(`The reader is busy or has reached today's free limit. Try again in a minute, or enter the ${noun} by hand.`);
        }
        if (status === 401 || status === 403) {
          throw new BillScanError("The reader's key was not accepted. Ask the owner to check the key.");
        }
        throw err;
      }

      const finish = response.candidates?.[0]?.finishReason;
      const text = response.text;
      if (!text || (finish && finish !== FinishReason.STOP)) {
        throw new BillScanError(`The ${noun} could not be read fully. Try a clearer photo, or one page at a time.`);
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new BillScanError(`The ${noun} could not be read. Try a clearer photo.`);
      }
    },
  };
}
