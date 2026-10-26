import { Link, NavLink, Outlet, Navigate } from 'react-router-dom';
import { BarChart3, BookCopy, LayoutDashboard, Package, Tags, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition',
    isActive ? 'bg-ink-900 text-parchment' : 'text-ink-600 hover:bg-ink-100',
  );

export function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading admin…</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-ink-50 md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-r border-ink-100 bg-white p-4">
        <Link to="/" className="font-serif text-xl">
          BookHaven Admin
        </Link>
        <nav className="mt-8 space-y-1">
          <NavLink to="/admin" end className={linkClass}>
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </NavLink>
          <NavLink to="/admin/books" className={linkClass}>
            <BookCopy className="h-4 w-4" /> Books
          </NavLink>
          <NavLink to="/admin/orders" className={linkClass}>
            <Package className="h-4 w-4" /> Orders
          </NavLink>
          <NavLink to="/admin/customers" className={linkClass}>
            <Users className="h-4 w-4" /> Customers
          </NavLink>
          <NavLink to="/admin/catalog" className={linkClass}>
            <BookCopy className="h-4 w-4" /> Categories & authors
          </NavLink>
          <NavLink to="/admin/engagement" className={linkClass}>
            <Tags className="h-4 w-4" /> Reviews & coupons
          </NavLink>
          <NavLink to="/admin/reports" className={linkClass}>
            <BarChart3 className="h-4 w-4" /> Reports
          </NavLink>
        </nav>
      </aside>
      <div className="min-w-0 p-6 md:p-8">
        <div className="mb-5 flex justify-end">
          <ThemeToggle />
        </div>
        <Outlet />
      </div>
    </div>
  );
}
