import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { Book } from '../models/Book.js';
import { AuditLog } from '../models/AuditLog.js';

export async function getDashboardMetrics(from?: Date, to?: Date) {
  const dateFilter =
    from || to
      ? {
          createdAt: {
            ...(from ? { $gte: from } : {}),
            ...(to ? { $lte: to } : {}),
          },
        }
      : {};

  const paidFilter = { paymentStatus: 'paid', ...dateFilter };

  const [revenueAgg, orderCount, customerCount, bookCount, lowStock, recentOrders] =
    await Promise.all([
      Order.aggregate([
        { $match: paidFilter },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.countDocuments(dateFilter),
      User.countDocuments({ role: 'customer' }),
      Book.countDocuments({ isActive: true, isArchived: false }),
      Book.find({ stock: { $lte: 5, $gt: 0 }, isArchived: false })
        .sort({ stock: 1 })
        .limit(10)
        .select('title slug stock'),
      Order.find(dateFilter).sort({ createdAt: -1 }).limit(10).populate('user', 'name email'),
    ]);

  const salesTrend = await Order.aggregate([
    { $match: paidFilter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 30 },
  ]);

  return {
    totalRevenue: revenueAgg[0]?.total ?? 0,
    totalOrders: orderCount,
    totalCustomers: customerCount,
    activeBooks: bookCount,
    lowStock,
    recentOrders,
    salesTrend,
  };
}

export async function exportSalesCsv(from?: Date, to?: Date) {
  const filter =
    from || to
      ? {
          paymentStatus: 'paid',
          createdAt: {
            ...(from ? { $gte: from } : {}),
            ...(to ? { $lte: to } : {}),
          },
        }
      : { paymentStatus: 'paid' };
  const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
  const header = 'orderNumber,date,total,status,paymentMethod\n';
  const rows = orders
    .map(
      (o) =>
        `${o.orderNumber},${o.createdAt.toISOString()},${o.total},${o.status},${o.paymentMethod}`,
    )
    .join('\n');
  return header + rows;
}

export async function listAuditLogs(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name email'),
    AuditLog.countDocuments(),
  ]);
  return { items, total, page, limit };
}
