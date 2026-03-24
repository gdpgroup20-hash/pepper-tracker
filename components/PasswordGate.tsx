'use client'

import { useState } from 'react'

const PASSWORD = 'growth'
const AUTH_KEY = 'pepper-auth'

export function checkAuth() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(AUTH_KEY) === '1'
}

export default function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input === PASSWORD) {
      localStorage.setItem(AUTH_KEY, '1')
      onUnlock()
    } else {
      setError(true)
      setInput('')
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0a0a',
    }}>
      <form onSubmit={handleSubmit} style={{
        display: 'flex', flexDirection: 'column', gap: '12px',
        background: '#18181b', border: '1px solid #27272a', borderRadius: '12px',
        padding: '32px', minWidth: '280px', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#7c3aed" />
            <path d="M7 8h10M7 12h7M7 16h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '16px' }}>Pepper Tracker</span>
        </div>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false) }}
          placeholder="Password"
          autoFocus
          style={{
            background: '#27272a', border: `1px solid ${error ? '#ef4444' : '#3f3f46'}`,
            borderRadius: '6px', color: '#fff', padding: '8px 12px',
            fontSize: '14px', width: '100%', outline: 'none',
          }}
        />
        {error && <span style={{ color: '#ef4444', fontSize: '13px' }}>Incorrect password</span>}
        <button type="submit" style={{
          background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px',
          padding: '8px 20px', fontSize: '14px', cursor: 'pointer', width: '100%',
        }}>
          Enter
        </button>
      </form>
    </div>
  )
}
