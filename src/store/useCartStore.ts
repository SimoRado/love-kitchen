import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Product, CartItem, OrderType } from "@/lib/types";
import { roundMoney, calculateItemTotal } from "@/lib/money";

interface CustomerInfo {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
}

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  customerInfo: CustomerInfo;
  
  // Actions
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setOrderType: (orderType: OrderType) => void;
  setCustomerInfo: (info: Partial<CustomerInfo>) => void;
  clearCart: () => void;
  reconcileWithLatestProducts: (latestProducts: Product[]) => {
    priceChanged: boolean;
    unavailableItems: string[];
  };

  // Computations
  getItemCount: () => number;
  getSubtotal: () => number;
  hasUnavailableItems: () => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      orderType: "DELIVERY",
      customerInfo: {
        customerName: "",
        customerPhone: "",
        customerAddress: "",
        notes: "",
      },

      addItem: (product: Product, quantity = 1) => {
        if (!product.available) return;

        const currentItems = get().items;
        const existingIndex = currentItems.findIndex(
          (item) => item.product.id === product.id
        );

        if (existingIndex > -1) {
          const updatedItems = [...currentItems];
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            product, // Keep latest product data
            quantity: updatedItems[existingIndex].quantity + Math.max(1, quantity),
          };
          set({ items: updatedItems });
        } else {
          set({
            items: [
              ...currentItems,
              { product, quantity: Math.max(1, quantity) },
            ],
          });
        }
      },

      removeItem: (productId: string) => {
        set({
          items: get().items.filter((item) => item.product.id !== productId),
        });
      },

      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        const updatedItems = get().items.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.floor(quantity) }
            : item
        );
        set({ items: updatedItems });
      },

      setOrderType: (orderType: OrderType) => {
        set({ orderType });
      },

      setCustomerInfo: (info: Partial<CustomerInfo>) => {
        set({
          customerInfo: {
            ...get().customerInfo,
            ...info,
          },
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      reconcileWithLatestProducts: (latestProducts: Product[]) => {
        const productMap = new Map(latestProducts.map((p) => [p.id, p]));
        const currentItems = get().items;
        let priceChanged = false;
        const unavailableItems: string[] = [];

        const updatedItems = currentItems
          .map((item) => {
            const dbProduct = productMap.get(item.product.id);
            if (!dbProduct) return null; // Removed from menu

            if (!dbProduct.available) {
              unavailableItems.push(dbProduct.name);
            }

            if (dbProduct.price !== item.product.price) {
              priceChanged = true;
            }

            return {
              ...item,
              product: dbProduct,
            };
          })
          .filter((item): item is CartItem => item !== null);

        set({ items: updatedItems });

        return {
          priceChanged,
          unavailableItems,
        };
      },

      getItemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((total, item) => {
          return roundMoney(
            total + calculateItemTotal(item.product.price, item.quantity)
          );
        }, 0);
      },

      hasUnavailableItems: () => {
        return get().items.some((item) => !item.product.available);
      },
    }),
    {
      name: "love-kitchen-cart",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
