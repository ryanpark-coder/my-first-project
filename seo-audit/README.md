# SEO Audit: website checkup for small businesses

Type in a business website and get a 0–100 score, a letter grade, and a plain-English fix list.

## Run it on your computer

```bash
cd seo-audit
npm install
npm run dev        # open http://localhost:3000
npm test           # checks the audit engine
```

## How it's built

| File | What it does |
|---|---|
| `lib/fetch-page.ts` | Downloads the customer's page, robots.txt, and sitemap. Blocks internal/private addresses (SSRF protection), with a timeout and size limit. |
| `lib/audit.ts` | **The product.** Runs 20 SEO checks across Content, Technical, Mobile & Social, and Local Business, then calculates a weighted score. |
| `app/api/audit/route.ts` | The API endpoint the page calls. |
| `app/page.tsx` | The landing page and the report. |

To add a new check, add one `add({...})` block in `lib/audit.ts`. Its `weight` sets how much it counts toward the score.

---

## Roadmap: from prototype to paid product

### ✅ Step 1: Working audit engine (done)
20 on-page checks, a score, a "fix these first" list, and protection against abuse.

### Step 2: Put it online (about 1 hour, free)
1. Create a free account at [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New → Project**, pick this repo, and set **Root Directory** to `seo-audit`.
3. Click **Deploy**. You get a live URL like `seo-audit-xyz.vercel.app`.
4. Buy a domain (around $12/year at Namecheap, Cloudflare, or Porkbun) and connect it under **Project → Settings → Domains**.

### Step 3: Make the audit worth paying for
The free checks (Step 1) are what any competitor offers. Paid value comes from:
- **Real speed scores** from Google's free [PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started): Core Web Vitals and mobile performance. Get a free API key.
- **Multi-page crawl**: audit up to 50–500 pages, not only the homepage. This finds broken links, duplicate titles, and orphan pages.
- **AI-written recommendations**: send the results to the Claude API so it writes custom title and description rewrites for that business.
- **PDF report** with the business's name and logo. Agencies love these.
- **Google Business Profile and local checks**: is the name, address, and phone consistent with the Google listing?

### Step 4: Accounts and a database
- **Auth:** [Clerk](https://clerk.com) or [Supabase Auth](https://supabase.com) for sign-up and login.
- **Database:** [Supabase](https://supabase.com) (Postgres) to save each customer's audits so they can see their score improve over time.

### Step 5: Take payments
- Create a [Stripe](https://stripe.com) account and use **Stripe Checkout** (Stripe hosts the payment page, so you never handle card numbers).
- Use a **Stripe webhook** to mark a user as "paid" in your database.
- Suggested pricing to test:
  - **Free:** homepage score plus the top 3 issues (this is your lead magnet; collect their email to show the full report).
  - **One-time report, $29–49:** full multi-page audit, PDF, and AI fixes.
  - **Monthly, $19–49/mo:** weekly re-audits, email alerts when something breaks, score history.
  - **Agency, $99–199/mo:** white-label PDFs and 10–25 client sites.

### Step 6: Protect your costs
- **Rate limiting:** cap free audits per IP per day (e.g. [Upstash Ratelimit](https://upstash.com)) so bots can't run up your bill.
- **CAPTCHA:** add [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) on the free form.
- **Background jobs:** multi-page crawls take minutes, so run them in a queue (Inngest, Trigger.dev) instead of in the API request.

### Step 7: Legal and business basics
- Terms of Service and a Privacy Policy (Termly or iubenda generate these).
- Register a business (an LLC is common in the US) and open a separate bank account before taking real money.
- Don't promise rankings. Sell the *audit and the fixes*, not "#1 on Google."

### Step 8: Get customers
- Your own site must score 100 on your own tool, and it should rank for "free SEO audit [industry]".
- Cold outreach: audit local businesses and email them their score ("Your site scored 52/100, here are 3 quick fixes").
- Partner with web designers and agencies through the agency plan.
