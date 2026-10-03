import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { PageContext } from "./audit";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIMEOUT_MS = 15_000;
const USER_AGENT = "SEOAuditBot/1.0 (+https://example.com/bot)";

export class AuditError extends Error {}

/**
 * Normalize what the user typed ("example.com", "http://example.com/page") into a URL.
 */
export function normalizeUrl(input: string): URL {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new AuditError("That doesn't look like a valid website address.");
  }
  if (!url.hostname.includes(".")) throw new AuditError("Please enter a full domain like example.com.");
  return url;
}

/**
 * SECURITY: Because anyone can type any URL, an attacker could ask our server to fetch
 * internal addresses (cloud metadata, databases, localhost). This is called SSRF.
 * We resolve the hostname and refuse private/reserved IP ranges.
 */
async function assertPublicHost(hostname: string) {
  const addrs = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true }).catch(() => {
    throw new AuditError(`Couldn't find a website at ${hostname}. Check the spelling.`);
  });
  for (const { address } of addrs) {
    if (isPrivateIp(address)) throw new AuditError("That address can't be audited.");
  }
}

export function isPrivateIp(ip: string): boolean {
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/** Fetch with timeout, size cap, and SSRF check on every redirect hop. */
async function safeFetch(url: URL, maxRedirects = 5): Promise<{ res: Response; finalUrl: URL }> {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") throw new AuditError("Only http and https sites can be audited.");
    if (process.env.ALLOW_PRIVATE_URLS !== "true") await assertPublicHost(current.hostname);
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,*/*" },
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current);
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new AuditError("The site redirected too many times.");
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new AuditError("That page is too large to audit."); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function tryText(url: URL): Promise<string | null> {
  try {
    const { res } = await safeFetch(url, 3);
    if (!res.ok) return null;
    const text = await readCapped(res);
    return text;
  } catch {
    return null;
  }
}

export async function fetchPage(input: string): Promise<{ html: string; ctx: PageContext }> {
  const url = normalizeUrl(input);
  const start = performance.now();
  let res: Response, finalUrl: URL;
  try {
    ({ res, finalUrl } = await safeFetch(url));
  } catch (e) {
    if (e instanceof AuditError) throw e;
    throw new AuditError(`We couldn't reach ${url.hostname}. The site may be down or blocking automated visitors.`);
  }
  if (!res.ok) throw new AuditError(`The site responded with an error (HTTP ${res.status}).`);
  const html = await readCapped(res);
  const responseTimeMs = Math.round(performance.now() - start);

  const origin = finalUrl.origin;
  const robotsTxt = await tryText(new URL("/robots.txt", origin));
  let sitemapFound = !!robotsTxt && /^\s*sitemap:/im.test(robotsTxt);
  if (!sitemapFound) {
    const sm = await tryText(new URL("/sitemap.xml", origin));
    sitemapFound = !!sm && /<(urlset|sitemapindex)/i.test(sm);
  }

  return {
    html,
    ctx: {
      url: url.toString(),
      finalUrl: finalUrl.toString(),
      responseTimeMs,
      pageSizeBytes: Buffer.byteLength(html),
      robotsTxt,
      sitemapFound,
    },
  };
}
