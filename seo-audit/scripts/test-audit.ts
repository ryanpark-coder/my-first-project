// Quick sanity test for the audit engine: runs it on a bad page and a good page.
import { analyzeHtml } from "../lib/audit.ts";
import { isPrivateIp } from "../lib/fetch-page.ts";
import assert from "node:assert/strict";

const ctx = (url: string) => ({ url, finalUrl: url, responseTimeMs: 400, pageSizeBytes: 20000, robotsTxt: "User-agent: *\nAllow: /\nSitemap: https://x.com/sitemap.xml", sitemapFound: true });

const bad = analyzeHtml(`<html><head><meta name="robots" content="noindex"></head><body><img src=a.jpg><p>hi</p></body></html>`, ctx("http://bad.com/"));
const good = analyzeHtml(`<html lang="en"><head>
  <title>Emergency Plumber in Austin, TX | Smith Plumbing Co</title>
  <meta name="description" content="24/7 licensed plumbers serving Austin and Round Rock. Upfront pricing, same-day service. Call now for a free estimate.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://smith.com/"><link rel="icon" href="/f.ico">
  <meta property="og:title" content="x"><meta property="og:description" content="x"><meta property="og:image" content="x">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Smith"}</script>
</head><body><h1>Austin Plumber</h1><h2>Services</h2><img src=a.jpg alt="van">
<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a><a href="tel:5125551234">512-555-1234</a>
<p>${"word ".repeat(400)}</p></body></html>`, ctx("https://smith.com/"));

const by = (r: typeof bad, id: string) => r.checks.find((c) => c.id === id)!.status;
assert.equal(by(bad, "indexable"), "fail");
assert.equal(by(bad, "https"), "fail");
assert.equal(by(bad, "title"), "fail");
assert.equal(by(bad, "img-alt"), "fail");
assert.ok(good.checks.every((c) => c.status === "pass"), JSON.stringify(good.checks.filter((c) => c.status !== "pass"), null, 2));
assert.equal(good.score, 100);
assert.ok(bad.score < 40, `bad score ${bad.score}`);

for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "169.254.169.254", "172.20.0.1", "::1", "::ffff:127.0.0.1", "fd00::1"]) assert.ok(isPrivateIp(ip), ip);
for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) assert.ok(!isPrivateIp(ip), ip);

console.log(`✓ all checks passed (bad site scored ${bad.score}/100 grade ${bad.grade}, good site scored ${good.score}/100)`);
