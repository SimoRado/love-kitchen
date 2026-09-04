import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Product, CartItem, OrderType, SelectedModifierOptionSnapshot } from "@/lib/types";
import { roundMoney, calculateItemTotal, getEffectiveProductPrice } from "@/lib/money";

interface CustomerInfo {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  allergies?: string;
  notes: string;
}

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  customerInfo: CustomerInfo;
  hasHydrated: boolean;
  
  // Actions
  addItem: (
    product: Product,
    quantity?: number,
    selectedModifiers?: SelectedModifierOptionSnapshot[]
  ) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateItemConfiguration: (
    itemId: string,
    newSelectedModifiers: SelectedModifierOptionSnapshot[],
    newQuantity?: number
  ) => void;
  setOrderType: (orderType: OrderType) => void;
  setCustomerInfo: (info: Partial<CustomerInfo>) => void;
  clearCart: () => void;
  setHasHydrated: (value: boolean) => void;
  reconcileWithLatestProducts: (latestProducts: Product[]) => {
    priceChanged: boolean;
    unavailableItems: string[];
  };

  // Computations
  getItemCount: () => number;
  getSubtotal: () => number;
  hasUnavailableItems: () => boolean;
}

export function generateCartItemId(
  productId: string,
  selectedModifiers: SelectedModifierOptionSnapshot[] = []
): string {
  const sortedOptionIds = selectedModifiers
    .map((m) => m.optionId)
    .sort()
    .join("_");
  return sortedOptionIds ? `${productId}_${sortedOptionIds}` : productId;
}

