import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, ArrowUpRight, Heart, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BookCover } from '@/components/BookCover';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency } from '@/lib/utils';
import type { Book } from '@/types';

interface HomeData {
  featured: Book[];
  bestsellers: Book[];
  newArrivals: Book[];
}

interface Category {
  name: string;
  slug: string;
}

interface Author {
  name: string;
  slug: string;
  bio?: string;
}

interface WishlistItem {
  _id: string;
}

export function HomePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const homeQuery = useQuery({
    queryKey: ['home'],
    queryFn: async () => (await api.get<HomeData>('/catalog/home')).data,
  });
  const categoriesQuery = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: async () => (await api.get<Category[]>('/catalog/categories')).data,
  });
  const authorsQuery = useQuery({
    queryKey: ['catalog-authors'],
    queryFn: async () => (await api.get<Author[]>('/catalog/authors')).data,
  });
  const wishlistQuery = useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => (await api.get<WishlistItem[]>('/users/wishlist')).data,
    enabled: Boolean(user),
  });

  const addToCart = useMutation({
    mutationFn: (bookId: string) => api.post('/cart/items', { bookId, quantity: 1 }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      showToast('Added to your bag', { description: 'Your selection is waiting in your cart.' });
    },
  });
  const toggleWishlist = useMutation({
    mutationFn: ({ bookId, saved }: { bookId: string; saved: boolean }) =>
      saved ? api.delete(`/users/wishlist/${bookId}`) : api.post(`/users/wishlist/${bookId}`),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      showToast(variables.saved ? 'Removed from wishlist' : 'Saved for later');
    },
  });

  const data = homeQuery.data;
  const heroBooks = data?.featured.length ? data.featured : data?.newArrivals ?? [];
  const heroBook = heroBooks[0];
  const sideBooks = heroBooks.slice(1, 3);
  const spotlightAuthor = authorsQuery.data?.find((author) => author.bio?.trim());

  return (
    <div className="storefront">
      <section className="storefront-hero">
        <div className="storefront-hero-grain" aria-hidden="true" />
        <div className="storefront-hero-inner">
          <div className="storefront-hero-copy">
            <p className="storefront-eyebrow"><span /> Your independent bookstore</p>
            <h1>Find your next<br /><em>favourite story.</em></h1>
            <p className="storefront-hero-description">
              From can’t-put-it-down fiction to ideas that stay with you, your next read is waiting on our shelves.
            </p>
            <div className="storefront-hero-actions">
              <Button asChild variant="accent" size="lg">
                <Link to="/catalog">Shop all books <ArrowRight aria-hidden="true" /></Link>
              </Button>
              <a className="storefront-text-link" href="#discover">
                Browse by category <ArrowDown aria-hidden="true" />
              </a>
            </div>
            <div className="storefront-hero-note">
              <span className="storefront-note-rule" />
              <span>Stories for every mood and moment.</span>
            </div>
          </div>

          <div className="storefront-hero-art" aria-label={heroBook ? `Featured book: ${heroBook.title}` : 'Book cover illustration'}>
            <div className="storefront-art-orbit storefront-art-orbit-one" aria-hidden="true" />
            <div className="storefront-art-orbit storefront-art-orbit-two" aria-hidden="true" />
            <span className="storefront-art-caption">A new world<br />on every page</span>
            {sideBooks.map((book, index) => (
              <Link
                key={book.id}
                className={`storefront-book storefront-book-side storefront-book-side-${index + 1}`}
                to={`/books/${book.slug}`}
                aria-label={`Discover ${book.title}`}
              >
                <BookCover book={book} decorative />
              </Link>
            ))}
            {heroBook ? (
              <Link
                className="storefront-book storefront-book-main"
                to={`/books/${heroBook.slug}`}
                aria-label={`Discover ${heroBook.title}`}
              >
                <span className="storefront-book-pages" aria-hidden="true" />
                <BookCover book={heroBook} decorative loading="eager" />
                <span className="storefront-book-shadow" aria-hidden="true" />
              </Link>
            ) : (
              <div className="storefront-book storefront-book-main storefront-book-empty">
                <span>Open a<br />new chapter</span>
              </div>
            )}
            {heroBook && (
              <Link className="storefront-art-label" to={`/books/${heroBook.slug}`}>
                <span>Picked from our shelves</span>
                <strong>{heroBook.title}</strong>
                <span>{formatCurrency(heroBook.effectivePrice)} <ArrowUpRight aria-hidden="true" /></span>
              </Link>
            )}
            <span className="storefront-art-index" aria-hidden="true">01 / 03</span>
          </div>
        </div>
        <div className="storefront-hero-bottom">
          <span>Good books. Great places to go.</span>
          <span>Find a new favourite <ArrowDown aria-hidden="true" /></span>
        </div>
      </section>
      <div className="storefront-ribbon" aria-label="Browse every kind of story">
        <div>
          <span>Fiction</span><i aria-hidden="true" /><span>Fantasy</span><i aria-hidden="true" /><span>Mystery</span><i aria-hidden="true" />
          <span>Self-help</span><i aria-hidden="true" /><span>New perspectives</span><i aria-hidden="true" />
        </div>
      </div>

      <section className="storefront-assurances" aria-label="Shopping information">
        <div><span className="storefront-assurance-mark">01</span><p>Checkout options shown before you order</p></div>
        <div><span className="storefront-assurance-mark">02</span><p>Shipping costs shown in your bag</p></div>
        <div><span className="storefront-assurance-mark">03</span><p>Track order details from your account</p></div>
      </section>

      <main className="storefront-main">
        <section className="storefront-section storefront-categories" id="discover">
          <div className="storefront-section-heading">
            <div>
              <p className="storefront-eyebrow">A little something for every reader</p>
              <h2>Shop by category.</h2>
            </div>
            <Link className="storefront-view-link" to="/catalog">View all categories <ArrowRight aria-hidden="true" /></Link>
          </div>
          {categoriesQuery.isLoading && <p className="storefront-status">Gathering the shelves…</p>}
          {categoriesQuery.isError && <p className="storefront-status" role="alert">Collections are unavailable right now.</p>}
          {categoriesQuery.data?.length ? (
            <div className="storefront-category-list">
              {categoriesQuery.data.map((category, index) => (
                <Link className="storefront-category" to={`/categories/${category.slug}`} key={category.slug}>
                  <span className="storefront-category-number">0{index + 1}</span>
                  <span className="storefront-category-name">{category.name}</span>
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : !categoriesQuery.isLoading && !categoriesQuery.isError ? (
            <p className="storefront-status">Browse the catalog to explore available books.</p>
          ) : null}
        </section>

        <section className="storefront-section storefront-books-section" id="featured-shelf">
          {homeQuery.isLoading && <p className="storefront-status">Finding a few good stories…</p>}
          {homeQuery.isError && (
            <p className="storefront-status storefront-status-error" role="alert">
              We couldn’t load the shelves just now. Please try again in a moment.
            </p>
          )}
          {data && (
            <>
              {data.bestsellers.length > 0 && (
                <BookShelf
                  id="bestsellers"
                  eyebrow="Loved by readers"
                  title="The bestsellers"
                  books={data.bestsellers}
                  userId={user?.id}
                  wishlistIds={new Set(wishlistQuery.data?.map((item) => item._id) ?? [])}
                  wishlistUnavailable={wishlistQuery.isLoading || wishlistQuery.isError}
                  actionPending={addToCart.isPending || toggleWishlist.isPending}
                  onAddToCart={(book) => {
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    addToCart.mutate(book.id);
                  }}
                  onToggleWishlist={(book) => {
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    const saved = wishlistQuery.data?.some((item) => item._id === book.id) ?? false;
                    toggleWishlist.mutate({ bookId: book.id, saved });
                  }}
                />
              )}
              {data.featured.length > 0 && (
                <BookShelf
                  eyebrow="Chosen for the shelf"
                  title="Featured reads"
                  books={data.featured}
                  userId={user?.id}
                  wishlistIds={new Set(wishlistQuery.data?.map((item) => item._id) ?? [])}
                  wishlistUnavailable={wishlistQuery.isLoading || wishlistQuery.isError}
                  actionPending={addToCart.isPending || toggleWishlist.isPending}
                  onAddToCart={(book) => {
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    addToCart.mutate(book.id);
                  }}
                  onToggleWishlist={(book) => {
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    const saved = wishlistQuery.data?.some((item) => item._id === book.id) ?? false;
                    toggleWishlist.mutate({ bookId: book.id, saved });
                  }}
                />
              )}
              <BookShelf
                id="new-arrivals"
                eyebrow="Fresh from the press"
                title="New arrivals"
                books={data.newArrivals}
                userId={user?.id}
                wishlistIds={new Set(wishlistQuery.data?.map((item) => item._id) ?? [])}
                wishlistUnavailable={wishlistQuery.isLoading || wishlistQuery.isError}
                actionPending={addToCart.isPending || toggleWishlist.isPending}
                onAddToCart={(book) => {
                  if (!user) {
                    navigate('/login');
                    return;
                  }
                  addToCart.mutate(book.id);
                }}
                onToggleWishlist={(book) => {
                  if (!user) {
                    navigate('/login');
                    return;
                  }
                  const saved = wishlistQuery.data?.some((item) => item._id === book.id) ?? false;
                  toggleWishlist.mutate({ bookId: book.id, saved });
                }}
              />
              {!data.newArrivals.length && !data.featured.length && !data.bestsellers.length && (
                <div className="storefront-empty-shelf">
                  <p className="storefront-eyebrow">The shelves are waiting</p>
                  <h2>Something good is on its way.</h2>
                  <p>There aren’t any books to show just yet. Check back soon or browse the catalog.</p>
                  <Button asChild variant="accent"><Link to="/catalog">Browse the catalog</Link></Button>
                </div>
              )}
              {!data.bestsellers.length && (
                <div className="storefront-bestseller-note" id="bestsellers">
                  <span className="storefront-eyebrow">A list in the making</span>
                  <p>Our bestsellers list will take shape as readers complete their orders.</p>
                </div>
              )}
            </>
          )}
          {addToCart.isError && <p className="storefront-inline-error" role="alert">{addToCart.error.message}</p>}
          {toggleWishlist.isError && <p className="storefront-inline-error" role="alert">{toggleWishlist.error.message}</p>}
          {user && wishlistQuery.isError && (
            <p className="storefront-inline-error" role="alert">Wishlist actions are unavailable: {wishlistQuery.error.message}</p>
          )}
        </section>

        {spotlightAuthor && (
          <section className="storefront-author">
            <div className="storefront-author-monogram" aria-hidden="true">
              {spotlightAuthor.name.trim().charAt(0).toUpperCase()}
            </div>
            <div className="storefront-author-copy">
              <p className="storefront-eyebrow">Meet a voice on our shelves</p>
              <h2>{spotlightAuthor.name}</h2>
              <p>{spotlightAuthor.bio}</p>
              <Link className="storefront-text-link" to={`/authors/${spotlightAuthor.slug}`}>
                Explore their books <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <span className="storefront-author-aside" aria-hidden="true">AUTHOR<br />SPOTLIGHT</span>
          </section>
        )}

        <section className="storefront-discovery">
          <div>
            <p className="storefront-eyebrow">Your next chapter starts here</p>
            <h2>There’s a story<br />with your name on it.</h2>
          </div>
          <Button asChild variant="accent" size="lg">
            <Link to="/catalog">Find your next read <ArrowRight aria-hidden="true" /></Link>
          </Button>
          <span className="storefront-discovery-star" aria-hidden="true" />
        </section>
      </main>
    </div>
  );
}

function BookShelf({
  id,
  eyebrow,
  title,
  books,
  userId,
  wishlistIds,
  wishlistUnavailable,
  actionPending,
  onAddToCart,
  onToggleWishlist,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  books: Book[];
  userId?: string;
  wishlistIds: Set<string>;
  wishlistUnavailable: boolean;
  actionPending: boolean;
  onAddToCart: (book: Book) => void;
  onToggleWishlist: (book: Book) => void;
}) {
  if (!books.length) return null;
  return (
    <section className="storefront-shelf" id={id}>
      <div className="storefront-section-heading">
        <div>
          <p className="storefront-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <Link className="storefront-view-link" to="/catalog">View the catalog <ArrowRight aria-hidden="true" /></Link>
      </div>
      <div className="storefront-book-grid">
        {books.map((book) => (
          <article className="storefront-product" key={book.id}>
            <Link className="storefront-product-cover" to={`/books/${book.slug}`} aria-label={`View ${book.title}`}>
              <BookCover book={book} decorative />
              {book.discountPercent > 0 && <span className="storefront-product-badge">{book.discountPercent}% off</span>}
            </Link>
            <div className="storefront-product-details">
              <div>
                <p className="storefront-product-author">
                  {typeof book.author === 'object' ? book.author.name : 'A Books Bin find'}
                </p>
                <Link className="storefront-product-title" to={`/books/${book.slug}`}>{book.title}</Link>
                <div className="storefront-product-price">
                  <strong>{formatCurrency(book.effectivePrice)}</strong>
                  {book.discountPercent > 0 && <del>{formatCurrency(book.price)}</del>}
                </div>
              </div>
              <div className="storefront-product-actions">
                <button
                  type="button"
                  aria-label={`${wishlistIds.has(book.id) ? 'Remove' : 'Add'} ${book.title} ${wishlistIds.has(book.id) ? 'from' : 'to'} wishlist`}
                  aria-pressed={wishlistIds.has(book.id)}
                  disabled={actionPending || (Boolean(userId) && wishlistUnavailable)}
                  onClick={() => onToggleWishlist(book)}
                >
                  <Heart aria-hidden="true" fill={wishlistIds.has(book.id) ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  aria-label={`Add ${book.title} to bag`}
                  disabled={actionPending || !book.inStock}
                  onClick={() => onAddToCart(book)}
                >
                  <ShoppingBag aria-hidden="true" />
                </button>
              </div>
            </div>
            {!book.inStock && <p className="storefront-stock-note">Currently out of stock</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
