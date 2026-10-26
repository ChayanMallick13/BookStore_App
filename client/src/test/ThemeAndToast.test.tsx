import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider, useToast } from '@/context/ToastContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/button';

function ToastTrigger() {
  const { showToast } = useToast();
  return <Button onClick={() => showToast('Added to your bag', { description: 'Atomic Habits is now in your cart.' })}>Add book</Button>;
}

describe('theme and action feedback', () => {
  it('persists the selected theme and announces action toasts', async () => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    render(
      <ThemeProvider>
        <ToastProvider>
          <ThemeToggle />
          <ToastTrigger />
        </ToastProvider>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    expect(localStorage.getItem('bookhaven-theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Add book' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Added to your bag');
    expect(screen.getByText('Atomic Habits is now in your cart.')).toBeInTheDocument();
  });
});
