import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter } from 'react-router-dom';
import App from '@/App';

function response(status: number, data?: unknown, error?: { code?: string; message?: string }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: async () => status >= 200 && status < 300
      ? { success: true, data }
      : { success: false, error: { code: error?.code, message: error?.message ?? 'Request failed' } },
  } as Response;
}

describe('account registration and sign-in screens', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not carry registration verification state into the sign-in page', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/me')) return response(401, undefined, { message: 'Unauthorized' });
      if (url.endsWith('/auth/refresh')) return response(401, undefined, { message: 'Unauthorized' });
      if (url.endsWith('/auth/register')) {
        return response(202, {
          email: 'reader@example.com',
          requiresEmailVerification: true,
        });
      }
      if (url.endsWith('/catalog/categories')) return response(200, []);
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/register']}>
        <App />
        <Link to="/login">Go to sign in</Link>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Create an account' });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Reader One' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'reader-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Go to sign in' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
    });
  });

  it('provides an accessible password visibility toggle', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/me') || url.endsWith('/auth/refresh')) {
        return response(401, undefined, { message: 'Unauthorized' });
      }
      if (url.endsWith('/catalog/categories')) return response(200, []);
      throw new Error(`Unexpected request: GET ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Welcome back' });
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });
});
