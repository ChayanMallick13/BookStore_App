import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface AdminOrder {
  _id: string;
  orderNumber: string;
  user: { name: string; email: string } | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  createdAt: string;
}

const transitions: Record<string, string[]> = {
  pending_payment: ['cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => (await api.get<AdminOrder[]>('/admin/orders?page=1&limit=50')).data,
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/orders/${id}/status`, { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]);
    },
  });

  if (query.isLoading) return <p className="text-ink-500">Loading orders…</p>;
  if (query.isError) return <p role="alert" className="text-red-700">{query.error.message}</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-ink-400">Fulfillment</p>
        <h1 className="mt-1 font-serif text-3xl">Orders</h1>
      </div>
      {update.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{update.error.message}</p>}
      <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-50 text-ink-600">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.map((order) => (
              <tr key={order._id} className="border-t border-ink-100">
                <td className="px-4 py-3">
                  <p className="font-medium">{order.orderNumber}</p>
                  <p className="text-xs text-ink-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                </td>
                <td className="px-4 py-3">
                  <p>{order.user?.name ?? 'Customer'}</p>
                  <p className="text-xs text-ink-500">{order.user?.email}</p>
                </td>
                <td className="px-4 py-3">{formatCurrency(order.total)}</td>
                <td className="px-4 py-3 capitalize">{order.paymentMethod} · {order.paymentStatus}</td>
                <td className="px-4 py-3 capitalize">{order.status.replaceAll('_', ' ')}</td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Update ${order.orderNumber} status`}
                    className="h-9 rounded-md border border-ink-200 bg-white px-2 text-sm"
                    value={order.status}
                    disabled={update.isPending || !transitions[order.status]?.length}
                    onChange={(event) => update.mutate({ id: order._id, status: event.target.value })}
                  >
                    <option value={order.status}>{order.status.replaceAll('_', ' ')}</option>
                    {transitions[order.status]?.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!query.data?.length && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-500">No orders have been placed yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
