"use client";

import { useState } from "react";
import type { AuditResult, Check, Category } from "@/lib/audit";

const CATEGORIES: Category[] = ["Content", "Technical", "Mobile & Social", "Local Business"];
const ICON = { pass: "✓", warn: "!", fail: "✕" } as const;

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);

  async function runAudit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Audit failed.");
      else setResult(data);
    } catch {
      setError("Couldn't connect. Check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <h1>How well does Google see your business?</h1>
        <p className="sub">Free instant SEO audit. Get a score and a plain-English fix list in 10 seconds.</p>
        <form onSubmit={runAudit} className="audit-form">
          <input
            type="text"
            inputMode="url"
            placeholder="yourbusiness.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Website address"
            required
          />
          <button type="submit" disabled={loading}>{loading ? "Auditing…" : "Audit my site"}</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {result && <Report result={result} />}
    </main>
  );
}

function Report({ result }: { result: AuditResult }) {
  const counts = {
    fail: result.checks.filter((c) => c.status === "fail").length,
    warn: result.checks.filter((c) => c.status === "warn").length,
    pass: result.checks.filter((c) => c.status === "pass").length,
  };
  // Most important problems first.
  const priorities = result.checks
    .filter((c) => c.status !== "pass")
    .sort((a, b) => (a.status === b.status ? b.weight - a.weight : a.status === "fail" ? -1 : 1))
    .slice(0, 3);

  return (
    <section className="report">
      <div className="summary">
        <div className={`score grade-${result.grade}`}>
          <span className="num">{result.score}</span>
          <span className="grade">Grade {result.grade}</span>
        </div>
        <div>
          <h2>{new URL(result.finalUrl).hostname}</h2>
          <p className="counts">
            <span className="fail">{counts.fail} critical</span> ·{" "}
            <span className="warn">{counts.warn} to improve</span> ·{" "}
            <span className="pass">{counts.pass} passed</span>
          </p>
        </div>
      </div>

      {priorities.length > 0 && (
        <div className="priorities">
          <h3>Fix these first</h3>
          <ol>{priorities.map((c) => <li key={c.id}><strong>{c.title}:</strong> {c.fix}</li>)}</ol>
        </div>
      )}

      {CATEGORIES.map((cat) => (
        <div key={cat} className="category">
          <h3>{cat}</h3>
          {result.checks.filter((c) => c.category === cat).map((c) => <CheckRow key={c.id} check={c} />)}
        </div>
      ))}
    </section>
  );
}

function CheckRow({ check }: { check: Check }) {
  return (
    <div className={`check ${check.status}`}>
      <span className="icon" aria-label={check.status}>{ICON[check.status]}</span>
      <div>
        <div className="check-title">{check.title}</div>
        <div className="detail">{check.detail}</div>
        {check.fix && <div className="fix"><strong>How to fix:</strong> {check.fix}</div>}
      </div>
    </div>
  );
}
