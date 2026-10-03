import { NextResponse } from "next/server";
import { analyzeHtml } from "@/lib/audit";
import { AuditError, fetchPage } from "@/lib/fetch-page";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url) return NextResponse.json({ error: "Please enter a website address." }, { status: 400 });

  try {
    const { html, ctx } = await fetchPage(url);
    return NextResponse.json(analyzeHtml(html, ctx));
  } catch (e) {
    const message = e instanceof AuditError ? e.message : "Something went wrong running the audit. Please try again.";
    if (!(e instanceof AuditError)) console.error(e);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
