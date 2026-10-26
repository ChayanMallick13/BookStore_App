import { Link } from 'react-router-dom';
import { BookCover } from '@/components/BookCover';
import type { Book } from '@/types';
import { formatCurrency } from '@/lib/utils';

export function BookCard({ book }: { book: Book }) {
  const authorName = typeof book.author === 'object' ? book.author.name : undefined;
  return (
    <article className="book-card">
      <Link to={`/books/${book.slug}`} className="book-card-cover" aria-label={`View ${book.title}`}>
        <BookCover book={book} decorative />
      </Link>
      <div className="book-card-details">
        {authorName && <p>{authorName}</p>}
        <Link to={`/books/${book.slug}`}><h3>{book.title}</h3></Link>
        <div className="book-card-price">
          <strong>{formatCurrency(book.effectivePrice)}</strong>
          {book.discountPercent > 0 && <del>{formatCurrency(book.price)}</del>}
          {!book.inStock && <span>Out of stock</span>}
        </div>
      </div>
    </article>
  );
}
