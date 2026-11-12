# Balance Sheet and Cash Flow Statement

Both are under **Reports** and are for the owner only.

ASM Books keeps no ledger of accounts. The two statements are worked out, each
time they are opened, from what is entered in the app: invoices, payments,
bills, expenses, returns and stock. Cancelled entries are never counted.

## Balance Sheet

Shows what the business has and what it owes at the end of a chosen day
(today, the end of last month, the end of last financial year, or any date).

**Assets**

- **Cash and bank** — the opening balance from Settings, plus cash sales and
  payments received, less payments to vendors, expenses and cash refunds.
- **Customers owe you** — every customer who owes money, added up.
- **Paid in advance to vendors** — vendors who were paid more than billed.
- **Stock in hand** — the stock each part had on that day, at its purchase
  price on that day, before GST. A part with no purchase price, or with stock
  below zero, counts as ₹0 and the report says how many there are.
- **GST credit** — shown when GST paid on purchases and expenses is more than
  GST charged on sales.

**Liabilities**

- **You owe vendors** — every vendor the shop owes, added up.
- **Advances from customers** — customers who paid more than they were billed.
- **GST to pay** — shown when GST charged on sales is more than GST paid on
  purchases and expenses.

**Capital** is what is left for the owner: total assets less total
liabilities. It is split into the profit of the current financial year (the
same figure as the Profit and Loss report from 1 April to the chosen day) and
"capital and earlier profit", which is the balancing figure. Because of this
the two sides always agree.

## Cash Flow Statement

Shows, for a period, the money that came in (cash sales, payments from
customers) and went out (payments to vendors, expenses with their GST, cash
refunds), the net cash flow, and the cash and bank balance at the start and
the end of the period. The end balance of a period equals the Balance Sheet's
cash and bank figure for that day.

## The opening balance

**Settings → Reports → Opening cash and bank balance** is the money the shop
had in hand and in the bank on the day it started using ASM Books. Both
statements count from it. Until it is set it counts as ₹0.

## What is not shown

These are not entered anywhere in the app, so the statements leave them out:

- money the owner puts into the business or takes out of it,
- loans taken or repaid,
- equipment, furniture and vehicles,
- GST paid to the government.

Until they can be entered, the cash figure shows higher than the real cash and
bank balance, and GST to pay shows the whole difference since the start. The
two errors are on both sides, so the totals still agree, but the statements
are a working view of the business and not a replacement for the accountant's
books.

## AR Aging Summary

Also under **Reports**. It shows what customers owe today, split by how old
the unpaid bills are: 0–30 days, 31–60 days, 61–90 days and over 90 days, with
a total for all customers and a row for each customer who owes money.

- Age is counted from the bill date.
- Payments are not tied to single bills, so they are counted against the
  oldest bills first. What is left unpaid is the newest bills.
- An opening balance is aged from the day the customer was added.
- The total equals "Customers owe you" on the Balance Sheet and the Customer
  Balances report, except that customers owing less than one rupee are left
  out.

