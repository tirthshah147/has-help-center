'use client'

import { useState } from 'react'

export default function Home() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<null | {
    hasHelpCenter: boolean
    matchedLinks: { href: string; valid: boolean; external: boolean }[]
  }>(null)

  const checkHelpCenter = async () => {
    if (!domain.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(
        `/api/check-help?domain=${encodeURIComponent(domain)}`,
      )
      const data = await res.json()
      setResult(data)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className='min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-10'>
      <h1 className='text-3xl font-bold mb-2 text-center'>
        🔍 SaaS Help Center Checker
      </h1>
      <div className='text-sm text-blue-600 hover:underline text-center'>
        <a href='/multi'>Switch to Multi-Domain Mode →</a>
      </div>
      <br />

      <div className='w-full max-w-md space-y-4'>
        <input
          type='text'
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder='Enter website domain e.g. example.com'
          className='w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
        />

        <button
          onClick={checkHelpCenter}
          disabled={loading}
          className='w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50'
        >
          {loading ? 'Checking...' : 'Check Help Center'}
        </button>
      </div>

      {result && (
        <div className='mt-10 w-full max-w-xl bg-white p-6 rounded-lg shadow-md border'>
          <h2 className='text-xl font-semibold mb-4'>
            Result:{' '}
            <span
              className={
                result.hasHelpCenter ? 'text-green-600' : 'text-red-600'
              }
            >
              {result.hasHelpCenter
                ? '✅ Help Center Found'
                : '❌ No Help Center Detected'}
            </span>
          </h2>

          {result.matchedLinks.length > 0 && (
            <ul className='space-y-2'>
              {result.matchedLinks.map((link, i) => (
                <li key={i} className='text-sm text-gray-700'>
                  <a
                    href={link.href}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-blue-600 underline'
                  >
                    {link.href}
                  </a>{' '}
                  {link.valid ? '✅' : '❌'}{' '}
                  {link.external && (
                    <span className='text-xs text-gray-500'>(external)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  )
}
