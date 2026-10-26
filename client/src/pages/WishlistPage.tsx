import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Book } from '@/types';
import { BookCard } from '@/components/BookCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface WishlistBook extends Omit<Book, 'id' | 'effectivePrice' | 'inStock'> {
  _id: string;
}

export function WishlistPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => (await api.get<WishlistBook[]>('/users/wishlist')).data,
    enabled: Boolean(user),
  });
  const remove = useMutation({
    mutationFn: (bookId: string) => api.delete(`/users/wishlist/${bookId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      showToast('Removed from wishlist', { description: 'You can add it again any time.' });
    },
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <Heart className="mx-auto h-8 w-8 text-ink-400" />
        <h1 className="mt-4 font-serif text-3xl">Keep a list for later</h1>
        <p className="mt-2 text-ink-500">Sign in to keep your wishlist synced across sessions.</p>
        <Button asChild className="mt-6" variant="accent"><Link to="/login">Sign in</Link></Button>
      </div>
    );
  }
  if (query.isLoading) return <p className="p-10 text-center text-ink-500">Loading your wishlist…</p>;
  if (query.isError) return <p role="alert" className="p-10 text-center text-red-700">{query.error.message}</p>;

  const books: Book[] = (query.data ?? []).map((book) => ({
    ...book,
    id: book._id,
    effectivePrice: Math.round(book.price * (1 - book.discountPercent / 100) * 100) / 100,
    inStock: book.stock > 0,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Saved for another day</p>
      <h1 className="mt-1 font-serif text-4xl">Your wishlist</h1>
      {!books.length ? (
        <div className="mt-8 rounded-xl border border-ink-100 bg-white p-10 text-center">
          <p className="font-serif text-2xl">Nothing saved just yet.</p>
          <Button asChild className="mt-6" variant="accent"><Link to="/catalog">Browse the catalog</Link></Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {books.map((book) => (
            <div key={book.id} className="relative">
              <BookCard book={book} />
              <button
                type="button"
                aria-label={`Remove ${book.title} from wishlist`}
                className="absolute right-3 top-3 rounded-full bg-white p-2 text-ink-600 shadow hover:text-red-700"
                disabled={remove.isPending}
                onClick={() => remove.mutate(book.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {remove.isError && <p role="alert" className="mt-4 text-sm text-red-700">{remove.error.message}</p>}
    </div>
  );
}
