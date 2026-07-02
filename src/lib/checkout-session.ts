import type { CustomerDetails, Order } from '@/lib/data/types';

// העברת נתוני checkout בין עמודים (פרטי משלוח והזמנה אחרונה להצגה במסך הצלחה).
// נתוני תצוגה בלבד — לא אישורי גישה ולא נתוני אבטחה.

const DETAILS_KEY = 'squidget-checkout-details';
const LAST_ORDER_KEY = 'squidget-last-order';

export function saveCheckoutDetails(details: CustomerDetails) {
  try {
    window.sessionStorage.setItem(DETAILS_KEY, JSON.stringify(details));
  } catch {
    // אין אחסון זמין
  }
}

export function loadCheckoutDetails(): CustomerDetails | null {
  try {
    const raw = window.sessionStorage.getItem(DETAILS_KEY);
    return raw ? (JSON.parse(raw) as CustomerDetails) : null;
  } catch {
    return null;
  }
}

export function saveLastOrder(order: Order) {
  try {
    window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    window.sessionStorage.removeItem(DETAILS_KEY);
  } catch {
    // אין אחסון זמין
  }
}

export function loadLastOrder(): Order | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_ORDER_KEY);
    return raw ? (JSON.parse(raw) as Order) : null;
  } catch {
    return null;
  }
}
