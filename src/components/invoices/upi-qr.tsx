import QRCode from "qrcode";

import { upiPayLink } from "@/lib/upi";

/** "Scan to pay" box on a printed bill: any UPI app opens with our UPI ID; the customer types the amount. */
export async function UpiQr({ upiId, name, note }: { upiId: string; name: string; note: string }) {
  // The SVG is made here from our own text, so it is safe to put in the page.
  const svg = await QRCode.toString(upiPayLink({ upiId, name, note }), {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
  });
  return (
    <figure className="flex shrink-0 flex-col items-center gap-0.5 text-center text-[10px] font-bold">
      <div className="size-[26mm] [&>svg]:size-full" role="img" aria-label="UPI QR code to pay this bill" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>SCAN TO PAY</figcaption>
    </figure>
  );
}
