import { useState } from 'react';
import type { Book } from '@/types';
import { bookCoverUrl } from '@/lib/utils';

const coverTones = ['moss', 'clay', 'ink', 'ochre', 'plum'] as const;

export function BookCover({
  book,
  decorative = false,
  loading = 'lazy',
}: {
  book: Book;
  decorative?: boolean;
  loading?: 'eager' | 'lazy';
}) {
  const source = book.coverImages[0];
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = !source || failedSource === source;
  const tone = Math.abs([...book.title].reduce((value, character) => value + character.charCodeAt(0), 0)) % coverTones.length;
  const author = typeof book.author === 'object' ? book.author.name : '';

  return (
    <span className={`book-cover${failed ? ` book-cover-${coverTones[tone]}` : ''}`}>
      {source && !failed && (
        <img
          src={bookCoverUrl(source)}
          alt={decorative ? '' : book.title}
          loading={loading}
          onError={() => setFailedSource(source)}
        />
      )}
      {failed && (
        <span
          className="book-cover-fallback"
          role={decorative ? undefined : 'img'}
          aria-label={decorative ? undefined : `${book.title}${author ? ` by ${author}` : ''}`}
          aria-hidden={decorative || undefined}
        >
          <span className="book-cover-kicker">Books Bin · Catalog</span>
          <strong>{book.title}</strong>
          {author && <span className="book-cover-author">{author}</span>}
          <span className="book-cover-seal" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
