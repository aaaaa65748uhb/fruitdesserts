'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { couponDiscount, findCoupon, type Coupon } from '@/lib/coupons';
import type { CartItem, Product, ShippingMethodId } from '@/lib/data/types';
import { getShippingMethod } from '@/lib/shipping';

interface CartContextValue {
  items: CartItem[];
  coupon: Coupon | null;
  couponError: string | null;
  shippingMethod: ShippingMethodId;
  itemsCount: number;
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  addItem: (product: Product, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  setShippingMethod: (method: ShippingMethodId) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// התמדת תוכן העגלה בלבד (נוחות קנייה) — לא משמש לאימות או אבטחה
const CART_KEY = 'squidget-cart-v1';

interface StoredCart {
  items: CartItem[];
  couponCode: string | null;
  shippingMethod: ShippingMethodId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [shippingMethod, setShippingMethodState] = useState<ShippingMethodId>('standard');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoredCart;
        setItems(stored.items ?? []);
        setCoupon(stored.couponCode ? findCoupon(stored.couponCode) : null);
        if (stored.shippingMethod) setShippingMethodState(stored.shippingMethod);
      }
    } catch {
      // אחסון פגום — מתחילים עם עגלה ריקה
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const stored: StoredCart = { items, couponCode: coupon?.code ?? null, shippingMethod };
      window.localStorage.setItem(CART_KEY, JSON.stringify(stored));
    } catch {
      // אין אחסון זמין
    }
  }, [items, coupon, shippingMethod, hydrated]);

  const addItem = useCallback((product: Product, quantity: number) => {
    setItems((prev) => {
      const price = product.salePrice ?? product.price;
      const existing = prev.find((item) => item.productId === product.id);
      const maxQty = product.stock;
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, price, quantity: Math.min(item.quantity + quantity, maxQty) }
            : item,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          emoji: product.emoji,
          colors: product.colors,
          price,
          quantity: Math.min(quantity, maxQty),
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((item) => item.productId !== productId)
        : prev.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCoupon(null);
    setCouponError(null);
  }, []);

  const applyCoupon = useCallback((code: string) => {
    const found = findCoupon(code);
    if (found) {
      setCoupon(found);
      setCouponError(null);
      return true;
    }
    setCouponError('קוד הקופון אינו תקף');
    return false;
  }, []);

  const removeCoupon = useCallback(() => {
    setCoupon(null);
    setCouponError(null);
  }, []);

  const setShippingMethod = useCallback((method: ShippingMethodId) => {
    setShippingMethodState(method);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = couponDiscount(coupon, subtotal);
    const shippingCost = items.length > 0 ? getShippingMethod(shippingMethod).price : 0;
    const total = Math.max(0, subtotal - discount + shippingCost);
    return {
      items,
      coupon,
      couponError,
      shippingMethod,
      itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      discount,
      shippingCost,
      total,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
      setShippingMethod,
    };
  }, [
    items,
    coupon,
    couponError,
    shippingMethod,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    setShippingMethod,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart חייב לרוץ בתוך CartProvider');
  return ctx;
}
