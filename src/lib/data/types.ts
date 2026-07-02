// טיפוסי הליבה של מערכת Squidget

export const PRODUCT_CATEGORIES = ['אוכל חמוד', 'חיות', 'קינוחים', 'פנטזיה'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_TAGS = ['חדש', 'ויראלי', 'ASMR', 'נמכר ביותר'] as const;
export type ProductTag = (typeof PRODUCT_TAGS)[number];

export interface Product {
  id: string;
  name: string;
  englishName: string; // שם דגם בינלאומי (Dumpling, Butter וכו')
  description: string;
  category: ProductCategory;
  price: number;
  salePrice: number | null;
  stock: number;
  emoji: string;
  colors: [string, string]; // גרדיאנט לכרטיס המוצר
  tags: ProductTag[];
  active: boolean;
  createdAt: number;
}

export interface CartItem {
  productId: string;
  name: string;
  emoji: string;
  colors: [string, string];
  price: number; // המחיר בפועל (כולל מבצע)
  quantity: number;
}

export const SHIPMENT_STATUSES = ['חדש', 'בהכנה', 'נארז', 'מוכן', 'נשלח', 'הושלם'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const ORDER_STATUSES = [...SHIPMENT_STATUSES, 'בוטל'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type ShippingMethodId = 'pickup' | 'standard' | 'express';

export type PaymentMethodId = 'card' | 'applepay' | 'googlepay' | 'paypal';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  card: 'כרטיס אשראי',
  applepay: 'Apple Pay',
  googlepay: 'Google Pay',
  paypal: 'PayPal',
};

export interface CustomerDetails {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  notes: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  emoji: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string; // SQ-XXXXXX
  customer: CustomerDetails;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingMethod: ShippingMethodId;
  shippingCost: number;
  total: number;
  paymentMethod: PaymentMethodId;
  status: OrderStatus;
  trackingId: string | null;
  uid: string | null;
  createdAt: number;
}

export interface Customer {
  id: string; // אימייל
  fullName: string;
  email: string;
  phone: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: number;
  createdAt: number;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  change: number; // שלילי = הורדת מלאי
  reason: string;
  orderNumber: string | null;
  createdAt: number;
}

export interface PlaceOrderInput {
  customer: CustomerDetails;
  items: CartItem[];
  couponCode: string | null;
  shippingMethod: ShippingMethodId;
  paymentMethod: PaymentMethodId;
  uid: string | null;
}

export type Unsubscribe = () => void;

// ממשק אחיד לשכבת הנתונים — מימוש Firestore אמיתי ומימוש דמו מקומי
export interface DataSource {
  subscribeProducts(cb: (products: Product[]) => void): Unsubscribe;
  addProduct(data: Omit<Product, 'id' | 'createdAt'>): Promise<string>;
  updateProduct(id: string, data: Partial<Omit<Product, 'id'>>): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  seedProducts(): Promise<number>;

  placeOrder(input: PlaceOrderInput): Promise<Order>;
  subscribeOrders(cb: (orders: Order[]) => void): Unsubscribe;
  subscribeMyOrders(uid: string, cb: (orders: Order[]) => void): Unsubscribe;
  getOrder(id: string): Promise<Order | null>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<void>;
  createShipment(id: string): Promise<string>; // מחזיר Tracking ID

  subscribeCustomers(cb: (customers: Customer[]) => void): Unsubscribe;
  subscribeInventory(cb: (movements: InventoryMovement[]) => void): Unsubscribe;
}
