import * as cheerio from "cheerio";

export type Status = "pass" | "warn" | "fail";
export type Category = "Content" | "Technical" | "Mobile & Social" | "Local Business";

export interface Check {
  id: string;
  category: Category;
  title: string;
  status: Status;
  /** How much this check counts toward the overall score. */
  weight: number;
  /** What we found, in plain language. */
  detail: string;
  /** What the business owner should do about it (empty when passing). */
  fix: string;
}

export interface AuditResult {
  url: string;
  finalUrl: string;
  score: number;
  grade: string;
  fetchedAt: string;
  responseTimeMs: number;
  pageSizeKb: number;
  checks: Check[];
}

/** Extra facts gathered outside the HTML itself (HTTP response, robots.txt, sitemap). */
export interface PageContext {
  url: string;
  finalUrl: string;
  responseTimeMs: number;
  pageSizeBytes: number;
  robotsTxt: string | null;
  sitemapFound: boolean;
}

const LOCAL_BUSINESS_TYPES = [
  "LocalBusiness", "Organization", "Restaurant", "Store", "ProfessionalService",
  "HomeAndConstructionBusiness", "MedicalBusiness", "LegalService", "AutomotiveBusiness",
  "FoodEstablishment", "HealthAndBeautyBusiness", "FinancialService", "RealEstateAgent",
  "Dentist", "Physician", "Plumber", "Electrician", "HVACBusiness", "Attorney",
];

/**
 * Analyze a page's HTML. This is pure (no network), which makes it easy to test.
 */
