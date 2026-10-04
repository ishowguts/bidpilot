import type { ReactNode } from 'react';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {title && <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>}
      {children}
    </section>
  );
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {error.message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-3 underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="text-sm text-slate-500">
      {label}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}
