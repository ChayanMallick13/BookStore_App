import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export function AdminReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  async function downloadReport() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await fetch(`${API_BASE}/admin/reports/sales.csv?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? 'Unable to download the sales report.');
      }
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `bookhaven-sales${from ? `-${from}` : ''}${to ? `-to-${to}` : ''}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to download the sales report.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Performance</p>
        <h1 className="mt-1 font-serif text-3xl">Sales reports</h1>
        <p className="mt-2 text-sm text-ink-500">Download paid-order sales as a CSV for the selected date range.</p>
      </div>
      <section className="space-y-5 rounded-xl border border-ink-100 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium">
            From
            <Input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            To
            <Input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button variant="accent" disabled={loading || !user} onClick={() => void downloadReport()}>
          <Download className="h-4 w-4" /> {loading ? 'Preparing report…' : 'Download CSV'}
        </Button>
      </section>
    </div>
  );
}
