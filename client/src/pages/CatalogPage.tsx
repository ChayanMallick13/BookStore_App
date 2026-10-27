import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Book } from '@/types';
import { BookCard } from '@/components/BookCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const debouncedQ = useDebouncedValue(q, 300);
  const page = Number(params.get('page') ?? 1);
  const sort = params.get('sort') ?? 'createdAt';
  const inStock = params.get('inStock') === 'true';

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set('q', debouncedQ);
    sp.set('page', String(page));
    sp.set('sort', sort);
    if (inStock) sp.set('inStock', 'true');
    return sp.toString();
  }, [debouncedQ, page, sort, inStock]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['books', queryString],
    queryFn: async () => {
      const res = await api.get<Book[]>(`/books?${queryString}`);
      return res;
    },
  });

  const meta = data?.meta as { totalPages?: number; page?: number } | undefined;

  return (
    <div className="storefront-catalog">
      <header className="storefront-catalog-heading">
        <div>
          <p className="storefront-eyebrow">A library of possibilities</p>
          <h1>Explore the collection.</h1>
          <p>Search, sort, and find the books that stay with you.</p>
        </div>
        <div className="storefront-catalog-controls">
          <form
            className="storefront-catalog-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const next = new URLSearchParams(params);
              const query = q.trim();
              if (query) next.set('q', query);
              else next.delete('q');
              next.set('page', '1');
              setParams(next);
            }}
          >
            <Search aria-hidden="true" />
            <Input
              aria-label="Search books"
              placeholder="Search titles, authors, or subjects"
              value={q}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                if (e.target.value) next.set('q', e.target.value);
                else next.delete('q');
                next.set('page', '1');
                setParams(next);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  const next = new URLSearchParams(params);
                  next.delete('q');
                  next.set('page', '1');
                  setParams(next);
                }
              }}
              className="storefront-catalog-search-input"
            />
            {q && (
              <button
                type="button"
                aria-label="Clear book search"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete('q');
                  next.set('page', '1');
                  setParams(next);
                }}
              >
                <X aria-hidden="true" />
              </button>
            )}
            <button type="submit" className="storefront-catalog-search-submit">
              Search
            </button>
          </form>
          <select
            aria-label="Sort books"
            className="h-10 rounded-md border border-ink-200 bg-white px-3 text-sm"
            value={sort}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              next.set('sort', e.target.value);
              setParams(next);
            }}
          >
            <option value="createdAt">Newest</option>
            <option value="price">Price</option>
            <option value="title">Title</option>
          </select>
          <Button
            aria-pressed={inStock}
            variant={inStock ? 'default' : 'outline'}
            onClick={() => {
              const next = new URLSearchParams(params);
              if (inStock) next.delete('inStock');
              else next.set('inStock', 'true');
              setParams(next);
            }}
          >
            In stock
          </Button>
        </div>
      </header>

      {isLoading && <p className="storefront-status">Finding books…</p>}
      {isError && <p role="alert" className="storefront-status storefront-status-error">Failed to load the catalog. Please try again.</p>}
      {data && !data.data.length && (
        <div className="storefront-catalog-empty">
          <p className="storefront-eyebrow">Nothing on this shelf</p>
          <h2>No books match your search.</h2>
          <p>Try another title, author, or subject—or browse the full collection.</p>
          <Button asChild variant="outline"><Link to="/catalog">Clear search</Link></Button>
        </div>
      )}

      <div className="storefront-catalog-grid">
        {data?.data.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>

      {meta?.totalPages && meta.totalPages > 1 && (
        <div className="mt-10 flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('page', String(page - 1));
              setParams(next);
            }}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-ink-500">
            Page {page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= (meta.totalPages ?? 1)}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('page', String(page + 1));
              setParams(next);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
