import type { OrderStatus } from '@/lib/data/types';

const STATUS_STYLES: Record<OrderStatus, string> = {
  'חדש': 'bg-squid-blue-light text-sky-700',
  'בהכנה': 'bg-amber-100 text-amber-700',
  'נארז': 'bg-squid-purple-light text-squid-purple-dark',
  'מוכן': 'bg-teal-100 text-teal-700',
  'נשלח': 'bg-squid-pink-light text-squid-pink-dark',
  'הושלם': 'bg-emerald-100 text-emerald-700',
  'בוטל': 'bg-gray-200 text-gray-600',
};

const STATUS_EMOJIS: Record<OrderStatus, string> = {
  'חדש': '✨',
  'בהכנה': '👩‍🍳',
  'נארז': '📦',
  'מוכן': '✅',
  'נשלח': '🚚',
  'הושלם': '🎉',
  'בוטל': '❌',
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`chip whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {STATUS_EMOJIS[status]} {status}
    </span>
  );
}
