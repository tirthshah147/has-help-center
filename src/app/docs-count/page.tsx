/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState } from 'react'

interface Doc {
  title: string
  href: string
}

export default function HelpCenterDocs() {
  const [url, setUrl] = useState('')
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ── util: last path segment → nice title ───────── */
  const deriveTitle = (href: string) => {
    try {
      const segs = new URL(href).pathname.split('/').filter(Boolean) // drop empty parts
      const last = segs.at(-1) ?? 'index'
      return decodeURIComponent(last.replace(/[-_]/g, ' ')).replace(
        /\b\w/g,
        (c) => c.toUpperCase(),
      )
    } catch {
      return href
    }
  }

  const handleSubmit = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setDocs(null)

    try {
      const res = await fetch('/api/crawl-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpCenter: url, maxPages: 500 }),
      })

      if (!res.ok) throw new Error(`Server ${res.status}`)

      const data: { urls: string[] } = await res.json()

      const mapped: Doc[] = data.urls.map((href) => ({
        href,
        title: deriveTitle(href),
      }))

      setDocs(mapped)
    } catch (err) {
      console.error(err)
      setError('Failed to crawl this help center.')
    } finally {
      setLoading(false)
    }
  }

  // const handleSubmit = async () => {
  //   if (!url.trim()) return

  //   setLoading(true)
  //   setDocs(null)

  //   /* 🔮 Fake crawl → replace with real API later */
  //   const fakeDocs: Doc[] = [
  //     {
  //       title: 'Getting Started',
  //       href: `${url.replace(/\/$/, '')}/getting-started`,
  //     },
  //     {
  //       title: 'Account Settings',
  //       href: `${url.replace(/\/$/, '')}/account-settings`,
  //     },
  //     {
  //       title: 'Billing & Payments',
  //       href: `${url.replace(/\/$/, '')}/billing-payments`,
  //     },
  //     { title: 'Integrations', href: `${url.replace(/\/$/, '')}/integrations` },
  //     { title: 'FAQs', href: `${url.replace(/\/$/, '')}/faqs` },
  //   ]
  //   await new Promise((r) => setTimeout(r, 800))

  //   setDocs(fakeDocs)
  //   setLoading(false)
  // }

  return (
    <main className='min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6'>
      {/* ▶️ Input */}
      <div className='w-full max-w-3xl flex flex-col items-center text-center'>
        <h1 className='text-3xl font-bold mb-4'>📚 Help Center Doc Lister</h1>
        <p className='text-sm text-gray-600 mb-6'>
          Enter a help‑center base URL and we’ll list its docs for you
        </p>

        <input
          type='text'
          className='w-full p-3 border rounded mb-4 text-sm'
          placeholder='https://docs.yoursaas.com'
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className='bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50'
        >
          {loading ? 'Scanning…' : 'List Docs'}
        </button>
      </div>

      {/* 📄 Docs + 📊 Count */}
      {docs && (
        <div className='mt-10 w-full max-w-5xl flex gap-6'>
          {/* Table */}
          <div className='flex-1 overflow-x-auto'>
            <table className='min-w-full border border-gray-200 text-sm text-left'>
              <thead>
                <tr className='bg-gray-100'>
                  <th className='px-4 py-2'>Doc Title</th>
                  <th className='px-4 py-2'>URL</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d, idx) => (
                  <tr key={idx} className='border-t'>
                    <td className='px-4 py-2 whitespace-nowrap'>{d.title}</td>
                    <td className='px-4 py-2'>
                      <a
                        href={d.href}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-blue-600 underline'
                      >
                        {d.href}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sidebar */}
          <aside className='w-56 shrink-0 bg-white border border-gray-200 rounded p-4 h-fit'>
            <h2 className='text-lg font-semibold mb-2'>Summary</h2>
            <p className='text-xl font-bold'>{docs.length}</p>
            <p className='text-sm text-gray-600'>docs found</p>
          </aside>
        </div>
      )}
    </main>
  )
}
