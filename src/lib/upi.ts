// UPI payment links, as read by every UPI app (GPay, PhonePe, Paytm, BHIM…).

/** A UPI ID like shopname@okaxis. */
export const UPI_ID_PATTERN = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;

/**
 * The link a "scan to pay" QR code holds. The amount is filled in so the customer
 * only has to confirm it; the note shows in both people's payment history.
 */
export function upiPayLink({ upiId, name, amount, note }: { upiId: string; name: string; amount: number; note: string }) {
  // The UPI ID only has letters, digits, ".", "-", "_" and "@", and some apps do not read "%40", so it stays as typed.
  const params = [
    ["pn", name.slice(0, 50)],
    ["am", amount.toFixed(2)],
    ["cu", "INR"],
    ["tn", note.slice(0, 50)],
  ];
  return `upi://pay?pa=${upiId}&${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
