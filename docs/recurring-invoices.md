# Recurring invoices

For a customer you bill the same thing at a steady interval, such as a
monthly service contract or a standing order.

## How it works

1. Open an invoice that should repeat and press **Repeat**.
2. Choose how often (every week, month, 3 months, 6 months or year) and the
   date of the next invoice. An end date is optional.
3. When that date comes, the invoice shows as **due** under Recurring
   Invoices, on the bell and in Reminders.
4. Press **Create invoice**. A new invoice opens already filled in: the same
   customer, items and rates, with today's date. Check it, change anything
   that is different this time, and save.
5. Saving moves the recurring invoice on to its next date.

Nothing is billed on its own. A person always looks at the invoice before it
is saved, because a saved invoice takes stock off the shelf and can only be
cancelled, never deleted.

## Other buttons

- **Skip this one** leaves out the invoice that is due and moves to the next
  date.
- **Stop** ends the repeating. **Start again** resumes it from the next date
  that is not in the past; dates missed while stopped are not billed late.

## Rules

- Monthly and longer intervals fall on the same day of the month. In a
  shorter month the last day is used (the 31st becomes the 30th or the 28th)
  and the chosen day returns the month after.
- The rates are those of the invoice being repeated, not today's price list.
  Change a rate on the new invoice when the price has gone up.
- Walk-in and cancelled invoices cannot be repeated.
- If an invoice is made late, the next date still follows the plan (due
  1 Nov, made 13 Nov, next 1 Dec).
- After the end date nothing more becomes due and it shows as stopped.

## For developers

- Table `recurring_invoices` (migration `0020`).
- `src/lib/recurring/schedule.ts`: dates and form rules, with unit tests.
- `src/server/recurring.ts`: reads. `src/server/recurring-writes.ts`: writes,
  with `recordRecurringInvoice`, which `createInvoice` calls inside its own
  transaction when the new invoice carries a `repeatId`.
- `/invoices/new?repeat=<id>` opens the filled-in editor.
