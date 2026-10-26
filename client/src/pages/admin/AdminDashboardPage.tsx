import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowRight, BookCopy, CircleAlert, Package, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';

interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  activeBooks: number;
  lowStock: Array<{ _id: string; title: string; slug: string; stock: number }>;
  recentOrders: Array<{ _id: string; orderNumber: string; total: number; status: string; createdAt: string }>;
  salesTrend: Array<{ _id: string; revenue: number; orders: number }>;
}

export function AdminDashboardPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-dashboard', from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.size ? `?${params.toString()}` : '';
      return (await api.get<DashboardMetrics>(`/admin/dashboard${query}`)).data;
    },
  });

  if (isError) return <p role="alert" className="text-red-700">{error.message}</p>;
  if (!data && isLoading) return <p className="text-ink-500">Loading dashboard…</p>;
  if (!data) return null;

  const metrics = [
    { label: 'Paid revenue', value: formatCurrency(data.totalRevenue), icon: Package },
    { label: 'Orders', value: data.totalOrders.toLocaleString('en-IN'), icon: Package },
    { label: 'Customers', value: data.totalCustomers.toLocaleString('en-IN'), icon: Users },
    { label: 'Active books', value: data.activeBooks.toLocaleString('en-IN'), icon: BookCopy },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ink-400">BookHaven operations</p>
          <h1 className="mt-1 font-serif text-3xl">Dashboard</h1>
        </div>
        <Button asChild variant="accent"><Link to="/admin/books">Manage books <ArrowRight className="h-4 w-4" /></Link></Button>
      </div>
      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-ink-100 bg-white p-4">
        <label className="space-y-1.5 text-sm font-medium">
          From
          <Input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          To
          <Input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
        </label>
        {(from || to) && (
          <Button variant="ghost" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</Button>
        )}
        {isLoading && <span role="status" className="pb-2 text-sm text-ink-500">Updating…</span>}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-ink-100 bg-white p-5">
            <div className="flex items-center justify-between text-ink-500">
              <span className="text-sm">{label}</span>
              <Icon className="h-4 w-4" />
            </div>
            <p className="mt-3 font-serif text-2xl text-ink-900">{value}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-ink-100 bg-white p-5">
          <h2 className="font-serif text-xl">Low stock</h2>
          {data.lowStock.length ? (
            <ul className="mt-4 divide-y divide-ink-100">
              {data.lowStock.map((book) => (
                <li key={book._id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <Link className="font-medium hover:underline" to={`/books/${book.slug}`}>{book.title}</Link>
                  <span className="flex shrink-0 items-center gap-1 text-amber-700"><CircleAlert className="h-4 w-4" /> {book.stock} left</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-sm text-ink-500">No low-stock books.</p>}
        </section>
        <section className="rounded-xl border border-ink-100 bg-white p-5">
          <h2 className="font-serif text-xl">Recent orders</h2>
          {data.recentOrders.length ? (
            <ul className="mt-4 divide-y divide-ink-100">
              {data.recentOrders.map((order) => (
                <li key={order._id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-xs capitalize text-ink-500">{order.status} · {new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="shrink-0">{formatCurrency(order.total)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-sm text-ink-500">No orders yet.</p>}
        </section>
      </div>
    </div>
  );
}
