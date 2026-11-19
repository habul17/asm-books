import { describe, expect, it } from "vitest";

import { isSafeNoteBody, noteFileIds, noteGroup, type NoteNode, noteSummary, parseFolderKey } from "./notes";

const doc = (...content: object[]) => ({ type: "doc", content }) as NoteNode;
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const fileId = "0123456789abcdef0123456789abcdef";

describe("isSafeNoteBody", () => {
  it("accepts a normal note", () => {
    const body = doc(
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Order" }] },
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [p("Brake pads")] }] },
      { type: "noteImage", attrs: { fileId, encrypted: false } },
      { type: "paragraph", content: [{ type: "text", text: "site", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }] },
    );
    expect(isSafeNoteBody(body)).toBe(true);
  });

  it("refuses script links, unknown parts and bad file ids", () => {
    const js = doc({ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] });
    expect(isSafeNoteBody(js)).toBe(false);
    expect(isSafeNoteBody(doc({ type: "iframe" }))).toBe(false);
    expect(isSafeNoteBody(doc({ type: "noteImage", attrs: { fileId: "../../etc" } }))).toBe(false);
    expect(isSafeNoteBody({ type: "paragraph" })).toBe(false);
    expect(isSafeNoteBody(null)).toBe(false);
  });

  it("refuses bodies nested too deep", () => {
    let n: object = p("deep");
    for (let i = 0; i < 50; i++) n = { type: "blockquote", content: [n] };
    expect(isSafeNoteBody(doc(n))).toBe(false);
  });
});

describe("noteSummary", () => {
  it("takes the first line as title and the next as preview", () => {
    const s = noteSummary(doc({ type: "heading", attrs: { level: 1 } }, p("  Call   Ravi "), p(""), p("about 2102 stock")));
    expect(s).toEqual({ title: "Call Ravi", preview: "about 2102 stock", searchText: "Call Ravi\nabout 2102 stock" });
  });

  it("is empty for an empty note and shows Photo for a photo-only line", () => {
    expect(noteSummary(doc({ type: "heading", attrs: { level: 1 } })).title).toBe("");
    expect(noteSummary(doc(p("Shelf"), { type: "noteImage", attrs: { fileId } })).preview).toBe("Photo");
  });
});

it("lists the files a note uses", () => {
  expect(noteFileIds(doc(p("a"), { type: "noteFile", attrs: { fileId } }))).toEqual([fileId]);
});

describe("noteGroup", () => {
  const now = new Date("2026-11-20T10:00:00+05:30");
  it("groups like Apple Notes", () => {
    expect(noteGroup(new Date("2026-11-20T08:00:00+05:30"), true, now).label).toBe("Pinned");
    expect(noteGroup(new Date("2026-11-20T08:00:00+05:30"), false, now).label).toBe("Today");
    expect(noteGroup(new Date("2026-11-19T23:00:00+05:30"), false, now).label).toBe("Yesterday");
    expect(noteGroup(new Date("2026-11-15T12:00:00+05:30"), false, now).label).toBe("Previous 7 Days");
    expect(noteGroup(new Date("2026-10-25T12:00:00+05:30"), false, now).label).toBe("Previous 30 Days");
    expect(noteGroup(new Date("2026-08-01T12:00:00+05:30"), false, now).label).toBe("August");
    expect(noteGroup(new Date("2025-08-01T12:00:00+05:30"), false, now).label).toBe("August 2025");
  });
});

it("reads folder keys from the address", () => {
  expect(parseFolderKey("all")).toBe("all");
  expect(parseFolderKey("12")).toBe(12);
  expect(parseFolderKey("0")).toBeNull();
  expect(parseFolderKey("x")).toBeNull();
});

it("accepts voice notes and lists them as a line", () => {
  const body = doc(p("Call notes"), { type: "noteAudio", attrs: { fileId, encrypted: false, duration: 12 } });
  expect(isSafeNoteBody(body)).toBe(true);
  expect(noteSummary(body)).toMatchObject({ title: "Call notes", preview: "Voice note" });
  expect(noteFileIds(body)).toEqual([fileId]);
});
