import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Cart } from '@/types';
import { bookCoverUrl, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export function CartPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: async () => (await api.get<Cart>('/cart')).data,
    enabled: Boolean(user),
  });

  const updateItem = useMutation({
    mutationFn: ({ bookId, quantity }: { bookId: string; quantity: number }) =>
      api.patch<Cart>(`/cart/items/${bookId}`, { quantity }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      showToast('Cart updated', { description: 'Your bag has been updated.' });
    },
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-ink-400" />
        <h1 className="mt-4 font-serif text-3xl">Your bag is waiting</h1>
        <p className="mt-2 text-ink-500">Sign in to keep your cart saved across visits.</p>
        <Button asChild className="mt-6" variant="accent"><Link to="/login">Sign in</Link></Button>
      </div>
    );
  }

  if (cartQuery.isLoading) return <p className="p-10 text-center text-ink-500">Loading your bag…</p>;
  if (cartQuery.isError) {
    return <p role="alert" className="mx-auto max-w-3xl p-10 text-center text-red-700">{cartQuery.error.message}</p>;
  }
  const cart = cartQuery.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Saved for your next chapter</p>
        <h1 className="mt-1 font-serif text-4xl">Your bag</h1>
      </div>
      {!cart?.items.length ? (
        <div className="rounded-2xl border border-ink-100 bg-white px-6 py-14 text-center">
          <p className="font-serif text-2xl">Your bag is empty.</p>
          <p className="mt-2 text-sm text-ink-500">Find a story you’ll want to take home.</p>
          <Button asChild className="mt-6" variant="accent"><Link to="/catalog">Browse books</Link></Button>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white px-4 md:px-6">
            {cart.items.map((item) => (
              <article key={item.bookId} className="flex gap-4 py-5">
                <Link to={`/books/${item.slug}`} className="h-28 w-20 shrink-0 overflow-hidden rounded-md bg-ink-50">
                  <img className="h-full w-full object-cover" src={bookCoverUrl(item.coverImage)} alt={item.title} />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <Link to={`/books/${item.slug}`} className="font-serif text-lg hover:underline">{item.title}</Link>
                    <p className="mt-1 text-sm text-ink-500">{formatCurrency(item.unitPrice)} each</p>
                  </div>
                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <div className="flex items-center rounded-md border border-ink-200">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${item.title}`}
                        className="p-2 disabled:opacity-40"
                        disabled={updateItem.isPending || item.quantity <= 1}
                        onClick={() => updateItem.mutate({ bookId: item.bookId, quantity: item.quantity - 1 })}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.title}`}
                        className="p-2 disabled:opacity-40"
                        disabled={updateItem.isPending || item.quantity >= item.stock}
                        onClick={() => updateItem.mutate({ bookId: item.bookId, quantity: item.quantity + 1 })}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="w-24 text-right font-medium">{formatCurrency(item.lineTotal)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${item.title}`}
                      className="rounded p-2 text-ink-400 hover:bg-red-50 hover:text-red-700"
                      disabled={updateItem.isPending}
                      onClick={() => updateItem.mutate({ bookId: item.bookId, quantity: 0 })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {updateItem.isError && <p role="alert" className="py-3 text-sm text-red-700">{updateItem.error.message}</p>}
          </div>
          <aside className="h-fit rounded-xl border border-ink-100 bg-white p-6">
            <h2 className="font-serif text-xl">Order summary</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span>{formatCurrency(cart.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Shipping</span><span>{cart.shippingFee ? formatCurrency(cart.shippingFee) : 'Free'}</span></div>
              {cart.subtotal < cart.freeShippingThreshold && (
                <p className="text-xs text-ink-500">Free shipping on orders above {formatCurrency(cart.freeShippingThreshold)}.</p>
              )}
              <div className="flex justify-between border-t border-ink-100 pt-4 text-base font-semibold">
                <span>Total</span><span>{formatCurrency(cart.total)}</span>
              </div>
            </div>
            <Button asChild className="mt-6 w-full" variant="accent"><Link to="/checkout">Continue to checkout</Link></Button>
            <Link className="mt-4 block text-center text-sm text-ink-500 hover:text-ink-900" to="/catalog">Continue shopping</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
