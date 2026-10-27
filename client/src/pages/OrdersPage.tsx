import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { bookCoverUrl, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { useToast } from '@/context/ToastContext';

interface OrderLine {
  bookId: string;
  title: string;
  isbn: string;
  coverImage?: string;
  unitPrice: number;
  discountPercent: number;
  quantity: number;
  lineTotal: number;
}

interface OrderRecord {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  createdAt: string;
  items: OrderLine[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export function OrdersPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.get<OrderRecord[]>('/orders')).data,
    enabled: Boolean(user),
  });

  if (!user) return <SignInPrompt />;
  if (isLoading) return <p className="p-10 text-center text-ink-500">Loading your orders…</p>;
  if (isError) return <p role="alert" className="mx-auto max-w-3xl p-10 text-center text-red-700">{error.message}</p>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Your Books Bin account</p>
      <h1 className="mt-1 font-serif text-4xl">Order history</h1>
      {!data?.length ? (
        <div className="mt-8 rounded-xl border border-ink-100 bg-white p-10 text-center">
          <PackageCheck className="mx-auto h-8 w-8 text-ink-400" />
          <p className="mt-4 font-serif text-2xl">No orders yet</p>
          <p className="mt-2 text-sm text-ink-500">Your next favorite book is waiting to be discovered.</p>
          <Button asChild className="mt-6" variant="accent"><Link to="/catalog">Browse books</Link></Button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {data.map((order) => (
            <Link
              key={order._id}
              to={`/orders/${order._id}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-100 bg-white p-5 transition hover:border-ink-300"
            >
              <div>
                <p className="font-medium">{order.orderNumber}</p>
                <p className="mt-1 text-sm text-ink-500">{new Date(order.createdAt).toLocaleDateString()} · {order.items.length} {order.items.length === 1 ? 'title' : 'titles'}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(order.total)}</p>
                <p className="mt-1 text-sm capitalize text-ink-500">{order.status.replaceAll('_', ' ')} · payment {order.paymentStatus}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [paymentError, setPaymentError] = useState('');
  const [retryingPayment, setRetryingPayment] = useState(false);
  const query = useQuery({
    queryKey: ['order', id],
    queryFn: async () => (await api.get<OrderRecord>(`/orders/${id}`)).data,
    enabled: Boolean(user && id),
  });
  const cancelOrder = useMutation({
    mutationFn: () => api.post<OrderRecord>(`/orders/${id}/cancel`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order', id] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['cart'] }),
      ]);
      showToast('Order cancelled', { description: 'Your order has been cancelled.' });
    },
  });
  async function retryPayment() {
    if (!id || !user || retryingPayment) return;
    setPaymentError('');
    setRetryingPayment(true);
    try {
      const { data: paymentOrder } = await api.post<{
        razorpayOrderId: string;
        amount: number;
        currency: string;
        keyId: string;
      }>('/payments/razorpay/order', { orderId: id });
      await openRazorpayCheckout({
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        orderId: paymentOrder.razorpayOrderId,
        name: 'Books Bin',
        description: `Order ${query.data?.orderNumber ?? ''}`,
        prefill: { name: user.name, email: user.email },
        onSuccess: (response) => {
          void api.post('/payments/razorpay/verify', {
            orderId: id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }).then(async () => {
            await Promise.all([
              query.refetch(),
              queryClient.invalidateQueries({ queryKey: ['orders'] }),
            ]);
            showToast('Payment confirmed', { description: `Order ${query.data?.orderNumber ?? ''} is paid.` });
          }).catch((reason: unknown) => {
            setPaymentError(reason instanceof Error
              ? `${reason.message} The order remains pending until payment is verified.`
              : 'Payment verification failed. The order remains pending.');
          });
        },
        onDismiss: () => setPaymentError('Payment was not completed. You can retry while this order is pending.'),
      });
    } catch (reason) {
      setPaymentError(reason instanceof Error ? reason.message : 'Unable to start the payment retry.');
    } finally {
      setRetryingPayment(false);
    }
  }

  if (!user) return <SignInPrompt />;
  if (query.isLoading) return <p className="p-10 text-center text-ink-500">Loading order…</p>;
  if (query.isError || !query.data) {
    return <p role="alert" className="mx-auto max-w-3xl p-10 text-center text-red-700">{query.error?.message ?? 'Order not found.'}</p>;
  }
  const order = query.data;
  const cancellable = ['pending_payment', 'paid', 'processing'].includes(order.status);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <Button asChild variant="ghost" size="sm"><Link to="/orders"><ArrowLeft className="h-4 w-4" /> Order history</Link></Button>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Order confirmation</p>
          <h1 className="mt-1 font-serif text-3xl">{order.orderNumber}</h1>
          <p className="mt-2 text-sm capitalize text-ink-500">{order.status.replaceAll('_', ' ')} · payment {order.paymentStatus}</p>
        </div>
        <p className="text-sm text-ink-500">Placed {new Date(order.createdAt).toLocaleString()}</p>
      </div>
      {order.paymentStatus !== 'paid' && (
        <p role="status" className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Payment is not confirmed yet. Your order will remain unpaid until the payment provider verifies it.
        </p>
      )}
      {paymentError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{paymentError}</p>}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <section className="divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white px-5">
          {order.items.map((item) => (
            <div key={`${item.bookId}-${item.isbn}`} className="flex gap-4 py-5">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded bg-ink-50">
                <img className="h-full w-full object-cover" src={bookCoverUrl(item.coverImage)} alt={item.title} />
              </div>
              <div className="flex flex-1 items-center justify-between gap-3">
                <div><p className="font-serif text-lg">{item.title}</p><p className="text-sm text-ink-500">Qty {item.quantity} · ISBN {item.isbn}</p></div>
                <p className="shrink-0 font-medium">{formatCurrency(item.lineTotal)}</p>
              </div>
            </div>
          ))}
        </section>
        <aside className="h-fit space-y-5 rounded-xl border border-ink-100 bg-white p-5">
          <div>
            <h2 className="font-serif text-lg">Shipping to</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              {order.shippingAddress.fullName}<br />
              {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
              {order.shippingAddress.country}<br />
              {order.shippingAddress.phone}
            </p>
          </div>
          <div className="border-t border-ink-100 pt-4">
            <div className="flex justify-between text-sm"><span className="text-ink-500">Payment</span><span className="capitalize">{order.paymentMethod}</span></div>
            <div className="mt-3 flex justify-between font-semibold"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
          </div>
          {cancelOrder.isError && <p role="alert" className="text-sm text-red-700">{cancelOrder.error.message}</p>}
          {order.paymentMethod === 'razorpay' && order.status === 'pending_payment' && order.paymentStatus !== 'paid' && (
            <Button variant="accent" className="w-full" disabled={retryingPayment} onClick={() => void retryPayment()}>
              {retryingPayment ? 'Preparing payment…' : 'Retry payment'}
            </Button>
          )}
          {cancellable && (
            <Button variant="outline" className="w-full" disabled={cancelOrder.isPending} onClick={() => {
              if (window.confirm('Cancel this order?')) cancelOrder.mutate();
            }}>
              {cancelOrder.isPending ? 'Cancelling…' : 'Cancel order'}
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-serif text-3xl">Sign in to view your orders</h1>
      <Button asChild className="mt-6" variant="accent"><Link to="/login">Sign in</Link></Button>
    </div>
  );
}
