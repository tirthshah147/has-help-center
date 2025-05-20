/* eslint-disable @typescript-eslint/no-unused-vars */
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

function getRootDomain(hostname: string): string {
  const parts = hostname.split('.')
  if (parts.length <= 2) return hostname
  return parts.slice(-2).join('.')
}

async function isUrlValid(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

function generateHelpRegex(domain: string) {
  const keywordPattern = helpKeywords.join('|')
  const domainEscaped = domain.replace(/^https?:\/\//, '').replace(/\./g, '\\.')
  return new RegExp(
    `(https?:\\/\\/[^"']*(${keywordPattern})[^"']*)|` +
      `(["'])\\/?(${keywordPattern})(\\/)?(["'])|` +
      `(${keywordPattern}\\.${domainEscaped})`,
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

export async function POST(req: NextRequest) {
  const { domains }: { domains: string[] } = await req.json()
  if (!domains || !Array.isArray(domains)) {
    return NextResponse.json(
      { error: 'Invalid domains input' },
      { status: 400 },
    )
  }

  const results = []

  for (const input of domains) {
    const domain = input.trim()
    if (!domain) continue

    const siteUrl = domain.startsWith('http') ? domain : `https://${domain}`
    const fullHost = new URL(siteUrl).hostname
    const baseDomain = getRootDomain(fullHost)

    try {
      const res = await fetch(siteUrl)
      const html = await res.text()
      const $ = cheerio.load(html)
      const seen = new Set<string>()
      const matchedLinks: {
        href: string
        valid: boolean
        external: boolean
      }[] = []

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href')?.trim().toLowerCase()
        if (!href || href.startsWith('javascript') || href.startsWith('mailto'))
          return
        seen.add(href)
      })

      for (const href of seen) {
        const fullUrl = href.startsWith('http')
          ? href
          : new URL(href, siteUrl).toString()
        const hostname = new URL(fullUrl).hostname
        const fuzzyMatch = fuzzysort.go(href, helpKeywords, {
          threshold: -1000,
        })
        if (fuzzyMatch.total === 0) continue

        const isExternal = externalKbDomains.some((ext) =>
          hostname.includes(ext),
        )
        const isSameDomain =
          hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)
        if (isExternal || isSameDomain) {
          const valid = await isUrlValid(fullUrl)
          matchedLinks.push({ href: fullUrl, valid, external: isExternal })
        }
      }

      const fallbackLinks = extractFallbackLinks(html, siteUrl)
      for (const link of fallbackLinks) {
        const hostname = new URL(link).hostname
        const isExternal = externalKbDomains.some((ext) =>
          hostname.includes(ext),
        )
        const isSameDomain =
          hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)
        const alreadyIncluded = matchedLinks.find((l) => l.href === link)
        if ((isExternal || isSameDomain) && !alreadyIncluded) {
          const valid = await isUrlValid(link)
          matchedLinks.push({ href: link, valid, external: isExternal })
        }
      }

      results.push({
        domain,
        hasHelpCenter: matchedLinks.length > 0,
        matchedLinks,
      })
    } catch (err) {
      results.push({
        domain,
        hasHelpCenter: false,
        matchedLinks: [],
        error: true,
      })
    }
  }

  return NextResponse.json({ results })
}
