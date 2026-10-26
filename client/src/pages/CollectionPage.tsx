import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Book } from '@/types';
import { BookCard } from '@/components/BookCard';

interface CollectionResponse {
  category?: { name: string; description?: string };
  author?: { name: string; bio?: string };
  books: Book[];
}

export function CollectionPage({ type }: { type: 'categories' | 'authors' }) {
  const { slug } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['collection', type, slug],
    queryFn: async () => (await api.get<CollectionResponse>(`/catalog/${type}/${slug}`)).data,
    enabled: Boolean(slug),
  });
  const title = data?.category?.name ?? data?.author?.name ?? 'Collection';
  const description = data?.category?.description ?? data?.author?.bio;

  if (isLoading) return <p className="p-10 text-center text-ink-500">Finding books…</p>;
  if (isError) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><p role="alert" className="text-red-700">{error.message}</p><Link className="mt-4 inline-block underline" to="/catalog">Browse all books</Link></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <p className="text-xs uppercase tracking-[0.25em] text-ink-400">{type === 'categories' ? 'Browse by category' : 'Meet the author'}</p>
      <h1 className="mt-1 font-serif text-4xl">{title}</h1>
      {description && <p className="mt-3 max-w-2xl text-ink-500">{description}</p>}
      {data?.books.length ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {data.books.map((book) => <BookCard key={book.id} book={book} />)}
        </div>
      ) : (
        <p className="mt-8 rounded-xl border border-ink-100 bg-white p-8 text-center text-ink-500">There are no books in this collection yet.</p>
      )}
    </div>
  );
}
