/**
 * Brand + business settings.
 * Edit these values to rename the shop, change its colours or connect the
 * order channel. Nothing here is secret — never put API keys in this file.
 */
export const brand = {
  name: 'ROLL LAB',
  tagline: 'Build your dream roll',
  palette: {
    cream: '#F4EAD9',
    creamDeep: '#EADBC2',
    cinnamon: '#7A4325',
    cinnamonDeep: '#4A2716',
    pistachio: '#93AE57',
    butter: '#F6D77B',
    caramel: '#C9883F',
    whiteChocolate: '#FBF6EC',
    ink: '#2E1C12',
  },
  /**
   * Optional: a WhatsApp number (international format, digits only, e.g.
   * "972501234567") that receives orders while no payment provider is
   * connected. Leave empty to hide the WhatsApp button.
   * Can also be set at build time with VITE_ORDER_WHATSAPP.
   */
  orderWhatsApp: (import.meta.env.VITE_ORDER_WHATSAPP as string | undefined) ?? '',
}
