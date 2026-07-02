import { SEED_PRODUCTS } from '@/data/seed-products';
import { couponDiscount, findCoupon } from '@/lib/coupons';
import { generateOrderNumber, generateTrackingId } from '@/lib/format';
import { getShippingMethod } from '@/lib/shipping';
import type {
  Customer,
  DataSource,
  InventoryMovement,
  Order,
  OrderStatus,
  PlaceOrderInput,
  Product,
  Unsubscribe,
} from './types';

// מימוש דמו: "backend" מקומי בדפדפן שמדמה את Firestore, כולל עדכוני זמן-אמת.
// ההתמדה המקומית משמשת לנתוני דמו בלבד — לא לאימות ולא לאבטחה.

const STORAGE_KEY = 'squidget-demo-db-v1';

interface DemoDb {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  inventory: InventoryMovement[];
}

type Listener = () => void;

let db: DemoDb | null = null;
const listeners = new Set<Listener>();

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function seedDb(): DemoDb {
  const now = Date.now();
  const products: Product[] = SEED_PRODUCTS.map((p, i) => ({
    ...p,
    id: `demo-${i + 1}`,
    createdAt: now - i * 86_400_000,
  }));
  return { products, orders: [], customers: [], inventory: [] };
}

function loadDb(): DemoDb {
  if (db) return db;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        db = JSON.parse(raw) as DemoDb;
        return db;
      }
    } catch {
      // אחסון פגום — נאתחל מחדש
    }
  }
  db = seedDb();
  persist();
  return db;
}

function persist() {
  if (db && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // אין אחסון זמין — הדמו ימשיך בזיכרון בלבד
    }
  }
}

function notify() {
  persist();
  for (const listener of Array.from(listeners)) listener();
}

function subscribe(emit: () => void): Unsubscribe {
  listeners.add(emit);
  emit();
  return () => listeners.delete(emit);
}

export const demoDataSource: DataSource = {
  subscribeProducts(cb) {
    return subscribe(() => {
      const { products } = loadDb();
      cb([...products].sort((a, b) => b.createdAt - a.createdAt));
    });
  },

  async addProduct(data) {
    const database = loadDb();
    const id = makeId();
    database.products.push({ ...data, id, createdAt: Date.now() });
    notify();
    return id;
  },

  async updateProduct(id, data) {
    const database = loadDb();
    const product = database.products.find((p) => p.id === id);
    if (!product) throw new Error('המוצר לא נמצא');
    Object.assign(product, data);
    notify();
  },

  async deleteProduct(id) {
    const database = loadDb();
    database.products = database.products.filter((p) => p.id !== id);
    notify();
  },

  async seedProducts() {
    const database = loadDb();
    const existing = new Set(database.products.map((p) => p.englishName));
    const now = Date.now();
    let added = 0;
    for (const seed of SEED_PRODUCTS) {
      if (!existing.has(seed.englishName)) {
        database.products.push({ ...seed, id: makeId(), createdAt: now });
        added++;
      }
    }
    notify();
    return added;
  },

  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    const database = loadDb();

    // בדיקת מלאי והורדתו — מקבילה לטרנזקציית Firestore
    for (const item of input.items) {
      const product = database.products.find((p) => p.id === item.productId);
      if (!product) throw new Error(`המוצר "${item.name}" כבר לא זמין`);
      if (product.stock < item.quantity) {
        throw new Error(`אין מספיק מלאי עבור "${item.name}" — נשארו ${product.stock} יחידות`);
      }
    }

    const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const coupon = input.couponCode ? findCoupon(input.couponCode) : null;
    const discount = couponDiscount(coupon, subtotal);
    const shippingCost = getShippingMethod(input.shippingMethod).price;
    const total = Math.max(0, subtotal - discount + shippingCost);
    const now = Date.now();
    const orderNumber = generateOrderNumber();

    const order: Order = {
      id: makeId(),
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

    for (const item of input.items) {
      const product = database.products.find((p) => p.id === item.productId)!;
      product.stock -= item.quantity;
      database.inventory.unshift({
        id: makeId(),
        productId: product.id,
        productName: product.name,
        change: -item.quantity,
        reason: 'הזמנה חדשה',
        orderNumber,
        createdAt: now,
      });
    }

    database.orders.unshift(order);

    const email = input.customer.email.trim().toLowerCase();
    const customer = database.customers.find((c) => c.id === email);
    if (customer) {
      customer.fullName = input.customer.fullName;
      customer.phone = input.customer.phone;
      customer.ordersCount += 1;
      customer.totalSpent = Math.round((customer.totalSpent + total) * 100) / 100;
      customer.lastOrderAt = now;
    } else {
      database.customers.push({
        id: email,
        fullName: input.customer.fullName,
        email,
        phone: input.customer.phone,
        ordersCount: 1,
        totalSpent: total,
        lastOrderAt: now,
        createdAt: now,
      });
    }

    notify();
    return order;
  },

  subscribeOrders(cb) {
    return subscribe(() => {
      const { orders } = loadDb();
      cb([...orders].sort((a, b) => b.createdAt - a.createdAt));
    });
  },

  subscribeMyOrders(uid, cb) {
    return subscribe(() => {
      const { orders } = loadDb();
      cb(
        orders
          .filter((o) => o.uid === uid)
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    });
  },

  async getOrder(id) {
    const { orders } = loadDb();
    return orders.find((o) => o.id === id) ?? null;
  },

  async updateOrderStatus(id, status: OrderStatus) {
    const database = loadDb();
    const order = database.orders.find((o) => o.id === id);
    if (!order) throw new Error('ההזמנה לא נמצאה');
    order.status = status;
    notify();
  },

  async createShipment(id) {
    const database = loadDb();
    const order = database.orders.find((o) => o.id === id);
    if (!order) throw new Error('ההזמנה לא נמצאה');
    if (!order.trackingId) {
      order.trackingId = generateTrackingId();
      if (order.status === 'חדש') order.status = 'בהכנה';
      notify();
    }
    return order.trackingId;
  },

  subscribeCustomers(cb) {
    return subscribe(() => {
      const { customers } = loadDb();
      cb([...customers].sort((a, b) => b.lastOrderAt - a.lastOrderAt));
    });
  },

  subscribeInventory(cb) {
    return subscribe(() => {
      const { inventory } = loadDb();
      cb([...inventory].sort((a, b) => b.createdAt - a.createdAt));
    });
  },
};
