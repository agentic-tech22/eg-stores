"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface CartItem {
  productId: string;
  productVariantId: string | null;
  title: string;
  variantLabel: string | null;
  unitPrice: number;
  imageUrl: string | null;
  quantity: number;
  /** Available stock captured when the item was added. Used as a soft client-side
   * cap so the cart can't be pushed past stock; the server re-validates and
   * reserves authoritatively at checkout. May be stale; `undefined` for legacy
   * carts persisted before this field existed (then no cap is applied). */
  available?: number;
}

/** Clamp a requested quantity to [1, available] when an available cap is known. */
function clampQuantity(quantity: number, available?: number): number {
  if (available === undefined) return Math.max(0, quantity);
  return Math.min(Math.max(0, quantity), Math.max(0, available));
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "dm-cart";

/** Stable identity for a cart line (product + optional variant). */
export function cartItemKey(productId: string, variantId: string | null): string {
  return `${productId}:${variantId ?? ""}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted cart on mount. We read in an effect (not a lazy initializer)
  // so the server-rendered markup matches the first client render and only then
  // hydrates from localStorage, avoiding a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage post-mount
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      // Ignore malformed storage.
    }
    setHydrated(true);
  }, []);

  // Persist after hydration so we don't clobber storage with the empty initial state.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota/availability errors.
    }
  }, [items, hydrated]);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      setItems((prev) => {
        const key = cartItemKey(item.productId, item.productVariantId);
        const existing = prev.find(
          (i) => cartItemKey(i.productId, i.productVariantId) === key,
        );
        if (existing) {
          return prev.map((i) =>
            cartItemKey(i.productId, i.productVariantId) === key
              ? {
                  ...i,
                  // Refresh the cap from the latest add, then clamp the total.
                  available: item.available ?? i.available,
                  quantity: clampQuantity(
                    i.quantity + quantity,
                    item.available ?? i.available,
                  ),
                }
              : i,
          );
        }
        return [
          ...prev,
          { ...item, quantity: clampQuantity(quantity, item.available) },
        ];
      });
    },
    [],
  );

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          cartItemKey(i.productId, i.productVariantId) === key
            ? { ...i, quantity: clampQuantity(quantity, i.available) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) =>
      prev.filter((i) => cartItemKey(i.productId, i.productVariantId) !== key),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    return { items, count, subtotal, addItem, updateQuantity, removeItem, clear };
  }, [items, addItem, updateQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider.");
  return ctx;
}
