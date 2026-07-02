import type { ShippingMethodId } from '@/lib/data/types';

export interface ShippingMethod {
  id: ShippingMethodId;
  label: string;
  description: string;
  price: number;
  eta: string;
  emoji: string;
}

export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: 'pickup',
    label: 'איסוף עצמי',
    description: 'איסוף מנקודת החלוקה שלנו בתל אביב',
    price: 0,
    eta: 'זמין תוך יום עסקים',
    emoji: '🏬',
  },
  {
    id: 'standard',
    label: 'משלוח רגיל',
    description: 'שליח עד הבית לכל הארץ',
    price: 25,
    eta: '3-5 ימי עסקים',
    emoji: '📦',
  },
  {
    id: 'express',
    label: 'משלוח מהיר',
    description: 'שליח מהיר עד הבית',
    price: 45,
    eta: 'עד יום עסקים אחד',
    emoji: '🚀',
  },
];

export function getShippingMethod(id: ShippingMethodId): ShippingMethod {
  return SHIPPING_METHODS.find((m) => m.id === id) ?? SHIPPING_METHODS[1];
}
