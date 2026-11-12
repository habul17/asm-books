# Purchase orders

A purchase order is the list of parts the shop asks a vendor to send. It is
found under **Purchases → Purchase Orders**.

A purchase order never changes stock and never changes what the shop owes the
vendor. Only the **bill**, entered when the parts arrive, does that.

## Making one

1. Open **Purchase Orders** and choose **New purchase order** (or **New order**
   on a vendor's page).
2. Pick the vendor, the order date and, if known, the date the parts are
   expected.
3. Add the parts. Each rate starts at the part's last purchase price and can be
   changed to the rate the vendor quoted.
4. Save. The order gets the next number, for example `PO/26-27/0001`. The
   prefix can be changed in **Settings**.

The saved order can be printed and sent to the vendor. GST is worked out from
the vendor's state, the same way as on a bill. The shop's bank details and sale
terms are not printed on it.

## When the parts arrive

Open the order and choose **Enter bill**. The bill form opens with the vendor
and every row filled in. Type the vendor's bill number, change the rows to
match what really arrived, and save.

- The bill adds the parts to stock and to what the shop owes, as any bill does.
- The order is marked **closed** and shows a link to the bill.
- The bill shows a link back to the order.

The bill can also be scanned as usual; it stays linked to the order.

## Status

| Status    | Meaning                                              |
| --------- | ---------------------------------------------------- |
| open      | Sent to the vendor; parts are still to come.         |
| closed    | Finished. Set by entering a bill, or by hand.        |
| cancelled | The order was called off. It cannot be used again.   |

- Only an **open** order can be edited, closed or cancelled.
- A **closed** order can be reopened, for example when only part of the order
  arrived. A second bill can then be entered for the rest.
- An order that has a bill cannot be cancelled; mark it as closed instead.

## What it does not do

- It does not track how much of each row has arrived. When part of an order
  arrives, edit the bill rows to what came and reopen the order for the rest.
- It does not send the order to the vendor. Print it, or save it as a PDF from
  the print window, and send it yourself.
