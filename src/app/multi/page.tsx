/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'

export default function Home() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const domains = input
      .split(/[\s,]+/)
      .map((d) => d.trim())
      .filter((d) => !!d)

    if (domains.length === 0) return

    setLoading(true)
    setResults(null)

    const res = await fetch('/api/check-help-multi', {
      method: 'POST',
      body: JSON.stringify({ domains }),
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await res.json()
    setResults(data.results)
    setLoading(false)
  }

  return (
    <main className='min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6'>
      <div className='w-full max-w-3xl flex flex-col items-center text-center'>
        <h1 className='text-3xl font-bold mb-4'>🔎 SaaS Help Center Checker</h1>
        <div className='text-sm text-blue-600 hover:underline mb-6'>
          <a href='/'>← Switch to Single Domain Mode</a>
        </div>
        <p className='text-sm text-gray-600 mb-6'>
          Enter one or more domains (separated by comma or space)
        </p>

        <textarea
          rows={4}
          className='w-full p-3 border rounded mb-4 text-sm'
          placeholder='example.com, linear.app, notion.so'
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className='bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50'
        >
          {loading ? 'Checking...' : 'Check Help Centers'}
        </button>
      </div>

      {results && (
        <div className='mt-10 w-full max-w-5xl overflow-x-auto'>
          <table className='min-w-full border border-gray-200 text-sm text-left'>
            <thead>
              <tr className='bg-gray-100'>
                <th className='px-4 py-2'>Domain</th>
                <th className='px-4 py-2'>Help Center</th>
                <th className='px-4 py-2'>Matched Links</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, i) => (
                <tr key={i} className='border-t'>
                  <td className='px-4 py-2'>{row.domain}</td>
                  <td className='px-4 py-2'>
                    {row.error ? (
                      <span className='text-red-500'>❌ Error</span>
                    ) : row.hasHelpCenter ? (
                      <span className='text-green-600'>✅ Yes</span>
                    ) : (
                      '❌ No'
                    )}
                  </td>
                  <td className='px-4 py-2'>
                    <ul className='space-y-1'>
                      {row.matchedLinks?.map((l: any, idx: number) => (
                        <li key={idx}>
                          <a
                            href={l.href}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-600 underline'
                          >
                            {l.href}
                          </a>{' '}
                          {l.valid ? '✅' : '❌'} {l.external && '(external)'}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
