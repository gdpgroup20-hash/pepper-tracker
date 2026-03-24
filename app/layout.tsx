import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pepper Tracker',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          padding: '0 24px',
          height: '40px',
          background: '#18181b',
          borderBottom: '1px solid #27272a',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          <Link href="/" className="nav-link">Tracker</Link>
          <Link href="/matrix" className="nav-link">Matrix</Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
