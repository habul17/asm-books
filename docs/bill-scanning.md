# Bill scanning

On **Bills › New bill**, "Scan a bill" reads a photo or PDF of a vendor's bill and
fills in the bill form. Nothing is saved until a person checks the form and presses
Save. Saving works exactly like a bill typed by hand: stock goes up and, when
"Update purchase prices" is ticked, the rates become the parts' newest purchase
prices, which price lists follow.

## What is checked

A scan can misread a digit, so the app does not trust it:

- **Parts** are matched to the catalogue by part number (spaces, dashes and letter
  case are ignored). A part that is not found, or only nearly matches, is flagged.
  A row without a part cannot be saved.
- **Each row**: quantity × rate (less discount) must equal the amount printed on
  the row.
- **Price jumps**: a rate more than 30% away from the last purchase price is flagged.
- **GST**: only real GST rates are accepted. Half rates (CGST only) are doubled.
- **Totals**: the rows must add up to the bill's taxable total, and the total the
  app works out is compared with the total printed on the bill while you edit.
- **Supplier**: matched to a saved vendor by GSTIN, then by exact name. Vendors are
  never created automatically.
- **Duplicates**: a bill number already entered for that vendor is called out.

## Setting it up

1. Create an API key in Google AI Studio (https://aistudio.google.com/).
2. Add it as `GEMINI_API_KEY` in the hosting environment variables (and in
   `.env.local` for local use). Never commit the key.
3. Redeploy. The "Scan a bill" button becomes active.

`BILL_SCAN_MODEL` optionally overrides the model (default `gemini-3.8-flash`).

## Privacy

The photo or PDF is sent to Google's Gemini API to be read. The app does not keep
the file, and asks the service not to store the request.

On the **free tier**, Google's terms say submitted content may be used to improve
its products, that human reviewers may read it, and that confidential information
should not be submitted. Purchase bills show supplier names, GSTINs and buying
prices. On the **paid tier** content is not used to improve products. Decide which
tier fits before adding the key.

## Limits

- One photo or PDF per scan, up to 4 MB. Photos are shrunk in the browser first.
- The free tier has request limits that Google changes; when they are reached the
  app says so and the bill can be entered by hand.

## Changing the reading service

Readers implement `BillReader` in `src/server/bill-scan/reader.ts`. Everything
after the read (validation, matching, checks) is shared, so adding another service
means adding one file next to `gemini.ts` and choosing it in `index.ts`.
