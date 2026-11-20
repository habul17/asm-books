// Rules for a part photo the owner adds from a phone.

/** Largest photo kept. The browser shrinks a phone photo well below this first. */
export const PART_PHOTO_MAX_BYTES = 400 * 1024;
/** Longest side the browser shrinks a photo to; plenty for the part page. */
export const PART_PHOTO_MAX_SIDE = 900;
/** Most related parts one photo is shared with in a single save. */
export const RELATED_PARTS_MAX = 60;

/**
 * The number a family of parts shares: "3943" for 3943A, 3943B and 3943W. Only a
 * part number that starts with at least three digits has one, so short or
 * lettered numbers never pull in unrelated parts.
 */
export function partFamily(partNo: string): string | null {
  const match = /^(\d{3,})/.exec(partNo.trim());
  return match ? match[1] : null;
}
