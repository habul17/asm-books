// Browser-only: makes a phone photo small enough to upload without losing the print.

/** Longest side after shrinking. Bill text stays sharp at this size. */
const MAX_SIDE = 2400;
const QUALITIES = [0.85, 0.7, 0.55];

/**
 * Returns a JPEG no bigger than `maxBytes`, or the original file when it cannot be
 * shrunk (for example a PDF, or a photo format this browser cannot open).
 */
export async function shrinkImage(file: File, maxBytes: number): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    // A small photo that already fits is sent untouched.
    if (scale === 1 && file.size <= maxBytes && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= maxBytes) return new File([blob], "bill.jpg", { type: "image/jpeg" });
    }
    return file;
  } finally {
    bitmap.close();
  }
}
