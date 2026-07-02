import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { SEED_PRODUCTS } from '@/data/seed-products';
import { couponDiscount, findCoupon } from '@/lib/coupons';
import { getDb } from '@/lib/firebase';
import { generateOrderNumber, generateTrackingId } from '@/lib/format';
import { getShippingMethod } from '@/lib/shipping';
import type {
  Customer,
  DataSource,
  InventoryMovement,
  Order,
  PlaceOrderInput,
  Product,
} from './types';

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function snapToProduct(snap: QueryDocumentSnapshot<DocumentData>): Product {
  const data = snap.data();
  return { ...(data as Omit<Product, 'id' | 'createdAt'>), id: snap.id, createdAt: toMillis(data.createdAt) };
}

function snapToOrder(snap: QueryDocumentSnapshot<DocumentData>): Order {
  const data = snap.data();
  return { ...(data as Omit<Order, 'id' | 'createdAt'>), id: snap.id, createdAt: toMillis(data.createdAt) };
}

export const firestoreDataSource: DataSource = {
  subscribeProducts(cb) {
    const q = query(collection(getDb(), 'products'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => cb(snapshot.docs.map(snapToProduct)));
  },

  async addProduct(data) {
    const ref = await addDoc(collection(getDb(), 'products'), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async updateProduct(id, data) {
    await updateDoc(doc(getDb(), 'products', id), data);
  },

  async deleteProduct(id) {
    await deleteDoc(doc(getDb(), 'products', id));
  },

  async seedProducts() {
    const existing = await getDocs(collection(getDb(), 'products'));
    const names = new Set(existing.docs.map((d) => d.data().englishName));
    let added = 0;
    for (const seed of SEED_PRODUCTS) {
      if (!names.has(seed.englishName)) {
        await addDoc(collection(getDb(), 'products'), { ...seed, createdAt: serverTimestamp() });
        added++;
      }
    }
    return added;
  },

  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    const db = getDb();
    const orderRef = doc(collection(db, 'orders'));
    const now = Date.now();
    const orderNumber = generateOrderNumber();

    // טרנזקציה אחת: בדיקת מלאי → הורדת מלאי → יצירת הזמנה → תנועות מלאי → עדכון לקוח
    const order = await runTransaction(db, async (tx) => {
      const productRefs = input.items.map((item) => doc(db, 'products', item.productId));
      const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

      const email = input.customer.email.trim().toLowerCase();
      const customerRef = doc(db, 'customers', email);
      const customerSnap = await tx.get(customerRef);

      productSnaps.forEach((snap, i) => {
        const item = input.items[i];
        if (!snap.exists()) throw new Error(`המוצר "${item.name}" כבר לא זמין`);
        const stock = snap.data().stock as number;
        if (stock < item.quantity) {
          throw new Error(`אין מספיק מלאי עבור "${item.name}" — נשארו ${stock} יחידות`);
        }
      });

      const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const coupon = input.couponCode ? findCoupon(input.couponCode) : null;
      const discount = couponDiscount(coupon, subtotal);
      const shippingCost = getShippingMethod(input.shippingMethod).price;
      const total = Math.max(0, subtotal - discount + shippingCost);

      const orderData: Omit<Order, 'id'> = {
        orderNumber,
        customer: input.customer,
        items: input.items.map(({ productId, name, emoji, price, quantity }) => ({
          productId,
          name,
          emoji,
          price,
          quantity,
        })),
        subtotal,
        discount,
        couponCode: coupon?.code ?? null,
        shippingMethod: input.shippingMethod,
        shippingCost,
        total,
        paymentMethod: input.paymentMethod,
        status: 'חדש',
        trackingId: null,
        uid: input.uid,
        createdAt: now,
      };

      productSnaps.forEach((snap, i) => {
        const item = input.items[i];
        tx.update(productRefs[i], { stock: (snap.data()!.stock as number) - item.quantity });
        tx.set(doc(collection(db, 'inventory')), {
          productId: item.productId,
          productName: item.name,
          change: -item.quantity,
          reason: 'הזמנה חדשה',
          orderNumber,
          createdAt: now,
        });
      });

      tx.set(orderRef, orderData);

      if (customerSnap.exists()) {
        const existing = customerSnap.data() as Customer;
        tx.update(customerRef, {
          fullName: input.customer.fullName,
          phone: input.customer.phone,
          ordersCount: existing.ordersCount + 1,
          totalSpent: Math.round((existing.totalSpent + total) * 100) / 100,
          lastOrderAt: now,
        });
      } else {
        tx.set(customerRef, {
          fullName: input.customer.fullName,
          email,
          phone: input.customer.phone,
          ordersCount: 1,
          totalSpent: total,
          lastOrderAt: now,
          createdAt: now,
        });
      }

      return { ...orderData, id: orderRef.id };
    });

    return order;
  },

  subscribeOrders(cb) {
    const q = query(collection(getDb(), 'orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => cb(snapshot.docs.map(snapToOrder)));
  },

  subscribeMyOrders(uid, cb) {
    const q = query(
      collection(getDb(), 'orders'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, (snapshot) => cb(snapshot.docs.map(snapToOrder)));
  },

  async getOrder(id) {
    const snap = await getDoc(doc(getDb(), 'orders', id));
    if (!snap.exists()) return null;
    return snapToOrder(snap as QueryDocumentSnapshot<DocumentData>);
  },

  async updateOrderStatus(id, status) {
    await updateDoc(doc(getDb(), 'orders', id), { status });
  },

  async createShipment(id) {
    const db = getDb();
    const orderRef = doc(db, 'orders', id);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) throw new Error('ההזמנה לא נמצאה');
    const existing = snap.data().trackingId as string | null;
    if (existing) return existing;
    const trackingId = generateTrackingId();
    const update: Record<string, unknown> = { trackingId };
    if (snap.data().status === 'חדש') update.status = 'בהכנה';
    await updateDoc(orderRef, update);
    return trackingId;
  },

  subscribeCustomers(cb) {
    const q = query(collection(getDb(), 'customers'), orderBy('lastOrderAt', 'desc'));
    return onSnapshot(q, (snapshot) =>
      cb(
        snapshot.docs.map((snap) => {
          const data = snap.data();
          return {
            ...(data as Omit<Customer, 'id' | 'createdAt' | 'lastOrderAt'>),
            id: snap.id,
            createdAt: toMillis(data.createdAt),
            lastOrderAt: toMillis(data.lastOrderAt),
          };
        }),
      ),
    );
  },

  subscribeInventory(cb) {
    const q = query(collection(getDb(), 'inventory'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) =>
      cb(
        snapshot.docs.map((snap) => {
          const data = snap.data();
          return {
            ...(data as Omit<InventoryMovement, 'id' | 'createdAt'>),
            id: snap.id,
            createdAt: toMillis(data.createdAt),
          };
        }),
      ),
    );
  },
};
