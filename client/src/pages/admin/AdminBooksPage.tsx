import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Book } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export function AdminBooksPage() {
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const qc = useQueryClient();

  const queryString = useMemo(() => {
    const sp = new URLSearchParams({ admin: 'true', limit: '50' });
    if (debouncedQ) sp.set('q', debouncedQ);
    return sp.toString();
  }, [debouncedQ]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-books', queryString],
    queryFn: async () => api.get<Book[]>(`/admin/books?${queryString}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/books/${id}`),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-books'] }),
        qc.invalidateQueries({ queryKey: ['books'] }),
        qc.invalidateQueries({ queryKey: ['home'] }),
      ]);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-serif text-3xl">Books management</h1>
          <p className="text-sm text-ink-500">Create and manage inventory synced to the storefront.</p>
        </div>
        <Button asChild variant="accent">
          <Link to="/admin/books/new">
            <Plus className="h-4 w-4" /> Add new book
          </Link>
        </Button>
      </div>

      <form className="storefront-admin-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <Search aria-hidden="true" />
        <Input
          aria-label="Search books by title or ISBN"
          placeholder="Search by title or ISBN"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="storefront-admin-search-input"
        />
        {q && (
          <button type="button" aria-label="Clear book search" onClick={() => setQ('')}>
            <X aria-hidden="true" />
          </button>
        )}
      </form>

      {isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error.message}</p>}
      {remove.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{remove.error.message}</p>}
      <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-50 text-left text-ink-600">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">ISBN</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                  Loading books…
                </td>
              </tr>
            )}
            {data?.data.map((book) => (
              <tr key={book.id} className="border-t border-ink-100">
                <td className="px-4 py-3 font-medium">{book.title}</td>
                <td className="px-4 py-3">{book.isbn}</td>
                <td className="px-4 py-3">{formatCurrency(book.effectivePrice)}</td>
                <td className="px-4 py-3">{book.stock}</td>
                <td className="px-4 py-3">
                  {book.isArchived ? 'Archived' : book.isActive ? 'Active' : 'Hidden'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild size="sm" variant="outline" aria-label={`Edit ${book.title}`}>
                      <Link to={`/admin/books/${book.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" aria-label={`View ${book.title}`}>
                      <Link to={`/books/${book.slug}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Delete ${book.title}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete or archive "${book.title}"?`)) remove.mutate(book.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !isError && !data?.data.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-500">
                  No books found. Add a title to begin your inventory.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
