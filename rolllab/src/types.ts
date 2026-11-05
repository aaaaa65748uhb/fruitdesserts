/* ------------------------------------------------------------------ */
/*  Catalog types — everything a shop owner may want to configure      */
/* ------------------------------------------------------------------ */

export interface CurrencyConfig {
  code: string // ISO 4217, e.g. "ILS"
  symbol: string // e.g. "₪"
  locale: string // used for number formatting
}

export interface BaseOption {
  id: string
  name: string
  description: string
  price: number
  /** Colours used to paint the procedural roll. */
  colors: {
    dough: string // soft inner dough
    crust: string // golden-brown baked surface
    bottom: string // dark caramelised underside
    filling: string // colour of the swirl between the layers
  }
}

export interface SauceOption {
  id: string
  name: string
  shortName: string
  description: string
  price: number
  /** Extra charge applied once the poured amount exceeds the extra threshold. */
  extraCharge: number
  color: string
  /** 0 = matte cream, 1 = glassy syrup */
  gloss: number
  capColor: string
}

export type ToppingShape =
  | 'chunk' // irregular faceted chunks (chopped nuts, crumbs)
  | 'kernel' // whole pistachio kernels
  | 'shard' // flat biscuit shards
  | 'chip' // chocolate chips (kiss shape)
  | 'block' // white chocolate pieces
  | 'halfnut' // hazelnut halves / pieces
  | 'flake' // almond flakes
  | 'sprinkle' // rainbow sprinkles
  | 'shred' // toasted coconut shreds

export interface ToppingOption {
  id: string
  name: string
  description: string
  price: number
  extraCharge: number
  shape: ToppingShape
  /** Palette picked randomly per piece. */
  colors: string[]
  /** Colour of the heap bed inside the tray. */
  bedColor: string
  /** Approximate piece size in scene units (roll radius = 1). */
  size: number
  /** Number of pieces that make one regular portion. */
  portion: number
  /** Pieces released per sprinkle tick. */
  perTick: number
  /** Hard cap on pieces of this topping on one roll. */
  maxPieces: number
  roughness: number
  clearcoat?: number
}

export interface FillingOption {
  id: string
  name: string
  description: string
  price: number
  color: string
}

export interface ExtraOption {
  id: string
  name: string
  description: string
  price: number
}

export interface CatalogLimits {
  maxSauces: number
  maxToppings: number
  maxFillings: number
  maxExtras: number
}

export interface PricingRules {
  /** Sauce volume (in portions) above which `extraCharge` kicks in. */
  sauceExtraThreshold: number
  /** Scene-volume that equals one sauce portion. */
  saucePortionVolume: number
  /** Topping amount (in portions) above which `extraCharge` kicks in. */
  toppingExtraThreshold: number
}

export interface FulfillmentConfig {
  deliveryFee: number
  freeDeliveryOver: number
  pickupAddress: string
  pickupSlots: string[]
  deliveryCities: string[]
}

export interface Catalog {
  currency: CurrencyConfig
  bases: BaseOption[]
  sauces: SauceOption[]
  toppings: ToppingOption[]
  fillings: FillingOption[]
  extras: ExtraOption[]
  limits: CatalogLimits
  pricing: PricingRules
  fulfillment: FulfillmentConfig
}

/* ------------------------------------------------------------------ */
/*  Design — the roll a customer is building                           */
/* ------------------------------------------------------------------ */

export interface SauceDrip {
  angle: number // around the roll (radians, roll-local)
  radius: number // where the wall is at that angle
  top: number // y at the top edge
  length: number
  width: number
  bornAt: number // Date.now() when created (for the run-down animation)
}

export interface SauceStroke {
  id: string
  sauceId: string
  kind: 'line' | 'pool'
  /** Flat array of x, y, z, r for line strokes (roll-local space). */
  points: number[]
  /** Glaze pool parameters for `pool` strokes. */
  pool?: { x: number; z: number; radius: number; thickness: number }
  drips: SauceDrip[]
  /** Scene-volume of sauce — drives amount display and pricing. */
  volume: number
}

export interface ToppingPiece {
  x: number
  z: number
  rx: number
  ry: number
  rz: number
  s: number // uniform size multiplier
  sx: number // non uniform stretch
  sy: number
  sz: number
  c: number // palette index
  bornAt: number // Date.now() — pieces fall from the scoop for a moment
  drop: number // fall height
}

export interface ToppingBatch {
  id: string
  toppingId: string
  pieces: ToppingPiece[]
}

export interface RollDesign {
  id: string
  name: string
  baseId: string
  fillingId: string | null
  sauces: SauceStroke[]
  toppings: ToppingBatch[]
  extras: string[]
}

/* ------------------------------------------------------------------ */
/*  Pricing                                                            */
/* ------------------------------------------------------------------ */

export type QuoteLineKind = 'base' | 'filling' | 'sauce' | 'topping' | 'extra' | 'surcharge'

export interface QuoteLine {
  kind: QuoteLineKind
  refId: string
  label: string
  detail?: string
  amount: number
}

export interface Quote {
  lines: QuoteLine[]
  base: number
  filling: number
  sauces: number
  toppings: number
  extras: number
  surcharges: number
  total: number
}

/* ------------------------------------------------------------------ */
/*  Cart & orders                                                      */
/* ------------------------------------------------------------------ */

export interface CartItem {
  id: string
  design: RollDesign
  unitPrice: number
  quantity: number
  thumbnail: string | null
  addedAt: number
}

export type FulfillmentMethod = 'delivery' | 'pickup'

export interface CheckoutForm {
  name: string
  phone: string
  method: FulfillmentMethod
  street: string
  city: string
  apartment: string
  pickupSlot: string
  notes: string
}

export interface OrderLine {
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
  summary: string
  /** Full design so a server can re-price it with the same PricingEngine. */
  design: RollDesign
}

export interface OrderPayload {
  reference: string
  createdAt: string
  currency: string
  customer: { name: string; phone: string }
  fulfillment: {
    method: FulfillmentMethod
    address?: string
    pickupSlot?: string
  }
  notes: string
  lines: OrderLine[]
  subtotal: number
  deliveryFee: number
  total: number
}
