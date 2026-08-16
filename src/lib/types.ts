export interface Category {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    products: number;
  };
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  available: boolean;
  categoryId: string;
  category?: Category;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export type OrderType = "DELIVERY" | "PICKUP";

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  orderType: OrderType;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes: string | null;
  items: OrderItem[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface OpeningHour {
  id: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ...
  dayName: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  settingsId: string;
}

export interface RestaurantSettings {
  id: string;
  name: string;
  phone: string;
  address: string;
  currency: string;
  deliveryFee: number;
  isOpenOverride: boolean | null;
  isAutoHours: boolean;
  openingHours: OpeningHour[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface DashboardStats {
  ordersToday: number;
  revenueToday: number;
  pendingOrders: number;
  preparingOrders: number;
  completedOrders: number;
  totalProducts: number;
  recentOrders: Order[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