export function calculateConfiguredPrice(
  basePrice: number,
  selectedModifiers: SelectedModifierOptionSnapshot[] = []
): number {
  const modifierDeltaSum = selectedModifiers.reduce(
    (acc, m) => acc + (Number(m.priceDelta) || 0),
    0
  );
  return roundMoney(basePrice + modifierDeltaSum);
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
        allergies: "",
        notes: "",
      },
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      addItem: (product: Product, quantity = 1, selectedModifiers = []) => {
        if (!product.available) return;

        const sortedModifiers = [...selectedModifiers].sort((a, b) =>
          a.optionId.localeCompare(b.optionId)
        );
        const itemId = generateCartItemId(product.id, sortedModifiers);
        const effectiveBase = getEffectiveProductPrice(product.price, product.discountPercent);
        const configuredUnitPrice = calculateConfiguredPrice(effectiveBase, sortedModifiers);
        const validQuantity = Math.max(1, Math.floor(Number(quantity)) || 1);

        const currentItems = get().items;
        const existingIndex = currentItems.findIndex((item) => item.id === itemId);

        if (existingIndex > -1) {
          const updatedItems = [...currentItems];
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            product, // Keep latest product data
            selectedModifiers: sortedModifiers,
            configuredUnitPrice,
            quantity: updatedItems[existingIndex].quantity + validQuantity,
          };
          set({ items: updatedItems });
        } else {
          set({
            items: [
              ...currentItems,
              {
                id: itemId,
                product,
                quantity: validQuantity,
                selectedModifiers: sortedModifiers,
                configuredUnitPrice,
              },
            ],
          });
        }
      },

      removeItem: (itemId: string) => {
        set({
          items: get().items.filter((item) => item.id !== itemId),
        });
      },

      updateQuantity: (itemId: string, quantity: number) => {
        const safeQty = Math.floor(Number(quantity)) || 0;
        if (safeQty <= 0) {
          get().removeItem(itemId);
          return;
        }

        const updatedItems = get().items.map((item) =>
          item.id === itemId
            ? { ...item, quantity: safeQty }
            : item
        );
        set({ items: updatedItems });
      },

      updateItemConfiguration: (
        itemId: string,
        newSelectedModifiers: SelectedModifierOptionSnapshot[],
        newQuantity?: number
      ) => {
        const currentItems = get().items;
        const itemToUpdate = currentItems.find((it) => it.id === itemId);
        if (!itemToUpdate) return;

        const sortedModifiers = [...newSelectedModifiers].sort((a, b) =>
          a.optionId.localeCompare(b.optionId)
        );
        const newId = generateCartItemId(itemToUpdate.product.id, sortedModifiers);
        const effectiveBase = getEffectiveProductPrice(itemToUpdate.product.price, itemToUpdate.product.discountPercent);
        const newUnitPrice = calculateConfiguredPrice(effectiveBase, sortedModifiers);
        const targetQuantity =
          newQuantity !== undefined
            ? Math.max(1, Math.floor(Number(newQuantity)) || 1)
            : Math.max(1, Math.floor(Number(itemToUpdate.quantity)) || 1);

        // If new configuration is identical to another existing line
        const existingTargetIndex = currentItems.findIndex(
          (it) => it.id === newId && it.id !== itemId
        );

        if (existingTargetIndex > -1) {
          // Merge into target line and remove old line
          const merged = currentItems
            .filter((it) => it.id !== itemId)
            .map((it) =>
              it.id === newId
                ? {
                    ...it,
                    quantity: it.quantity + targetQuantity,
                    configuredUnitPrice: newUnitPrice,
                    selectedModifiers: sortedModifiers,
                  }
                : it
            );
          set({ items: merged });
        } else {
          const updated = currentItems.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  id: newId,
                  quantity: targetQuantity,
                  selectedModifiers: sortedModifiers,
                  configuredUnitPrice: newUnitPrice,
                }
              : it
          );
          set({ items: updated });
        }
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
          .map<CartItem | null>((item) => {
            const dbProduct = productMap.get(item.product.id);
            if (!dbProduct) return null; // Removed from menu

            if (!dbProduct.available) {
              unavailableItems.push(dbProduct.name);
            }

            // Verify active modifiers
            const activeOptionsMap = new Map<string, SelectedModifierOptionSnapshot>();
            if (dbProduct.modifierGroups) {
              for (const g of dbProduct.modifierGroups) {
                if (g.active) {
                  for (const opt of g.options) {
                    if (opt.active) {
                      activeOptionsMap.set(opt.id, {
                        groupId: g.id,
                        groupName: g.name,
                        optionId: opt.id,
                        optionName: opt.name,
                        priceDelta: opt.priceDelta,
                      });
                    }
                  }
                }
              }
            }

            // Check if any selected modifier was deleted or deactivated
            let hasInvalidModifier = false;
            const refreshedModifiers = (item.selectedModifiers || []).map((selection) => {
              const latest = activeOptionsMap.get(selection.optionId);
              if (!latest) {
                hasInvalidModifier = true;
                unavailableItems.push(`${dbProduct.name} (${selection.optionName})`);
                return selection;
              }
              if (
                latest.priceDelta !== selection.priceDelta ||
                latest.optionName !== selection.optionName ||
                latest.groupName !== selection.groupName
              ) {
                priceChanged = true;
              }
              return latest;
            });

            for (const group of dbProduct.modifierGroups || []) {
              if (!group.active) continue;
              const count = refreshedModifiers.filter((selection) => selection.groupId === group.id).length;
              const minimum = group.required ? Math.max(1, group.minSelections || 0) : (group.minSelections || 0);
              if (count < minimum || count > group.maxSelections) {
                hasInvalidModifier = true;
                unavailableItems.push(`${dbProduct.name} (${group.name})`);
              }
            }

            const effectiveBase = getEffectiveProductPrice(dbProduct.price, dbProduct.discountPercent);
            const latestConfiguredPrice = calculateConfiguredPrice(
              effectiveBase,
              refreshedModifiers
            );

            if (latestConfiguredPrice !== item.configuredUnitPrice) {
              priceChanged = true;
            }

            return {
              ...item,
              product: dbProduct,
              selectedModifiers: refreshedModifiers,
              configuredUnitPrice: latestConfiguredPrice,
              configurationInvalid: hasInvalidModifier,
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
            total + calculateItemTotal(item.configuredUnitPrice, item.quantity)
          );
        }, 0);
      },

      hasUnavailableItems: () => {
        return get().items.some((item) => !item.product.available || item.configurationInvalid);
      },
    }),
    {
      name: "love-kitchen-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        orderType: state.orderType,
        customerInfo: state.customerInfo,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