export function analyzeHtml(html: string, ctx: PageContext): AuditResult {
  const $ = cheerio.load(html);
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // ---------- Content ----------
  const title = $("head title").first().text().trim();
  if (!title) {
    add({ id: "title", category: "Content", title: "Page title", status: "fail", weight: 10,
      detail: "Your page has no <title> tag.",
      fix: "Add a title of 30–60 characters that includes your main service and city, e.g. \"Emergency Plumber in Austin, TX | Smith Plumbing\"." });
  } else if (title.length < 30 || title.length > 60) {
    add({ id: "title", category: "Content", title: "Page title", status: "warn", weight: 10,
      detail: `Your title is ${title.length} characters: "${title}".`,
      fix: title.length < 30
        ? "Lengthen your title to 30–60 characters. Include what you do and where you do it."
        : "Shorten your title to 60 characters or less so Google doesn't cut it off in search results." });
  } else {
    add({ id: "title", category: "Content", title: "Page title", status: "pass", weight: 10,
      detail: `Good length (${title.length} characters): "${title}".`, fix: "" });
  }

  const desc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!desc) {
    add({ id: "meta-description", category: "Content", title: "Meta description", status: "fail", weight: 8,
      detail: "No meta description found. Google will pick random text from your page for search results.",
      fix: "Add a 70–160 character description that sells your business and includes a call to action." });
  } else if (desc.length < 70 || desc.length > 160) {
    add({ id: "meta-description", category: "Content", title: "Meta description", status: "warn", weight: 8,
      detail: `Your description is ${desc.length} characters.`,
      fix: "Aim for 70–160 characters so it fills the search snippet without getting cut off." });
  } else {
    add({ id: "meta-description", category: "Content", title: "Meta description", status: "pass", weight: 8,
      detail: `Good length (${desc.length} characters).`, fix: "" });
  }

  const h1s = $("h1");
  if (h1s.length === 0) {
    add({ id: "h1", category: "Content", title: "Main heading (H1)", status: "fail", weight: 8,
      detail: "No H1 heading found.",
      fix: "Add exactly one H1 near the top of the page that says what you do, e.g. \"Family Dentist in Denver\"." });
  } else if (h1s.length > 1) {
    add({ id: "h1", category: "Content", title: "Main heading (H1)", status: "warn", weight: 8,
      detail: `Found ${h1s.length} H1 headings. Search engines expect one clear main heading.`,
      fix: "Keep one H1 for the page's main topic and change the others to H2 or H3." });
  } else {
    add({ id: "h1", category: "Content", title: "Main heading (H1)", status: "pass", weight: 8,
      detail: `One H1: "${h1s.first().text().trim().slice(0, 80)}".`, fix: "" });
  }

  const h2Count = $("h2").length;
  add(h2Count > 0
    ? { id: "subheadings", category: "Content", title: "Subheadings (H2)", status: "pass", weight: 3,
        detail: `${h2Count} H2 subheadings structure your content.`, fix: "" }
    : { id: "subheadings", category: "Content", title: "Subheadings (H2)", status: "warn", weight: 3,
        detail: "No H2 subheadings found.",
        fix: "Break your content into sections with H2 headings (e.g. \"Our Services\", \"Service Areas\", \"Reviews\")." });

  const bodyText = $("body").clone().find("script, style, noscript").remove().end().text();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  add(wordCount >= 300
    ? { id: "word-count", category: "Content", title: "Amount of content", status: "pass", weight: 6,
        detail: `About ${wordCount} words on the page.`, fix: "" }
    : { id: "word-count", category: "Content", title: "Amount of content", status: wordCount >= 150 ? "warn" : "fail", weight: 6,
        detail: `Only about ${wordCount} words on the page. Thin pages rarely rank.`,
        fix: "Aim for 300+ words describing your services, service area, experience, and answers to common customer questions." });

  const imgs = $("img");
  const missingAlt = imgs.filter((_, el) => !($(el).attr("alt") ?? "").trim()).length;
  if (imgs.length === 0) {
    add({ id: "img-alt", category: "Content", title: "Image alt text", status: "pass", weight: 5,
      detail: "No images found on the page.", fix: "" });
  } else if (missingAlt === 0) {
    add({ id: "img-alt", category: "Content", title: "Image alt text", status: "pass", weight: 5,
      detail: `All ${imgs.length} images have alt text.`, fix: "" });
  } else {
    add({ id: "img-alt", category: "Content", title: "Image alt text", status: missingAlt / imgs.length > 0.5 ? "fail" : "warn", weight: 5,
      detail: `${missingAlt} of ${imgs.length} images are missing alt text.`,
      fix: "Describe each image in its alt attribute (e.g. alt=\"Technician repairing AC unit\"). It helps Google Images and accessibility." });
  }

  const host = new URL(ctx.finalUrl).hostname;
  let internalLinks = 0;
  $("a[href]").each((_, el) => {
    try {
      const u = new URL($(el).attr("href")!, ctx.finalUrl);
      if (u.hostname === host) internalLinks++;
    } catch { /* ignore malformed links */ }
  });
  add(internalLinks >= 3
    ? { id: "internal-links", category: "Content", title: "Internal links", status: "pass", weight: 3,
        detail: `${internalLinks} links to other pages on your site.`, fix: "" }
    : { id: "internal-links", category: "Content", title: "Internal links", status: "warn", weight: 3,
        detail: `Only ${internalLinks} internal links found.`,
        fix: "Link to your key pages (services, contact, about) so Google can discover and understand them." });

  // ---------- Technical ----------
  const isHttps = ctx.finalUrl.startsWith("https://");
  add(isHttps
    ? { id: "https", category: "Technical", title: "Secure connection (HTTPS)", status: "pass", weight: 10,
        detail: "Your site loads over HTTPS.", fix: "" }
    : { id: "https", category: "Technical", title: "Secure connection (HTTPS)", status: "fail", weight: 10,
        detail: "Your site does not use HTTPS. Browsers show it as \"Not Secure\" and Google ranks it lower.",
        fix: "Turn on a free SSL certificate through your web host (most offer Let's Encrypt in one click) and redirect HTTP to HTTPS." });

  const robotsMeta = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
  add(robotsMeta.includes("noindex")
    ? { id: "indexable", category: "Technical", title: "Visible to Google", status: "fail", weight: 15,
        detail: "This page has a \"noindex\" tag. Google is being told NOT to show it in search results.",
        fix: "Remove the noindex robots meta tag (in WordPress: Settings → Reading → uncheck \"Discourage search engines\")." }
    : { id: "indexable", category: "Technical", title: "Visible to Google", status: "pass", weight: 15,
        detail: "Nothing on the page blocks search engines from indexing it.", fix: "" });

  const canonical = $('link[rel="canonical"]').attr("href");
  add(canonical
    ? { id: "canonical", category: "Technical", title: "Canonical URL", status: "pass", weight: 3,
        detail: `Canonical set to ${canonical}.`, fix: "" }
    : { id: "canonical", category: "Technical", title: "Canonical URL", status: "warn", weight: 3,
        detail: "No canonical tag found.",
        fix: "Add <link rel=\"canonical\" href=\"...\"> pointing to the preferred URL to avoid duplicate-content issues." });

  if (ctx.robotsTxt === null) {
    add({ id: "robots-txt", category: "Technical", title: "robots.txt", status: "warn", weight: 3,
      detail: "No robots.txt file found.",
      fix: "Add a robots.txt file at your site root that allows crawling and lists your sitemap." });
  } else if (/^\s*disallow:\s*\/\s*$/im.test(ctx.robotsTxt) && /user-agent:\s*\*/i.test(ctx.robotsTxt)) {
    add({ id: "robots-txt", category: "Technical", title: "robots.txt", status: "fail", weight: 3,
      detail: "Your robots.txt appears to block all search engines from your entire site (\"Disallow: /\").",
      fix: "Remove the \"Disallow: /\" rule unless you intentionally want to hide your whole site." });
  } else {
    add({ id: "robots-txt", category: "Technical", title: "robots.txt", status: "pass", weight: 3,
      detail: "robots.txt found and doesn't block your site.", fix: "" });
  }

  add(ctx.sitemapFound
    ? { id: "sitemap", category: "Technical", title: "XML sitemap", status: "pass", weight: 4,
        detail: "Sitemap found.", fix: "" }
    : { id: "sitemap", category: "Technical", title: "XML sitemap", status: "warn", weight: 4,
        detail: "No sitemap found at /sitemap.xml or in robots.txt.",
        fix: "Generate a sitemap (most site builders and SEO plugins do this automatically) and submit it in Google Search Console." });

  const secs = ctx.responseTimeMs / 1000;
  add({ id: "speed", category: "Technical", title: "Server response time", weight: 6,
    status: secs < 1 ? "pass" : secs < 2.5 ? "warn" : "fail",
    detail: `The page's HTML took ${secs.toFixed(2)}s to download.`,
    fix: secs < 1 ? "" : "Slow pages lose visitors and rankings. Consider faster hosting, caching, or a CDN." });

  const kb = ctx.pageSizeBytes / 1024;
  add({ id: "page-size", category: "Technical", title: "HTML page size", weight: 2,
    status: kb < 500 ? "pass" : "warn",
    detail: `HTML is ${kb.toFixed(0)} KB.`,
    fix: kb < 500 ? "" : "Your HTML is heavy. Remove unused code, inline scripts, or page-builder bloat." });

  const lang = $("html").attr("lang");
  add(lang
    ? { id: "lang", category: "Technical", title: "Language declared", status: "pass", weight: 2,
        detail: `Page language is "${lang}".`, fix: "" }
    : { id: "lang", category: "Technical", title: "Language declared", status: "warn", weight: 2,
        detail: "No lang attribute on the <html> tag.",
        fix: "Add lang=\"en\" (or your language) to the <html> tag." });

  // ---------- Mobile & Social ----------
  const viewport = $('meta[name="viewport"]').attr("content") ?? "";
  add(viewport.includes("width=device-width")
    ? { id: "viewport", category: "Mobile & Social", title: "Mobile friendly", status: "pass", weight: 10,
        detail: "Page is set up for mobile screens.", fix: "" }
    : { id: "viewport", category: "Mobile & Social", title: "Mobile friendly", status: "fail", weight: 10,
        detail: "No mobile viewport tag. Your site likely looks tiny and zoomed out on phones, and Google ranks mobile-first.",
        fix: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> and use a responsive theme." });

  const og = ["og:title", "og:description", "og:image"].filter((p) => $(`meta[property="${p}"]`).length > 0);
  add({ id: "open-graph", category: "Mobile & Social", title: "Social sharing preview", weight: 3,
    status: og.length === 3 ? "pass" : og.length > 0 ? "warn" : "fail",
    detail: og.length === 3 ? "Open Graph tags are set, so links look good on Facebook, LinkedIn, and in texts."
      : `Found ${og.length} of 3 key Open Graph tags (og:title, og:description, og:image).`,
    fix: og.length === 3 ? "" : "Add Open Graph tags so your link shows a title, description, and image when shared." });

  const favicon = $('link[rel~="icon"]').length > 0;
  add(favicon
    ? { id: "favicon", category: "Mobile & Social", title: "Favicon", status: "pass", weight: 1,
        detail: "Favicon found.", fix: "" }
    : { id: "favicon", category: "Mobile & Social", title: "Favicon", status: "warn", weight: 1,
        detail: "No favicon declared.", fix: "Add a small logo icon. Google shows it next to your site in mobile results." });

  // ---------- Local Business ----------
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collectTypes(JSON.parse($(el).text()), schemaTypes);
    } catch { /* invalid JSON-LD is ignored */ }
  });
  const hasBusinessSchema = schemaTypes.some((t) => LOCAL_BUSINESS_TYPES.includes(t));
  add(hasBusinessSchema
    ? { id: "schema", category: "Local Business", title: "Business structured data", status: "pass", weight: 6,
        detail: `Structured data found: ${[...new Set(schemaTypes)].join(", ")}.`, fix: "" }
    : { id: "schema", category: "Local Business", title: "Business structured data", status: "fail", weight: 6,
        detail: schemaTypes.length ? `Structured data found (${[...new Set(schemaTypes)].join(", ")}) but no business type.`
          : "No structured data (schema.org) found.",
        fix: "Add LocalBusiness JSON-LD with your name, address, phone, hours, and service area. It helps you show up in Google Maps and rich results." });

  const hasTel = $('a[href^="tel:"]').length > 0;
  const phoneInText = /(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(bodyText);
  add(hasTel
    ? { id: "phone", category: "Local Business", title: "Click-to-call phone number", status: "pass", weight: 4,
        detail: "Phone number is tappable on mobile.", fix: "" }
    : { id: "phone", category: "Local Business", title: "Click-to-call phone number", status: phoneInText ? "warn" : "fail", weight: 4,
        detail: phoneInText ? "A phone number appears on the page but isn't a clickable link." : "No phone number found on the page.",
        fix: "Show your phone number prominently and wrap it in a tel: link so mobile visitors can call in one tap." });

  // ---------- Score ----------
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + c.weight * (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0);
  const score = Math.round((earned / total) * 100);

  return {
    url: ctx.url,
    finalUrl: ctx.finalUrl,
    score,
    grade: score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F",
    fetchedAt: new Date().toISOString(),
    responseTimeMs: ctx.responseTimeMs,
    pageSizeKb: Math.round(ctx.pageSizeBytes / 1024),
    checks,
  };
}

function collectTypes(node: unknown, out: string[]) {
  if (Array.isArray(node)) return node.forEach((n) => collectTypes(n, out));
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.push(t);
    if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.push(x));
    if (obj["@graph"]) collectTypes(obj["@graph"], out);
  }
}
