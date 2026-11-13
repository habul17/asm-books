# Banking

Banking shows how much money the shop has, split into **cash in hand** and
**in the bank**, and it is where the owner enters money that is not a sale, a
purchase or an expense. Only the owner can see or use it.

## What to enter here

Sales, payments received, bills, payments made and expenses are already
counted from their own screens. Enter here only what none of those cover:

| Entry | What it means | What it changes |
| --- | --- | --- |
| Owner put money in | Your own money added to the business | Money up; owner's capital up |
| Owner took money out | Money taken for yourself or home | Money down; owner's capital down |
| Loan received | Borrowed from a bank or a person | Money up; "Loans" up |
| Loan repaid | Paid back on a loan | Money down; "Loans" down |
| GST paid to government | GST paid with your return | Money down; "GST to pay" down |
| Equipment bought | Computer, furniture, vehicle, tools | Money down; "Equipment" up |
| Other income | Bank interest, scrap sold, commission | Money up; profit up |
| Cash put in the bank | Cash from the shop paid into the bank | Cash down, bank up |
| Cash taken from the bank | Cash drawn for the shop | Bank down, cash up |

Interest on a loan is a cost: enter it under **Expenses**, not as "Loan
repaid".

An entry cannot be edited. To correct a mistake, cancel it (a reason is
asked) and enter it again. Cancelled entries stay in the list but no longer
count.

## Cash or bank

Every payment in the app has a "paid by" choice. **Cash** is the shop's cash
box; **UPI, bank transfer, cheque and card** are the bank.

- A cash invoice now asks "Paid by". Cash invoices saved before this was added
  count as cash.
- A cash refund for returned goods counts as cash from the cash box.
- A cheque counts as in the bank on the day it is entered.

So that the two figures match the cash box and the bank passbook, enter the
**opening cash in hand** and the **opening bank balance** in Settings: what
the shop had on the day it started using ASM Books.

## Reports

- **Balance Sheet** shows cash in hand and bank on separate lines, and adds
  Equipment, Loans and the owner's own money. "GST to pay" is now less the
  GST already paid.
- **Cash Flow Statement** lists the banking entries under money in and money
  out, and splits the closing balance into cash and bank.
- **Profit and Loss** adds "Other income".

## Limits

- Equipment is shown at what was paid for it; no wear (depreciation) is taken
  off.
- There is one cash box and one bank figure; several bank accounts are not
  kept apart.
- Bank statements are not imported or matched.

## For developers

- Table `money_entries`; column `invoices.cash_mode` (migration `0019`).
- `src/lib/banking/entries.ts`: kinds and form rules.
- `src/server/money-entries.ts`: reads and writes (owner only).
- `src/server/statements.ts`: `cashMoves` adds up every source and how much
  of it was cash; `moneyToday` gives the two balances.
- `src/lib/reports/statements.ts`: the arithmetic, covered by unit tests.
