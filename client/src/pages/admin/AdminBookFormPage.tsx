import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ImagePlus, Save } from 'lucide-react';
import { api } from '@/lib/api';
import type { Book } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { bookCoverUrl } from '@/lib/utils';

interface NamedRecord {
  _id: string;
  name: string;
  slug: string;
}

interface AdminBook extends Book {
  category: NamedRecord;
  author: NamedRecord;
}

interface BookForm {
  title: string;
  isbn: string;
  description: string;
  category: string;
  author: string;
  publisher: string;
  publishedAt: string;
  price: string;
  discountPercent: string;
  stock: string;
  featured: boolean;
  isActive: boolean;
}

const blankForm: BookForm = {
  title: '',
  isbn: '',
  description: '',
  category: '',
  author: '',
  publisher: '',
  publishedAt: '',
  price: '',
  discountPercent: '0',
  stock: '0',
  featured: false,
  isActive: true,
};

function recordId(record: NamedRecord | string) {
  return typeof record === 'string' ? record : record._id;
}

export function AdminBookFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BookForm>(blankForm);
  const [covers, setCovers] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const bookQuery = useQuery({
    queryKey: ['admin-book', id],
    queryFn: async () => (await api.get<AdminBook>(`/admin/books/${id}`)).data,
    enabled: editing,
  });
  const categoriesQuery = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => (await api.get<NamedRecord[]>('/admin/categories')).data,
  });
  const authorsQuery = useQuery({
    queryKey: ['admin-authors'],
    queryFn: async () => (await api.get<NamedRecord[]>('/admin/authors')).data,
  });

  useEffect(() => {
    const book = bookQuery.data;
    if (!book) return;
    setForm({
      title: book.title,
      isbn: book.isbn,
      description: book.description,
      category: recordId(book.category),
      author: recordId(book.author),
      publisher: book.publisher ?? '',
      publishedAt: book.publishedAt ? new Date(book.publishedAt).toISOString().slice(0, 10) : '',
      price: String(book.price),
      discountPercent: String(book.discountPercent),
      stock: String(book.stock),
      featured: book.featured,
      isActive: book.isActive,
    });
  }, [bookQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = new FormData();
      for (const [key, value] of Object.entries(form)) {
        if (key === 'publishedAt' && !value) continue;
        payload.append(key, String(value));
      }
      for (const cover of covers) payload.append('covers', cover);
      return editing
        ? api.patch<AdminBook>(`/admin/books/${id}`, payload)
        : api.post<AdminBook>('/admin/books', payload);
    },
    onSuccess: async () => {
      setSaved(true);
      setError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-books'] }),
        queryClient.invalidateQueries({ queryKey: ['books'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-book', id] }),
      ]);
      if (!editing) navigate('/admin/books');
    },
    onError: (reason) => {
      setSaved(false);
      setError(reason instanceof Error ? reason.message : 'Unable to save this book.');
    },
  });

  function setField<K extends keyof BookForm>(key: K, value: BookForm[K]) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (covers.length > 5) {
      setError('Choose no more than five cover images.');
      return;
    }
    save.mutate();
  }

  const isLoading = (editing && bookQuery.isLoading) || categoriesQuery.isLoading || authorsQuery.isLoading;
  const loadError = bookQuery.error ?? categoriesQuery.error ?? authorsQuery.error;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin/books"><ArrowLeft className="h-4 w-4" /> Back to books</Link>
      </Button>
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Inventory</p>
        <h1 className="mt-1 font-serif text-3xl">{editing ? 'Edit book' : 'Add a new book'}</h1>
        <p className="mt-2 text-sm text-ink-500">Book details and stock updates publish directly to the storefront.</p>
      </div>

      {isLoading && <p className="text-ink-500">Loading book details…</p>}
      {loadError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{loadError.message}</p>}

      {!isLoading && !loadError && (
        <>
          {editing && bookQuery.data?.coverImages.length ? (
            <div className="flex flex-wrap gap-3">
              {bookQuery.data.coverImages.map((cover) => (
                <img
                  key={cover}
                  className="h-28 w-20 rounded-md border border-ink-100 object-cover"
                  src={bookCoverUrl(cover)}
                  alt={`${bookQuery.data?.title} cover`}
                />
              ))}
            </div>
          ) : null}
          <form onSubmit={submit} className="space-y-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-card md:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Title">
                <Input required maxLength={300} value={form.title} onChange={(e) => setField('title', e.target.value)} />
              </Field>
              <Field label="ISBN">
                <Input required minLength={10} maxLength={20} value={form.isbn} onChange={(e) => setField('isbn', e.target.value)} />
              </Field>
              <Field label="Author">
                <select
                  required
                  className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm"
                  value={form.author}
                  onChange={(e) => setField('author', e.target.value)}
                >
                  <option value="">Choose an author</option>
                  {authorsQuery.data?.map((author) => <option key={author._id} value={author._id}>{author.name}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <select
                  required
                  className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm"
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                >
                  <option value="">Choose a category</option>
                  {categoriesQuery.data?.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                </select>
              </Field>
              <Field label="Publisher">
                <Input maxLength={200} value={form.publisher} onChange={(e) => setField('publisher', e.target.value)} />
              </Field>
              <Field label="Publication date">
                <Input type="date" value={form.publishedAt} onChange={(e) => setField('publishedAt', e.target.value)} />
              </Field>
              <Field label="Selling price (INR)">
                <Input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setField('price', e.target.value)} />
              </Field>
              <Field label="Discount (%)">
                <Input required type="number" min="0" max="100" step="0.01" value={form.discountPercent} onChange={(e) => setField('discountPercent', e.target.value)} />
              </Field>
              <Field label="Available stock">
                <Input required type="number" min="0" step="1" value={form.stock} onChange={(e) => setField('stock', e.target.value)} />
              </Field>
              <Field label="Cover images (up to 5)">
                <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-ink-300 px-3 text-sm text-ink-600 hover:bg-ink-50">
                  <ImagePlus className="h-4 w-4" />
                  {covers.length ? `${covers.length} image${covers.length === 1 ? '' : 's'} selected` : 'Choose image files'}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => setCovers(Array.from(e.target.files ?? []).slice(0, 6))}
                  />
                </label>
                <p className="mt-1 text-xs text-ink-400">JPEG, PNG or WebP. Maximum 5 MB per image.</p>
              </Field>
            </div>
            <Field label="Description">
              <Textarea required minLength={10} rows={5} value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-ink-100 pt-5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.featured} onChange={(e) => setField('featured', e.target.checked)} />
                Feature on the home page
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} />
                Visible in the storefront
              </label>
            </div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {saved && <p role="status" className="text-sm text-green-700">Book saved and storefront collections refreshed.</p>}
            <div className="flex justify-end">
              <Button type="submit" variant="accent" disabled={save.isPending}>
                <Save className="h-4 w-4" /> {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create book'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
