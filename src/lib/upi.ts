// UPI payment links, as read by every UPI app (GPay, PhonePe, Paytm, BHIM…).

/** A UPI ID like shopname@okaxis. */
export const UPI_ID_PATTERN = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;

/**
 * The link a "scan to pay" QR code holds. There is no amount: the customer types what
 * they pay, so part payments work too. The note shows in both people's payment history.
 */
export function upiPayLink({ upiId, name, note }: { upiId: string; name: string; note: string }) {
  // The UPI ID only has letters, digits, ".", "-", "_" and "@", and some apps do not read "%40", so it stays as typed.
  const params = [
    ["pn", name.slice(0, 50)],
    ["cu", "INR"],
    ["tn", note.slice(0, 50)],
  ];
  return `upi://pay?pa=${upiId}&${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
