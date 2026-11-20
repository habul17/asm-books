import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const FONT_DIR = path.join(process.cwd(), "src/server/pdf-fonts");

let fontCss: Promise<string> | null = null;

/**
 * The invoice prints in Courier New. The server has no such font, so the same
 * name is pointed at Liberation Mono (same letter widths), with Noto Sans for
 * the rupee sign. Fonts are inlined so nothing is fetched from outside.
 */
function invoiceFontCss(): Promise<string> {
  fontCss ??= (async () => {
    const face = async (file: string, weight: number, range?: string) => {
      const data = (await readFile(path.join(FONT_DIR, file))).toString("base64");
      return `@font-face{font-family:"Courier New";font-weight:${weight};src:url(data:font/ttf;base64,${data}) format("truetype");${range ? `unicode-range:${range};` : ""}}`;
    };
    const faces = await Promise.all([
      face("LiberationMono-Regular.ttf", 400),
      face("LiberationMono-Bold.ttf", 700),
      face("NotoSans-Bold.ttf", 400, "U+20B9"),
      face("NotoSans-Bold.ttf", 700, "U+20B9"),
    ]);
    return faces.join("\n");
  })();
  return fontCss;
}

/**
 * Prints a page of this app to an A4 PDF, exactly as the browser's Print does,
 * by opening it in a headless browser signed in with the caller's own session.
 * `origin` must be this app's own address; the session cookie is only ever
 * sent there.
 */
export async function printPageToPdf(origin: string, pathname: string, cookie: { name: string; value: string }) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    defaultViewport: { width: 1024, height: 1400 },
  });
  try {
    const page = await browser.newPage();
    // Only this app's own pages and files load; anything else is blocked.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith(`${origin}/`) || url.startsWith("data:") || url.startsWith("blob:")) void req.continue();
      else void req.abort();
    });
    // Set by address, not domain, so a "__Host-" session cookie is accepted.
    await page.setCookie({
      name: cookie.name,
      value: cookie.value,
      url: origin,
      path: "/",
      httpOnly: true,
      secure: origin.startsWith("https:"),
      sameSite: "Lax",
    });
    const response = await page.goto(`${origin}${pathname}`, { waitUntil: "networkidle0", timeout: 30_000 });
    if (!response?.ok() || new URL(page.url()).pathname !== pathname) throw new Error("The invoice page did not open.");
    await page.addStyleTag({ content: await invoiceFontCss() });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
