import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    amount,
  );
}

export function bookCoverUrl(path?: string) {
  if (!path) return '/placeholder-book.svg';
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}
