'use client';

import { useEffect, useState } from 'react';
import { getDataSource } from '@/lib/data';
import type { Customer, InventoryMovement, Order, Product } from '@/lib/data/types';

// hooks לנתונים בזמן אמת — מבוססי onSnapshot (או מאזיני הדמו)

export function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => getDataSource().subscribeProducts(setProducts), []);
  return { products: products ?? [], loading: products === null };
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => getDataSource().subscribeOrders(setOrders), []);
  return { orders: orders ?? [], loading: orders === null };
}

export function useMyOrders(uid: string | null) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => {
    if (!uid) {
      setOrders([]);
      return;
    }
    setOrders(null);
    return getDataSource().subscribeMyOrders(uid, setOrders);
  }, [uid]);
  return { orders: orders ?? [], loading: orders === null };
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  useEffect(() => getDataSource().subscribeCustomers(setCustomers), []);
  return { customers: customers ?? [], loading: customers === null };
}

export function useInventory() {
  const [movements, setMovements] = useState<InventoryMovement[] | null>(null);
  useEffect(() => getDataSource().subscribeInventory(setMovements), []);
  return { movements: movements ?? [], loading: movements === null };
}
