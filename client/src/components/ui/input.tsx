import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm ring-offset-parchment placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
