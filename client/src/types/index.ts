export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
}

export interface Book {
  id: string;
  title: string;
  slug: string;
  isbn: string;
  description: string;
  category: { _id: string; name: string; slug: string } | string;
  author: { _id: string; name: string; slug: string } | string;
  publisher?: string;
  publishedAt?: string;
  price: number;
  discountPercent: number;
  effectivePrice: number;
  stock: number;
  inStock: boolean;
  coverImages: string[];
  coverAssets?: CloudinaryAsset[];
  featured: boolean;
  isActive: boolean;
  isArchived?: boolean;
}

export interface CloudinaryAsset {
  publicId: string;
  secureUrl: string;
  resourceType: 'image' | 'video' | 'raw';
  format?: string;
  width?: number;
  height?: number;
}

export interface CartItem {
  bookId: string;
  title: string;
  slug: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  stock: number;
  coverImage?: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  freeShippingThreshold: number;
}
