import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Cart } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { useToast } from '@/context/ToastContext';

interface Address {
  _id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface OrderRecord {
  _id: string;
  orderNumber: string;
  total: number;
}

const initialAddress = {
  label: 'Home',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  isDefault: false,
};

export function CheckoutPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addressId, setAddressId] = useState('');
  const [addingAddress, setAddingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState(initialAddress);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay'>('cod');
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [error, setError] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<OrderRecord | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: async () => (await api.get<Cart>('/cart')).data,
    enabled: Boolean(user),
  });
  const addressQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get<Address[]>('/users/addresses')).data,
    enabled: Boolean(user),
  });
  const couponCheck = useMutation({
    mutationFn: () => api.post<{ valid: boolean; discount?: number; code?: string }>('/users/coupons/validate', {
      code: couponCode.trim(),
      subtotal: cartQuery.data?.subtotal ?? 0,
    }),
    onSuccess: ({ data }) => {
      setCouponMessage(data.valid
        ? `${data.code} applied: ${formatCurrency(data.discount ?? 0)} off.`
        : 'This coupon is not valid for the current order.');
    },
    onError: (reason) => setCouponMessage(reason instanceof Error ? reason.message : 'Unable to validate coupon.'),
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-serif text-3xl">Sign in to check out</h1>
        <p className="mt-2 text-ink-500">Your saved cart will be here when you return.</p>
        <Button asChild className="mt-6" variant="accent"><Link to="/login">Sign in</Link></Button>
      </div>
    );
  }

  async function saveAddress() {
    if (
      !addressForm.label.trim() ||
      !addressForm.fullName.trim() ||
      addressForm.phone.trim().length < 8 ||
      !addressForm.line1.trim() ||
      !addressForm.city.trim() ||
      !addressForm.state.trim() ||
      addressForm.postalCode.trim().length < 4
    ) {
      setError('Complete the required shipping address fields.');
      return;
    }
    setSavingAddress(true);
    setError('');
    try {
      const { data } = await api.post<Address>('/users/addresses', addressForm);
      setAddressId(data._id);
      setAddingAddress(false);
      setAddressForm(initialAddress);
      await queryClient.invalidateQueries({ queryKey: ['addresses'] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the address.');
    } finally {
      setSavingAddress(false);
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosenAddressId =
      addressId ||
      addressQuery.data?.find((address) => address.isDefault)?._id ||
      addressQuery.data?.[0]?._id ||
      '';
    if (!chosenAddressId) {
      setError('Choose or add a shipping address.');
      return;
    }
    if (!cartQuery.data?.items.length) {
      setError('Your cart is empty.');
      return;
    }

    setPlacingOrder(true);
    setError('');
    try {
      const order = pendingOrder ?? (await api.post<OrderRecord>('/orders', {
        addressId: chosenAddressId,
        paymentMethod,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
        idempotencyKey,
      })).data;
      setPendingOrder(order);

      if (paymentMethod === 'cod') {
        await queryClient.invalidateQueries({ queryKey: ['cart'] });
        showToast('Order placed', { description: `Order ${order.orderNumber} is confirmed.` });
        navigate(`/orders/${order._id}`);
        return;
      }

      const { data: paymentOrder } = await api.post<{
        razorpayOrderId: string;
        amount: number;
        currency: string;
        keyId: string;
      }>('/payments/razorpay/order', { orderId: order._id });
      await openRazorpayCheckout({
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: 'Books Bin',
        description: `Order ${order.orderNumber}`,
        orderId: paymentOrder.razorpayOrderId,
        prefill: { name: user.name, email: user.email },
        onSuccess: (response) => {
          void api.post<OrderRecord>('/payments/razorpay/verify', {
            orderId: order._id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }).then(async () => {
            await queryClient.invalidateQueries({ queryKey: ['cart'] });
            showToast('Payment confirmed', { description: `Order ${order.orderNumber} is paid.` });
            navigate(`/orders/${order._id}`);
          }).catch((reason: unknown) => {
            setError(reason instanceof Error
              ? `${reason.message} Your order is still pending payment.`
              : 'Payment verification failed. Your order is still pending payment.');
          });
        },
        onDismiss: () => setError('Payment was not completed. Your order remains pending and can be retried.'),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to place your order.');
    } finally {
      setPlacingOrder(false);
    }
  }

  if (cartQuery.isLoading || addressQuery.isLoading) return <p className="p-10 text-center text-ink-500">Preparing checkout…</p>;
  if (cartQuery.isError || addressQuery.isError) {
    const queryError = cartQuery.error ?? addressQuery.error;
    return <p role="alert" className="mx-auto max-w-3xl p-10 text-center text-red-700">{queryError?.message}</p>;
  }
  const cart = cartQuery.data;
  const addresses = addressQuery.data ?? [];
  const selectedAddressId = addressId || addresses.find((address) => address.isDefault)?._id || addresses[0]?._id || '';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <p className="text-xs uppercase tracking-[0.25em] text-ink-400">A few details before your next read</p>
      <h1 className="mt-1 font-serif text-4xl">Checkout</h1>
      <form onSubmit={(event) => void submitOrder(event)} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-ink-100 bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-xl">Shipping address</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddingAddress(!addingAddress)}>
                {addingAddress ? 'Use saved address' : 'Add address'}
              </Button>
            </div>
            {addresses.length > 0 && !addingAddress && (
              <div className="mt-4 space-y-3">
                {addresses.map((address) => (
                  <label key={address._id} className="flex cursor-pointer gap-3 rounded-lg border border-ink-100 p-4 hover:bg-ink-50">
                    <input
                      type="radio"
                      name="address"
                      value={address._id}
                      checked={selectedAddressId === address._id}
                      onChange={() => setAddressId(address._id)}
                    />
                    <span className="text-sm">
                      <span className="font-medium">{address.label} · {address.fullName}</span>
                      <span className="mt-1 block text-ink-500">{address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.postalCode}</span>
                      <span className="block text-ink-500">{address.phone}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {(addingAddress || !addresses.length) && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AddressField label="Address label"><Input required value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} /></AddressField>
                <AddressField label="Full name"><Input required value={addressForm.fullName} onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })} /></AddressField>
                <AddressField label="Phone"><Input required type="tel" minLength={8} value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} /></AddressField>
                <AddressField label="Address line 1"><Input required value={addressForm.line1} onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })} /></AddressField>
                <AddressField label="Address line 2"><Input value={addressForm.line2} onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })} /></AddressField>
                <AddressField label="City"><Input required value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} /></AddressField>
                <AddressField label="State"><Input required value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} /></AddressField>
                <AddressField label="Postal code"><Input required minLength={4} value={addressForm.postalCode} onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })} /></AddressField>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={addressForm.isDefault} onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} />
                  Save as my default address
                </label>
                <div className="sm:col-span-2">
                  <Button type="button" variant="outline" disabled={savingAddress} onClick={() => void saveAddress()}>
                    {savingAddress ? 'Saving address…' : 'Save address'}
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-ink-100 bg-white p-5 md:p-6">
            <h2 className="font-serif text-xl">Payment method</h2>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer gap-3 rounded-lg border border-ink-100 p-4 text-sm">
                <input type="radio" name="payment" checked={paymentMethod === 'cod'} disabled={Boolean(pendingOrder)} onChange={() => setPaymentMethod('cod')} />
                <span><span className="font-medium">Cash on delivery</span><span className="mt-1 block text-ink-500">Pay when your books arrive.</span></span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-lg border border-ink-100 p-4 text-sm">
                <input type="radio" name="payment" checked={paymentMethod === 'razorpay'} disabled={Boolean(pendingOrder)} onChange={() => setPaymentMethod('razorpay')} />
                <span><span className="font-medium">Razorpay</span><span className="mt-1 block text-ink-500">Secure test/live checkout, depending on server configuration.</span></span>
              </label>
            </div>
          </section>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
          {pendingOrder && error && (
            <Link className="text-sm font-medium underline" to={`/orders/${pendingOrder._id}`}>View order {pendingOrder.orderNumber}</Link>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-ink-100 bg-white p-5 md:p-6">
          <h2 className="font-serif text-xl">Order summary</h2>
          <ul className="mt-4 space-y-3 border-b border-ink-100 pb-4 text-sm">
            {cart?.items.map((item) => (
              <li key={item.bookId} className="flex justify-between gap-3">
                <span className="text-ink-600">{item.title} × {item.quantity}</span>
                <span className="shrink-0">{formatCurrency(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span>{formatCurrency(cart?.subtotal ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Shipping</span><span>{cart?.shippingFee ? formatCurrency(cart.shippingFee) : 'Free'}</span></div>
            <div className="flex justify-between border-t border-ink-100 pt-4 text-base font-semibold"><span>Total</span><span>{formatCurrency(cart?.total ?? 0)}</span></div>
          </div>
          <div className="mt-5 space-y-2">
            <label className="block text-sm font-medium" htmlFor="coupon">Coupon code</label>
            <div className="flex gap-2">
              <Input id="coupon" value={couponCode} onChange={(e) => { setCouponCode(e.target.value); setCouponMessage(''); }} />
              <Button type="button" variant="outline" disabled={!couponCode.trim() || couponCheck.isPending} onClick={() => couponCheck.mutate()}>
                Apply
              </Button>
            </div>
            {couponMessage && <p role="status" className="text-xs text-ink-500">{couponMessage}</p>}
          </div>
          <Button className="mt-6 w-full" variant="accent" disabled={placingOrder || !cart?.items.length}>
            {placingOrder ? 'Processing…' : paymentMethod === 'razorpay' ? 'Continue to secure payment' : 'Place order'}
          </Button>
          <p className="mt-3 text-center text-xs text-ink-400">Prices and stock are rechecked securely before the order is placed.</p>
        </aside>
      </form>
    </div>
  );
}

function AddressField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium">{label}{children}</label>;
}
