import "server-only";

import { GoogleGenAI } from "@google/genai";

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

/** Reads bills with Google's Gemini API. */
export function geminiReader(apiKey: string, model = DEFAULT_MODEL): BillReader {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async read(file: BillFile) {
      let interaction;
      try {
        interaction = await ai.interactions.create({
          model,
          system_instruction: SCAN_INSTRUCTIONS,
          input: [
            { type: "text", text: "Read this purchase bill and return its contents." },
            file.mimeType === "application/pdf"
              ? { type: "document", data: file.data, mime_type: file.mimeType }
              : { type: "image", data: file.data, mime_type: file.mimeType, resolution: "high" },
          ],
          response_format: { type: "text", mime_type: "application/json", schema: SCANNED_BILL_JSON_SCHEMA },
          generation_config: { thinking_level: "medium" },
          // The bill is only needed for this one answer; do not keep it on the service.
          store: false,
        });
      } catch (err) {
        const status = statusOf(err);
        if (status === 429) {
          throw new BillScanError("The bill reader is busy or has reached today's free limit. Try again in a minute, or enter the bill by hand.");
        }
        if (status === 401 || status === 403) {
          throw new BillScanError("The bill reader's key was not accepted. Ask the owner to check the key.");
        }
        throw err;
      }

      if (interaction.status !== "completed" || !interaction.output_text) {
        throw new BillScanError("The bill could not be read fully. Try a clearer photo, or one page at a time.");
      }
      try {
        return JSON.parse(interaction.output_text) as unknown;
      } catch {
        throw new BillScanError("The bill could not be read. Try a clearer photo.");
      }
    },
  };
}
