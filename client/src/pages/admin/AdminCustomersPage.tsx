import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Customer {
  _id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  createdAt: string;
  isActive: boolean;
}

export function AdminCustomersPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async () => (await api.get<Customer[]>('/admin/customers')).data,
  });
  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Customer['role'] }) =>
      api.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-customers'] }),
  });

  if (query.isLoading) return <p className="text-ink-500">Loading customers…</p>;
  if (query.isError) return <p role="alert" className="text-red-700">{query.error.message}</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Community</p>
        <h1 className="mt-1 font-serif text-3xl">Customers and roles</h1>
        <p className="mt-2 text-sm text-ink-500">Role changes are audited and cannot remove the final administrator.</p>
      </div>
      {roleMutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{roleMutation.error.message}</p>}
      <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-50 text-ink-600">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Role</th></tr>
          </thead>
          <tbody>
            {query.data?.map((customer) => (
              <tr key={customer._id} className="border-t border-ink-100">
                <td className="px-4 py-3 font-medium">{customer.name}</td>
                <td className="px-4 py-3">{customer.email}</td>
                <td className="px-4 py-3">{new Date(customer.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Role for ${customer.email}`}
                    className="h-9 rounded-md border border-ink-200 bg-white px-2 text-sm"
                    value={customer.role}
                    disabled={roleMutation.isPending}
                    onChange={(event) => {
                      const role = event.target.value;
                      if (role === 'admin' || role === 'customer') {
                        roleMutation.mutate({ id: customer._id, role });
                      }
                    }}
                  >
                    <option value="customer">Customer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </td>
              </tr>
            ))}
            {!query.data?.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-ink-500">No accounts found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
