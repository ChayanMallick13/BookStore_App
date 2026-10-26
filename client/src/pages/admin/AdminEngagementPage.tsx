import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ReviewRecord {
  _id: string;
  rating: number;
  title?: string;
  body: string;
  createdAt: string;
  user?: { name: string; email: string };
  book?: { title: string };
}

interface CouponRecord {
  _id: string;
  code: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: string;
  isActive: boolean;
}

function ReviewsQueue() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => (await api.get<ReviewRecord[]>('/admin/reviews')).data,
  });
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      api.patch(`/admin/reviews/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }),
  });

  return (
    <section className="space-y-4 rounded-xl border border-ink-100 bg-white p-5">
      <div>
        <h2 className="font-serif text-2xl">Review moderation</h2>
        <p className="mt-1 text-sm text-ink-500">Approve reviews for display or reject content that does not meet store guidelines.</p>
      </div>
      {query.isLoading && <p className="text-sm text-ink-500">Loading reviews…</p>}
      {query.isError && <p role="alert" className="text-sm text-red-700">{query.error.message}</p>}
      {moderate.isError && <p role="alert" className="text-sm text-red-700">{moderate.error.message}</p>}
      <ul className="space-y-3">
        {query.data?.map((review) => (
          <li key={review._id} className="rounded-lg border border-ink-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{review.title || `${review.rating} / 5 stars`}</p>
                <p className="text-xs text-ink-500">
                  {review.book?.title ?? 'Book removed'} · {review.user?.name ?? 'Customer'} · {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span aria-label={`${review.rating} out of 5 stars`} className="text-sm text-amber-700">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{review.body}</p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="accent" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: review._id, status: 'approved' })}>
                <Check className="h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="outline" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: review._id, status: 'rejected' })}>
                <X className="h-4 w-4" /> Reject
              </Button>
            </div>
          </li>
        ))}
        {!query.isLoading && !query.data?.length && <li className="py-4 text-sm text-ink-500">No reviews are waiting for moderation.</li>}
      </ul>
    </section>
  );
}

function CouponsManager() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [maxUses, setMaxUses] = useState('100');
  const [expiresAt, setExpiresAt] = useState('');
  const query = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => (await api.get<CouponRecord[]>('/admin/coupons')).data,
  });
  const create = useMutation({
    mutationFn: () => api.post<CouponRecord>('/admin/coupons', {
      code: code.trim().toUpperCase(),
      description: description.trim(),
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount),
      maxUses: Number(maxUses),
      ...(expiresAt ? { expiresAt: new Date(`${expiresAt}T23:59:59.999Z`).toISOString() } : {}),
    }),
    onSuccess: async () => {
      setCode('');
      setDescription('');
      setDiscountValue('');
      setMinOrderAmount('0');
      setMaxUses('100');
      setExpiresAt('');
      await queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (coupon: CouponRecord) => api.patch(`/admin/coupons/${coupon._id}`, { isActive: !coupon.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <section className="space-y-5 rounded-xl border border-ink-100 bg-white p-5">
      <div>
        <h2 className="font-serif text-2xl">Coupons</h2>
        <p className="mt-1 text-sm text-ink-500">Create discount codes with usage caps and expiry dates.</p>
      </div>
      <form onSubmit={submit} className="grid gap-3 rounded-lg bg-ink-50 p-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          Code
          <Input required minLength={3} maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Description
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Discount type
          <select className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm" value={discountType} onChange={(event) => {
            if (event.target.value === 'percent' || event.target.value === 'fixed') setDiscountType(event.target.value);
          }}>
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed amount (₹)</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Discount value {discountType === 'percent' ? '(%)' : '(₹)'}
          <Input required type="number" min="0.01" max={discountType === 'percent' ? '100' : undefined} step="0.01" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Minimum order (₹)
          <Input required type="number" min="0" step="0.01" value={minOrderAmount} onChange={(event) => setMinOrderAmount(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Maximum uses
          <Input required type="number" min="1" step="1" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Expiration date
          <Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </label>
        {create.isError && <p role="alert" className="self-end text-sm text-red-700 sm:col-span-2">{create.error.message}</p>}
        <div className="sm:col-span-2">
          <Button variant="accent" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create coupon'}</Button>
        </div>
      </form>
      {query.isLoading && <p className="text-sm text-ink-500">Loading coupons…</p>}
      {query.isError && <p role="alert" className="text-sm text-red-700">{query.error.message}</p>}
      {toggle.isError && <p role="alert" className="text-sm text-red-700">{toggle.error.message}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-ink-500">
            <tr><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Discount</th><th className="py-2 pr-3">Usage</th><th className="py-2 pr-3">Expires</th><th className="py-2">Status</th></tr>
          </thead>
          <tbody>
            {query.data?.map((coupon) => (
              <tr key={coupon._id} className="border-t border-ink-100">
                <td className="py-3 pr-3"><span className="font-semibold">{coupon.code}</span>{coupon.description && <span className="block text-xs text-ink-500">{coupon.description}</span>}</td>
                <td className="py-3 pr-3">{coupon.discountType === 'percent' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}</td>
                <td className="py-3 pr-3">{coupon.usedCount} / {coupon.maxUses}</td>
                <td className="py-3 pr-3">{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : '—'}</td>
                <td className="py-3">
                  <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(coupon)}>
                    {coupon.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
            {!query.isLoading && !query.data?.length && <tr><td colSpan={5} className="py-5 text-center text-ink-500">No coupons created.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdminEngagementPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Customer experience</p>
        <h1 className="mt-1 font-serif text-3xl">Reviews and promotions</h1>
      </header>
      <CouponsManager />
      <ReviewsQueue />
    </div>
  );
}
