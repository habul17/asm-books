import { describe, expect, it } from "vitest";

import {
  downloadName,
  formatBytes,
  parseDocumentDetails,
  parseDocumentLink,
  sniffMimeType,
  titleFromFileName,
} from "./documents";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const form = (data: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
};

describe("sniffMimeType", () => {
  it("knows photos and PDFs by their first bytes", () => {
    expect(sniffMimeType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffMimeType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(sniffMimeType(new TextEncoder().encode("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("refuses everything else, whatever it is called", () => {
    expect(sniffMimeType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMimeType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(sniffMimeType(new TextEncoder().encode("RIFF1234WAVEfmt "))).toBeNull();
    expect(sniffMimeType(new Uint8Array())).toBeNull();
  });
});

describe("names", () => {
  it("makes a title from a file name", () => {
    expect(titleFromFileName("C:\\Users\\a\\IMG_2041.JPG")).toBe("IMG 2041");
    expect(titleFromFileName("../../etc/rent  receipt.nov.pdf")).toBe("rent receipt.nov");
    expect(titleFromFileName(".pdf")).toBe("Document");
  });

  it("makes a safe download name with the right extension", () => {
    expect(downloadName('Rent "Nov"/2026', "application/pdf")).toBe("Rent Nov2026.pdf");
    expect(downloadName("scan.jpg", "image/jpeg")).toBe("scan.jpg");
    expect(downloadName("வாடகை ரசீது", "image/png")).toBe("வாடகை ரசீது.png");
    expect(downloadName("\r\n", "image/png")).toBe("document.png");
  });

  it("shows sizes in plain units", () => {
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(350 * 1024)).toBe("350 KB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});

describe("parseDocumentDetails", () => {
  it("accepts a filled form", () => {
    expect(parseDocumentDetails(form({ title: " Rent Nov ", folder: "receipts", docDate: "2026-11-01", notes: "", ownerOnly: "on" })).value).toEqual({
      title: "Rent Nov",
      folder: "receipts",
      docDate: "2026-11-01",
      notes: "",
      ownerOnly: true,
    });
  });

  it("needs a name and a real folder", () => {
    expect(parseDocumentDetails(form({ title: " ", folder: "bank" })).error).toBe("Give the document a name");
    expect(parseDocumentDetails(form({ title: "x", folder: "secret" })).error).toBe("Choose a folder");
    expect(parseDocumentDetails(form({ title: "x", folder: "bank" })).value).toMatchObject({ docDate: null, ownerOnly: false });
  });
});

describe("parseDocumentLink", () => {
  it("reads one link at most", () => {
    expect(parseDocumentLink(form({ billId: "12" }))).toEqual({ billId: 12 });
    expect(parseDocumentLink(form({ expenseId: "7" }))).toEqual({ expenseId: 7 });
    expect(parseDocumentLink(form({ billId: "-1", expenseId: "abc" }))).toBeNull();
    expect(parseDocumentLink(form({}))).toBeNull();
  });
});
