import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Heart, ShoppingBag } from 'lucide-react';
import { BookCover } from '@/components/BookCover';
import { api } from '@/lib/api';
import type { Book } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export function BookDetailPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();

  const wishlistQuery = useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => (await api.get<Array<{ _id: string }>>('/users/wishlist')).data,
    enabled: Boolean(user),
  });

  const { data: book, isLoading, isError } = useQuery({
    queryKey: ['book', slug],
    queryFn: async () => {
      const { data } = await api.get<Book>(`/books/slug/${slug}`);
      return data;
    },
    enabled: !!slug,
  });

  const addToCart = useMutation({
    mutationFn: async () => api.post('/cart/items', { bookId: book?.id, quantity: 1 }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['cart'] });
      showToast('Added to your bag', { description: `${book?.title} is now in your cart.` });
    },
  });
  const wishlistMutation = useMutation({
    mutationFn: (bookId: string) =>
      wishlistQuery.data?.some((item) => item._id === bookId)
        ? api.delete(`/users/wishlist/${bookId}`)
        : api.post(`/users/wishlist/${bookId}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['wishlist'] });
      showToast(
        wishlistQuery.data?.some((item) => item._id === book?.id) ? 'Removed from wishlist' : 'Saved to wishlist',
        { description: book?.title },
      );
    },
  });

  if (isLoading) return <p className="p-8">Loading…</p>;
  if (isError || !book) return <p className="p-8">Book not found.</p>;

  const author = typeof book.author === 'object' ? book.author : null;
  const category = typeof book.category === 'object' ? book.category : null;

  return (
    <div className="storefront-detail">
      <div className="storefront-detail-cover">
        <BookCover book={book} decorative loading="eager" />
      </div>
      <div className="storefront-detail-copy">
        <div>
          {category && (
            <Link to={`/categories/${category.slug}`} className="storefront-detail-category">
              {category.name}
            </Link>
          )}
          <h1>{book.title}</h1>
          {author && (
            <Link to={`/authors/${author.slug}`} className="storefront-detail-author">
              {author.name}
            </Link>
          )}
        </div>
        <p className="storefront-detail-price">
          <strong>{formatCurrency(book.effectivePrice)}</strong>
          {book.discountPercent > 0 && <del>{formatCurrency(book.price)}</del>}
        </p>
        <p className="storefront-detail-description">{book.description}</p>
        <dl className="storefront-detail-facts">
          <div>
            <dt>ISBN</dt>
            <dd>{book.isbn}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>{book.inStock ? 'In stock' : 'Currently out of stock'}</dd>
          </div>
          {book.publisher && (
            <div>
              <dt>Publisher</dt>
              <dd>{book.publisher}</dd>
            </div>
          )}
          {book.publishedAt && (
            <div>
              <dt>Published</dt>
              <dd>{new Date(book.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</dd>
            </div>
          )}
        </dl>
        <div className="storefront-detail-actions">
          <Button
            variant="accent"
            disabled={!book.inStock || !user || addToCart.isPending}
            onClick={() => addToCart.mutate()}
          >
            <ShoppingBag className="h-4 w-4" />
            {addToCart.isPending ? 'Adding…' : user ? 'Add to bag' : 'Sign in to purchase'}
          </Button>
          {user && (
            <Button
              variant="outline"
              disabled={wishlistMutation.isPending || wishlistQuery.isLoading}
              onClick={() => book && wishlistMutation.mutate(book.id)}
              aria-pressed={Boolean(wishlistQuery.data?.some((item) => item._id === book.id))}
            >
              <Heart className="h-4 w-4" fill={wishlistQuery.data?.some((item) => item._id === book.id) ? 'currentColor' : 'none'} />
              {wishlistQuery.data?.some((item) => item._id === book.id) ? 'Saved to wishlist' : 'Save to wishlist'}
            </Button>
          )}
          {!user && (
            <Button asChild variant="outline">
              <Link to="/login">Login</Link>
            </Button>
          )}
        </div>
        {addToCart.isError && <p role="alert" className="storefront-detail-feedback">{addToCart.error.message}</p>}
        {wishlistMutation.isError && <p role="alert" className="storefront-detail-feedback">{wishlistMutation.error.message}</p>}
      </div>
    </div>
  );
}
