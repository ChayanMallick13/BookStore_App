import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronDown, Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useToast } from '@/context/ToastContext';
import { cn } from '@/lib/utils';
import '@/styles/storefront.css';

interface Category {
  name: string;
  slug: string;
}

const currentYear = new Date().getFullYear();

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn('storefront-nav-link', isActive && 'is-active');

export function StoreLayout() {
  const { user, logout, sessionError } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const categoryMenuRef = useRef<HTMLDetailsElement>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const categoriesQuery = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: async () => (await api.get<Category[]>('/catalog/categories')).data,
  });

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 12);
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  useEffect(() => {
    function dismissCategoryMenu(event: PointerEvent) {
      const menu = categoryMenuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) {
        menu.open = false;
      }
    }

    function closeCategoryMenuOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && categoryMenuRef.current?.open) {
        categoryMenuRef.current.open = false;
      }
    }

    document.addEventListener('pointerdown', dismissCategoryMenu);
    document.addEventListener('keydown', closeCategoryMenuOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissCategoryMenu);
      document.removeEventListener('keydown', closeCategoryMenuOnEscape);
    };
  }, []);

  useEffect(() => {
    function dismissSearch(event: PointerEvent) {
      if (searchOpen && !searchFormRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener('pointerdown', dismissSearch);
    return () => document.removeEventListener('pointerdown', dismissSearch);
  }, [searchOpen]);

  async function handleLogout() {
    try {
      await logout();
      showToast('Signed out', { description: 'You have been safely logged out.' });
    } catch (error) {
      showToast('Could not sign out', {
        description: error instanceof Error ? error.message : 'Please try again.',
        kind: 'error',
      });
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/catalog?q=${encodeURIComponent(query)}` : '/catalog');
    setSearchOpen(false);
    setMobileOpen(false);
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-parchment text-ink-900">
      <header className={cn('storefront-header', scrolled && 'is-scrolled')}>
        <div className="storefront-announcement">
          <span>Make room for a good story</span>
          <Link to="/catalog">Browse the collection <ArrowRight aria-hidden="true" /></Link>
        </div>
        <div className="storefront-header-main">
          <Link to="/" className="storefront-brand" aria-label="Books Bin home">
            <span className="storefront-brand-mark"><BookOpen aria-hidden="true" /></span>
            <span>Books Bin<small>Independent bookstore</small></span>
          </Link>

          <nav className="storefront-desktop-nav" aria-label="Main navigation">
            <NavLink to="/catalog" className={navLinkClass}>Discover</NavLink>
            <details className="storefront-category-menu" ref={categoryMenuRef}>
              <summary>Product categories <ChevronDown aria-hidden="true" /></summary>
              <div className="storefront-category-popover">
                {categoriesQuery.data?.length ? categoriesQuery.data.map((category) => (
                  <Link key={category.slug} to={`/categories/${category.slug}`}>
                    {category.name}<ArrowRight aria-hidden="true" />
                  </Link>
                )) : (
                  <Link to="/catalog">Browse the catalog <ArrowRight aria-hidden="true" /></Link>
                )}
              </div>
            </details>
            <a className="storefront-nav-link" href="/#bestsellers">Bestsellers</a>
            <a className="storefront-nav-link" href="/#new-arrivals">New arrivals</a>
            <NavLink to="/about" className={navLinkClass}>About us</NavLink>
            <NavLink to="/shipping-policy" className={navLinkClass}>Shipping</NavLink>
          </nav>

          <div className="storefront-header-actions">
            <form ref={searchFormRef} className={cn('storefront-search', searchOpen && 'is-open')} onSubmit={submitSearch}>
              {searchOpen && (
                <input
                  aria-label="Search books"
                  autoFocus
                  placeholder="Title, author, or subject"
                  maxLength={120}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setSearchOpen(false);
                  }}
                />
              )}
              {searchOpen && search && (
                <button
                  type="button"
                  className="storefront-search-clear"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                >
                  <X aria-hidden="true" />
                </button>
              )}
              <button
                type={searchOpen ? 'submit' : 'button'}
                aria-label={searchOpen ? 'Search catalog' : 'Open book search'}
                aria-expanded={searchOpen}
                onClick={() => {
                  if (!searchOpen) setSearchOpen(true);
                }}
              >
                <Search aria-hidden="true" />
              </button>
            </form>
            <Link className="storefront-icon-link" to="/wishlist" aria-label="Wishlist"><Heart aria-hidden="true" /></Link>
            <Link className="storefront-icon-link" to="/cart" aria-label="Shopping bag"><ShoppingBag aria-hidden="true" /></Link>
            <ThemeToggle />
            {user ? (
              <div className="storefront-account">
                {user.role === 'admin' && <Link className="storefront-account-link" to="/admin">Admin</Link>}
                <Link className="storefront-account-link" to="/orders">Orders</Link>
                <button className="storefront-account-link" type="button" onClick={() => void handleLogout()}>Sign out</button>
              </div>
            ) : (
              <Button asChild size="sm" variant="outline" className="storefront-sign-in">
                <Link to="/login"><User aria-hidden="true" /> Sign in</Link>
              </Button>
            )}
            <button
              className="storefront-mobile-toggle"
              type="button"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="storefront-mobile-panel">
            <form className="storefront-mobile-search" onSubmit={submitSearch}>
              <Search aria-hidden="true" />
              <input
                aria-label="Search books"
                placeholder="Search books"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setMobileOpen(false);
                }}
              />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
                  <X aria-hidden="true" />
                </button>
              )}
              <button type="submit" aria-label="Submit search"><ArrowRight aria-hidden="true" /></button>
            </form>
            <nav aria-label="Mobile navigation">
              <NavLink to="/catalog" onClick={closeMobileMenu}>Discover all books</NavLink>
              <a href="/#bestsellers" onClick={closeMobileMenu}>Bestsellers</a>
              <a href="/#new-arrivals" onClick={closeMobileMenu}>New arrivals</a>
              {categoriesQuery.data?.map((category) => (
                <Link key={category.slug} to={`/categories/${category.slug}`} onClick={closeMobileMenu}>
                  {category.name}
                </Link>
              ))}
              {user && <Link to="/orders" onClick={closeMobileMenu}>My orders</Link>}
              <Link to="/about" onClick={closeMobileMenu}>About us</Link>
              <Link to="/shipping-policy" onClick={closeMobileMenu}>Shipping & delivery</Link>
              {user?.role === 'admin' && <Link to="/admin" onClick={closeMobileMenu}>Admin dashboard</Link>}
              {!user && <Link to="/login" onClick={closeMobileMenu}>Sign in</Link>}
              <Link to="/wishlist" onClick={closeMobileMenu}>Wishlist</Link>
              <Link to="/cart" onClick={closeMobileMenu}>Shopping bag</Link>
            </nav>
          </div>
        )}
      </header>

      {sessionError && (
        <p role="status" className="mx-auto w-full max-w-7xl px-4 py-3 text-sm text-accent">
          {sessionError}
        </p>
      )}
      <main><Outlet /></main>

      <footer className="storefront-footer">
        <div className="storefront-footer-main">
          <div className="storefront-footer-brand">
            <Link to="/" className="storefront-brand">
              <span className="storefront-brand-mark"><BookOpen aria-hidden="true" /></span>
              <span>Books Bin<small>Independent bookstore</small></span>
            </Link>
            <p>A good book has a way of finding you. Start looking.</p>
            <Link to="/catalog" className="storefront-footer-cta">Find your next read <ArrowRight aria-hidden="true" /></Link>
          </div>
          <div className="storefront-footer-column">
            <h2>Explore</h2>
            <Link to="/catalog">All books</Link>
            <Link to="/#bestsellers">Bestsellers</Link>
            <Link to="/#new-arrivals">New arrivals</Link>
            <Link to="/about">About Books Bin</Link>
          </div>
          <div className="storefront-footer-column">
            <h2>Help & support</h2>
            <Link to="/faq">FAQ</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/shipping-policy">Shipping</Link>
            <Link to="/returns">Returns</Link>
          </div>
          <div className="storefront-footer-column">
            <h2>Your account</h2>
            <Link to="/orders">Orders</Link>
            <Link to="/wishlist">Wishlist</Link>
            <Link to="/cart">Shopping bag</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
        <div className="storefront-footer-bottom">
          <span>© {currentYear} Books Bin. All rights reserved.</span>
          <span>Made for the love of a good story.</span>
        </div>
      </footer>
    </div>
  );
}

export function StoreBrandMark() {
  return <BookOpen className="h-5 w-5" />;
}
