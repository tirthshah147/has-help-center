import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import fuzzysort from 'fuzzysort'

const helpKeywords = ['help', 'support', 'kb', 'docs', 'doc', 'knowledge']

const externalKbDomains = [
  'zendesk.com',
  'intercom.help',
  'helpscoutdocs.com',
  'freshdesk.com',
  'document360.com',
  'helpdocs.io',
  'mintlify.com',
  'crisp.help',
  'tawk.to',
  'notion.site',
  'notion.so',
  'coda.io',
  'confluence.com',
  'atlassian.net',
  'slite.com',
  'asana.com',
]

async function isUrlValid(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

function getRootDomain(hostname: string): string {
  const parts = hostname.split('.')
  if (parts.length <= 2) return hostname // e.g. jasper.ai or google.com
  return parts.slice(-2).join('.') // strips subdomain → "jasper.ai"
}

function generateHelpRegex(domain: string) {
  const keywordPattern = helpKeywords.join('|')
  const domainEscaped = domain.replace(/^https?:\/\//, '').replace(/\./g, '\\.')
  return new RegExp(
    `(https?:\\/\\/[^"']*(${keywordPattern})[^"']*)|` + // absolute
      `(["'])\\/?(${keywordPattern})(\\/)?(["'])|` + // relative "/docs"
      `(${keywordPattern}\\.${domainEscaped})`, // subdomain match
    'gi',
  )
}

function extractFallbackLinks(html: string, domain: string): string[] {
  const regex = generateHelpRegex(domain)
  const matches = new Set<string>()
  for (const match of html.matchAll(regex)) {
    const raw = match[0].replace(/['"]/g, '')
    const fullUrl = raw.startsWith('http')
      ? raw
      : raw.startsWith('/')
      ? new URL(raw, domain).toString()
      : `https://${raw}`
    matches.add(fullUrl)
  }
  return Array.from(matches)
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')

  if (!domain) {
    return NextResponse.json({ error: 'Missing domain' }, { status: 400 })
  }

  const siteUrl = domain.startsWith('http') ? domain : `https://${domain}`
  const fullHost = new URL(siteUrl).hostname
  const baseDomain = getRootDomain(fullHost)

  try {
    const res = await fetch(siteUrl)
    const html = await res.text()

    const $ = cheerio.load(html)
    const seen = new Set<string>()
    const matchedLinks: { href: string; valid: boolean; external: boolean }[] =
      []

    // 🍃 Step 1: Normal anchor tags
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim().toLowerCase()
      if (!href || href.startsWith('javascript') || href.startsWith('mailto'))
        return
      seen.add(href)
    })

    // 🍃 Step 2: Fuzzy match & resolve relative URLs
    for (const href of seen) {
      const fullUrl = href.startsWith('http')
        ? href
        : new URL(href, siteUrl).toString()
      const hostname = new URL(fullUrl).hostname

      const fuzzyMatch = fuzzysort.go(href, helpKeywords, { threshold: -1000 })
      if (fuzzyMatch.total === 0) continue

      const isExternal = externalKbDomains.some((ext) => hostname.includes(ext))
      const isSameDomain =
        hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)

      if (isExternal || isSameDomain) {
        const valid = await isUrlValid(fullUrl)
        matchedLinks.push({ href: fullUrl, valid, external: isExternal })
      }
    }

    // 🍃 Step 3: Regex fallback on raw HTML
    const fallbackLinks = extractFallbackLinks(html, siteUrl)

    console.log(fallbackLinks)
    for (const link of fallbackLinks) {
      const hostname = new URL(link).hostname
      const isExternal = externalKbDomains.some((ext) => hostname.includes(ext))
      const isSameDomain =
        hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)

      const alreadyIncluded = matchedLinks.find((l) => l.href === link)

      if ((isExternal || isSameDomain) && !alreadyIncluded) {
        const valid = await isUrlValid(link)
        matchedLinks.push({ href: link, valid, external: isExternal })
      }
    }

    return NextResponse.json({
      hasHelpCenter: matchedLinks.length > 0,
      matchedLinks,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
