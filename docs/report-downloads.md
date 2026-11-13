# Downloading and printing reports

Every report has two buttons beside its title.

- **Excel** downloads the report as a `.csv` file. Excel, Google Sheets and
  LibreOffice open it directly. The file covers the same period or date that
  is on screen.
- **Print / PDF** opens the browser's print box. Choose "Save as PDF" there to
  keep a PDF.

## What is in the file

The first two lines are the report name and its period. The table follows
after one empty line.

- Amounts are plain numbers with no ₹ sign or commas, so a spreadsheet can add
  them up.
- Dates are written year first (`2026-11-13`), which every spreadsheet reads
  the same way.
- **Sales by Item** on screen shows the 300 best sellers. The file has every
  item sold in the period.

## Who can download

The same people who can see the report: the owner for all reports, and staff
for Low Stock only. A link to a file does not work without signing in.

## Safety

A name that starts with `=`, `+`, `-` or `@` is written with a leading
apostrophe, so a spreadsheet shows it as text and never runs it as a formula.

## For developers

- `src/lib/reports/csv.ts` turns rows into CSV text.
- `src/server/report-exports.ts` lists the reports and builds their rows from
  the same functions the screens use.
- `src/app/(app)/reports/download/[report]/route.ts` sends the file.
- `src/components/reports/report-tools.tsx` is the pair of buttons; it builds
  the link from the address bar, so new reports get the buttons by adding one
  entry to `report-exports.ts`.
