# Quotes, sales orders, delivery challans and e-way bills

These live under **Sales** in the menu.

| Document | What it is for | Number |
| --- | --- | --- |
| Quote | A price offer to a customer, with a "valid until" date | `QT/26-27/0001` |
| Sales order | An order the customer has confirmed, with a "deliver by" date | `SO/26-27/0001` |
| Delivery challan | Goods sent without an invoice (on approval, job work, delivery first) | `DC/26-27/0001` |

The prefixes can be changed in **Settings**.

## What they do and do not do

- They use the same form as an invoice: customer, parts, price list and GST.
- They **never change stock or the customer's balance**. Only an invoice does.
- A quote can be for someone who is not a saved customer yet: choose "New name" and type the name.

## Moving from one to the next

Open a document and press a "Make …" button. The customer, the parts and the agreed prices are copied.

| From | Can become | What happens to the first document |
| --- | --- | --- |
| Quote | Sales order | The quote is closed |
| Quote | Invoice | The quote is closed and linked to the invoice |
| Sales order | Delivery challan | The order stays open, so more challans can follow |
| Sales order | Invoice | The order is closed and linked to the invoice |
| Delivery challan | Invoice | The challan is closed; the order it came from is closed too |

A document has one of three states: **open**, **closed** or **cancelled**. Only an open document can be edited.
"Mark as closed" finishes one without an invoice; "Reopen" brings it back, unless it became an invoice that is
still active.

## Transport and e-way bills

Every invoice and delivery challan has a **Transport and e-way bill** box: transporter, transporter ID, vehicle
number, how the goods travel, distance, and the e-way bill number with its dates. Saving it does not change any
amount, so it can be filled in after the invoice is saved. What is filled in prints on the document.

The app does **not** create the e-way bill. It is made on the government e-way bill website, and its 12-digit
number is then typed into the box.

**Sales › e-Way Bills** lists invoices and challans of ₹50,000 or more that have no e-way bill number yet, and
those that have one with the date it is valid until. The limit is `EWAY_BILL_LIMIT` in `src/lib/transport.ts`;
some states use a higher limit for movement inside the state.

## For developers

- Tables: `sales_docs` (with `kind` = `quote` | `order` | `challan`) and `sales_doc_lines`; `transport` is a
  JSON column on `invoices` and `sales_docs`.
- Rules shared by the three kinds are in `src/lib/sales-docs/`; saving is in `src/server/sales-doc-writes.ts`.
- The invoice form (`InvoiceEditor`) takes a `kind` and is reused for all three.
- Routes: `/sales/quotes`, `/sales/orders`, `/sales/challans`, `/eway-bills`.
