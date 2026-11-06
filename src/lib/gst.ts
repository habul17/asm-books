// GST state codes and GSTIN checking.

export const GST_STATES: Readonly<Record<string, string>> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

/** States sorted by name, for dropdowns. */
export const GST_STATE_OPTIONS = Object.entries(GST_STATES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function checkChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export type GstinCheck = { ok: true; gstin: string; stateCode: string } | { ok: false; error: string };

/** Validates a GSTIN, including its check character, and reads the state from it. */
export function checkGstin(raw: string): GstinCheck {
  const gstin = raw.toUpperCase().replace(/\s+/g, "");
  if (!PATTERN.test(gstin)) return { ok: false, error: "GSTIN should be 15 characters, like 33ABCDE1234F1Z7" };
  const stateCode = gstin.slice(0, 2);
  if (!GST_STATES[stateCode]) {
    return { ok: false, error: `GSTIN starts with ${stateCode}, which is not a GST state code` };
  }
  if (checkChar(gstin.slice(0, 14)) !== gstin[14]) {
    return { ok: false, error: "GSTIN has a typing mistake (the last character does not match)" };
  }
  return { ok: true, gstin, stateCode };
}

/** Builds a valid GSTIN from its first 14 characters. Used by tests. */
export const withCheckChar = (first14: string) => first14 + checkChar(first14);
