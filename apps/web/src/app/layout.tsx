import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'BidPilot',
  description:
    'Job-ad budget optimizer: Thompson sampling over publishers with pacing, on simulated traffic.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:block focus:p-3">
          Skip to content
        </a>
        <header className="workspace-header">
          <nav aria-label="Main navigation" className="workspace-nav">
            <Link href="/" className="workspace-brand">
              <span className="budget-mark" aria-hidden="true">
                <span className="h-3" />
                <span className="h-6" />
                <span className="h-4" />
              </span>
              BidPilot
            </Link>
            <Link href="/">Campaigns</Link>
            <Link href="/experiments">Experiments</Link>
            <span className="simulation-badge">Simulation workspace</span>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1} className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Seeded traffic. Reproducible comparisons.</span>
          <span>All budgets and applications are simulated.</span>
        </footer>
      </body>
    </html>
  );
}
