import { useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider, useToast } from '@/context/ToastContext';
import { HomePage } from '@/pages/HomePage';
import { CatalogPage } from '@/pages/CatalogPage';
import { BookDetailPage } from '@/pages/BookDetailPage';
import { AdminBooksPage } from '@/pages/admin/AdminBooksPage';
import { AdminBookFormPage } from '@/pages/admin/AdminBookFormPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { OrdersPage, OrderDetailPage } from '@/pages/OrdersPage';
import { CollectionPage } from '@/pages/CollectionPage';
import { StoreInfoPage } from '@/pages/StoreInfoPage';
import { WishlistPage } from '@/pages/WishlistPage';
import { AdminOrdersPage } from '@/pages/admin/AdminOrdersPage';
import { AdminCustomersPage } from '@/pages/admin/AdminCustomersPage';
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage';
import { AdminCatalogPage } from '@/pages/admin/AdminCatalogPage';
import { AdminEngagementPage } from '@/pages/admin/AdminEngagementPage';
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/PasswordResetPage';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function AccountPage({ register = false }: { register?: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [otp, setOtp] = useState('');
  const [resending, setResending] = useState(false);
  const { user, loading, refresh } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <p className="p-10 text-center text-ink-500">Checking your session…</p>;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setPending(true);
    try {
      const { data } = await api.post<{ requiresEmailVerification?: boolean }>(register ? '/auth/register' : '/auth/login', {
        ...(register ? { name } : {}),
        email,
        password,
      });
      if (register) {
        if (!data.requiresEmailVerification) {
          throw new Error('Registration completed without a verification requirement. Please contact support.');
        }
        setVerificationPending(true);
        showToast('Check your email', { description: `Enter the six-digit code sent to ${email.trim()}.`, kind: 'info' });
        return;
      }
      const authenticatedUser = await refresh();
      if (!authenticatedUser) {
        throw new Error('Sign-in was accepted, but your browser session could not be confirmed. Please try again.');
      }
      navigate(authenticatedUser.role === 'admin' ? '/admin' : '/');
      showToast(register ? 'Account created' : 'Welcome back', { description: 'You are now signed in.' });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to sign in. Please try again.';
      if (!register && reason instanceof ApiError && reason.code === 'EMAIL_NOT_VERIFIED') {
        setVerificationPending(true);
        showToast('Verify your email', { description: 'Enter your code or request a new one.', kind: 'info' });
        return;
      }
      setError(message);
      showToast('Could not continue', { description: message, kind: 'error' });
    } finally {
      setPending(false);
    }
  }

  async function verifyEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setPending(true);
    try {
      await api.post('/auth/verify-email', { email: email.trim(), otp });
      const authenticatedUser = await refresh();
      if (!authenticatedUser) {
        throw new Error('Your email was verified, but your browser session could not be confirmed. Please sign in.');
      }
      showToast('Email verified', { description: 'Your Books Bin account is ready.' });
      navigate(authenticatedUser.role === 'admin' ? '/admin' : '/');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to verify your email.';
      setError(message);
      showToast('Email verification failed', { description: message, kind: 'error' });
    } finally {
      setPending(false);
    }
  }

  async function resendOtp() {
    if (resending) return;
    setError('');
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: email.trim() });
      showToast('New code sent', { description: `Check ${email.trim()} for your verification code.`, kind: 'info' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to resend the verification code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Books Bin account</p>
        <h1 className="mt-2 font-serif text-3xl">{verificationPending ? 'Verify your email' : register ? 'Create an account' : 'Welcome back'}</h1>
        <p className="mt-2 text-sm text-ink-500">
          {verificationPending
            ? `We sent a six-digit code to ${email.trim()}. It expires in 10 minutes.`
            : register ? 'Join our community of curious readers.' : 'Sign in to manage your orders and wishlist.'}
        </p>
        {!register && !verificationPending && typeof location.state?.message === 'string' && (
          <p role="status" className="mt-4 text-sm text-green-800">{location.state.message}</p>
        )}
        {verificationPending ? (
          <form className="mt-8 space-y-4" onSubmit={(event) => void verifyEmail(event)}>
            <label className="block space-y-1.5 text-sm font-medium">
              Verification code
              <Input
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-xl tracking-[0.5em]"
              />
            </label>
            {error && <p role="alert" className="text-sm text-accent">{error}</p>}
            <Button className="w-full" variant="accent" disabled={pending || otp.length !== 6}>
              {pending ? 'Verifying…' : 'Verify and continue'}
            </Button>
            <Button type="button" className="w-full" variant="outline" disabled={resending} onClick={() => void resendOtp()}>
              {resending ? 'Sending…' : 'Resend code'}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-ink-500 underline underline-offset-4 hover:text-ink-900"
              onClick={() => { setVerificationPending(false); setOtp(''); setError(''); }}
            >
              Use a different email address
            </button>
          </form>
        ) : (
          <>
            <form className="mt-8 space-y-4" onSubmit={(event) => void submit(event)}>
              {register && (
                <label className="block space-y-1.5 text-sm font-medium">
                  Name
                  <Input autoComplete="name" minLength={2} maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} />
                </label>
              )}
              <label className="block space-y-1.5 text-sm font-medium">
                Email
                <Input autoComplete="email" type="email" maxLength={255} required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <div className="space-y-1.5 text-sm font-medium">
                <label htmlFor="account-password">Password</label>
                <span className="account-password-field">
                  <Input
                    id="account-password"
                    autoComplete={register ? 'new-password' : 'current-password'}
                    type={passwordVisible ? 'text' : 'password'}
                    minLength={register ? 8 : undefined}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="account-password-toggle"
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </span>
              </div>
              {error && <p role="alert" className="text-sm text-accent">{error}</p>}
              {!register && <Link className="block text-right text-sm underline" to="/forgot-password">Forgot password?</Link>}
              <Button className="w-full" variant="accent" disabled={pending}>
                {pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-ink-500">
              {register ? 'Already have an account?' : 'New to Books Bin?'}{' '}
              <Link className="font-medium text-ink-900 underline underline-offset-4" to={register ? '/login' : '/register'}>
                {register ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function MissingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-ink-400">404 · Page not found</p>
      <h1 className="mt-3 font-serif text-4xl">This page is between covers.</h1>
      <p className="mt-3 text-ink-500">The page may have moved, or the address may be incorrect.</p>
      <Button asChild className="mt-8" variant="accent"><Link to="/">Return to the bookshop</Link></Button>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="books/:slug" element={<BookDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="wishlist" element={<WishlistPage />} />
        <Route path="categories/:slug" element={<CollectionPage type="categories" />} />
        <Route path="authors/:slug" element={<CollectionPage type="authors" />} />
        <Route path="about" element={<StoreInfoPage />} />
        <Route path="contact" element={<StoreInfoPage />} />
        <Route path="faq" element={<StoreInfoPage />} />
        <Route path="shipping-policy" element={<StoreInfoPage />} />
        <Route path="returns" element={<StoreInfoPage />} />
        <Route path="privacy" element={<StoreInfoPage />} />
        <Route path="terms" element={<StoreInfoPage />} />
        <Route path="login" element={<AccountPage key="login" />} />
        <Route path="register" element={<AccountPage key="register" register />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<MissingPage />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="books" element={<AdminBooksPage />} />
        <Route path="books/new" element={<AdminBookFormPage />} />
        <Route path="books/:id/edit" element={<AdminBookFormPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="customers" element={<AdminCustomersPage />} />
        <Route path="catalog" element={<AdminCatalogPage />} />
        <Route path="engagement" element={<AdminEngagementPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
