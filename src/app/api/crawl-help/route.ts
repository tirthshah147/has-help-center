import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

/* ─── crawler helpers ───────────────────────────────────────── */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html')) return null
    return res.text()
  } catch {
    return null
  }
}

/**
 * Recursively crawl every URL that begins with the help‑center root.
 * Fragment identifiers ("#section") are stripped immediately so we never
 * crawl the same page twice and the final list is deduplicated.
 */
async function crawlHelpCenter(
  root: string,
  maxPages = Infinity,
): Promise<string[]> {
  const base = root.endsWith('/') ? root.slice(0, -1) : root // no trailing slash
  const queue: string[] = [base]
  const visited = new Set<string>()
  const pages = new Set<string>()

  while (queue.length && visited.size < maxPages) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    pages.add(current)

    const html = await fetchHtml(current)
    if (!html) continue

    const $ = cheerio.load(html)
    $('a[href]').each((_, el) => {
      const raw = $(el).attr('href')
      if (!raw) return

      // 1️⃣ make absolute (handles "/docs/…" etc.)
      const abs = raw.startsWith('http')
        ? raw
        : new URL(raw, current).toString()
      const noHash = abs.split('#')[0] // 🚫 drop fragment

      // 2️⃣ stay inside help‑center root
      if (!noHash.startsWith(base)) return

      if (!visited.has(noHash)) queue.push(noHash)
    })
  }

  return [...pages]
}

/* ─── Next.js route ─────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const { helpCenter, maxPages }: { helpCenter?: string; maxPages?: number } =
    await req.json()

  if (!helpCenter || typeof helpCenter !== 'string') {
    return NextResponse.json(
      { error: 'POST body must include { helpCenter: string }' },
      { status: 400 },
    )
  }

  try {
    /* 🕸️ crawl */
    const rawUrls = await crawlHelpCenter(helpCenter, maxPages ?? Infinity)

    /* 🔪 strip any stray fragments + de‑dup (should already be unique) */
    const urls = Array.from(new Set(rawUrls.map((u) => u.split('#')[0])))

    return NextResponse.json({
      helpCenter,
      count: urls.length,
      urls,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Crawler failed' }, { status: 500 })
  }
}
