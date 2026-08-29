export interface Category {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
  products?: Product[];
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    products: number;
  };
}

export interface ProductModifierOption {
  id: string;
  modifierGroupId: string;
  name: string;
  priceDelta: number;
  active: boolean;
  displayOrder: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ProductModifierGroup {
  id: string;
  productId: string;
  name: string;
  description?: string | null;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  displayOrder: number;
  active: boolean;
  options: ProductModifierOption[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  available: boolean;
  prepTimeMinutes?: number;
  prepStation?: string | null;
  categoryId: string;
  category?: Category;
  modifierGroups?: ProductModifierGroup[];
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

export interface OrderItemModifier {
  id: string;
  orderItemId: string;
  modifierGroupName: string;
  modifierOptionName: string;
  priceDelta: number;
  createdAt?: string | Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  price: number;
  configuredUnitPrice?: number | null;
  quantity: number;
  modifiers?: OrderItemModifier[];
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
  allergies?: string | null;
  notes: string | null;
  estimatedPrepMinutes?: number | null;
  estimatedReadyAt?: string | Date | null;
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
  subtitle?: string | null;
  phone: string;
  address: string;
  googleMapsUrl?: string | null;
  whatsappNumber?: string | null;
  currency: string;
  deliveryFee: number;
  isOpenOverride: boolean | null;
  isAutoHours: boolean;
  congestionBufferMinutes?: number;
  maxCongestionBufferMinutes?: number;
  openingHours: OpeningHour[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface SelectedModifierOptionSnapshot {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItem {
  id: string; // unique configuration key: `${product.id}_${sortedOptionIds.join('_')}`
  product: Product;
  quantity: number;
  selectedModifiers: SelectedModifierOptionSnapshot[];
  configuredUnitPrice: number;
  configurationInvalid?: boolean;
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

export type DeviceType = "POS" | "KITCHEN" | "ADMIN";
export type DeviceStatus = "ACTIVE" | "INACTIVE" | "DISABLED" | "REVOKED";

export interface Device {
  id: string;
  publicId: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  restaurantId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastSeenAt?: string | Date | null;
  revokedAt?: string | Date | null;
}

export interface DeviceRegistrationCode {
  id?: string;
  code: string;
  expiresAt: string | Date;
  usedAt?: string | Date | null;
  replaceDeviceId?: string | null;
  deviceName: string;
  deviceType: DeviceType;
}