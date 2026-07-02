export interface Coupon {
  code: string;
  percent: number;
  description: string;
}

export const COUPONS: Coupon[] = [
  { code: 'WELCOME10', percent: 10, description: 'הנחת היכרות 10%' },
  { code: 'SQUISH20', percent: 20, description: 'הנחת מועדון 20%' },
];

export function findCoupon(code: string): Coupon | null {
  const normalized = code.trim().toUpperCase();
  return COUPONS.find((c) => c.code === normalized) ?? null;
}

export function couponDiscount(coupon: Coupon | null, subtotal: number): number {
  if (!coupon) return 0;
  return Math.round(subtotal * (coupon.percent / 100) * 100) / 100;
}
