import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminBookFormPage } from '@/pages/admin/AdminBookFormPage';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const lookupRecords = [
  { _id: '507f1f77bcf86cd799439011', name: 'Fiction', slug: 'fiction' },
];

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/books/new']}>
        <Routes>
          <Route path="/admin/books/new" element={<AdminBookFormPage />} />
          <Route path="/admin/books" element={<p>Books list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminBookFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: lookupRecords } as never);
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never);
  });

  it('submits a real multipart payload and returns to the books list', async () => {
    renderForm();

    await screen.findByLabelText('Title');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'A Test Story' } });
    fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: '9781234567890' } });
    fireEvent.change(screen.getByLabelText('Author'), { target: { value: lookupRecords[0]._id } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: lookupRecords[0]._id } });
    fireEvent.change(screen.getByLabelText('Selling price (INR)'), { target: { value: '299' } });
    fireEvent.change(screen.getByLabelText('Available stock'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'A thoughtful test title for the Books Bin catalog.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create book' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/admin/books', expect.any(FormData));
      expect(screen.getByText('Books list')).toBeInTheDocument();
    });

    const payload = vi.mocked(api.post).mock.calls[0][1] as FormData;
    expect(payload.get('title')).toBe('A Test Story');
    expect(payload.get('stock')).toBe('8');
    expect(payload.get('featured')).toBe('false');
    expect(payload.get('isActive')).toBe('true');
  });
});
