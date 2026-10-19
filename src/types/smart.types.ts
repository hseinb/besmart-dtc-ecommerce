export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================================
// 1. Shared Catalog Read Tables (public.items, item_class, item_images, item_tags, recosys_items)
// ============================================================================

export interface CatalogItem {
  item_id: number;
  code: string;
  item_name: string;
  class_id: number | null;
  description: string | null;
  discount: number;
  material: string | null;
  house_rooms: string | null;
  length: number | null;
  width: number | null;
  thickness: number | null;
  weight: number | null;
  tags: string | null;
  upc: string | null;
  qtty: number;
  srp: number;
  base_b2b_srp?: number;
  is_active: boolean;
  is_b2c_hidden?: boolean;
  is_custom_price?: boolean;
  is_custom_discount?: boolean;
  markup_percent_applied?: number;
  modified_date: string;
  image_updated_at: string | null;
}

export interface ItemClass {
  item_class_id: number;
  item_class: string;
  item_class_description: string | null;
  parent_class_id: number | null;
  def_commission: number | null;
  def_discount: number | null;
  modified_date: string;
}

export interface ItemImages {
  item_id: number;
  hero1: Json | null;
  dim1: Json | null;
  angle1: Json | null;
  angle2: Json | null;
  angle3: Json | null;
  angle4: Json | null;
  angle5: Json | null;
  video: string | null;
  updated_at: string;
}

export interface ItemWithImages extends CatalogItem {
  item_images?: ItemImages | ItemImages[] | null;
}

export interface ItemTag {
  id: string;
  tag_name: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  local_image_path: string | null;
  updated_at: number | null;
}

export interface RecosysNeighbor {
  code?: string;
  name?: string;
  item_id?: string | number;
  similarity?: number;
  distance?: number;
}

export interface RecosysItem {
  item_id: string;
  code: string | null;
  name: string | null;
  category: string | null;
  price: number | null;
  stock: number | null;
  cluster_id: number | null;
  cluster_name: string | null;
  neighbors: RecosysNeighbor[] | Json | null;
  sales_pitch: string | null;
  merchandising_notes: string | null;
}

// ============================================================================
// 2. Isolated B's Mart B2C Tables (smart_*)
// ============================================================================

export type SmartPriceRoundingMode = "none" | "nearest_0_25" | "nearest_0_50" | "ending_99";

export interface SmartAppSettings {
  id: string;
  hide_out_of_stock: boolean;
  hide_stock_qty: boolean;
  require_images: boolean;
  default_sort: string;
  hidden_categories: number[];
  free_shipping_threshold: number;
  default_delivery_fee: number;
  default_markup_percent?: number;
  price_rounding_mode?: SmartPriceRoundingMode;
  b2b_acct_id?: number;
  flash_sale_title: string;
  flash_sale_ends_at: string | null;
  enable_cod: boolean;
  enable_whish: boolean;
  enable_omt: boolean;
  enable_card_pos: boolean;
  whatsapp_support_phone: string;
  latest_version: string;
  latest_build: number;
  update_url_android: string;
  update_url_ios: string;
  update_message: string;
  force_update: boolean;
  updated_at?: string;
}

export interface SmartPricingRule {
  class_id: number;
  markup_percent: number | null;
  fixed_markup_addon: number;
  default_b2c_discount: number;
  is_b2c_enabled: boolean;
  updated_at?: string;
}

export type SmartStaffRole = "admin" | "merchandising" | "fulfillment";

export interface SmartStaffUser {
  user_id: string;
  username: string;
  full_name: string;
  role: SmartStaffRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface SmartDeliveryZone {
  zone_id: number;
  zone_name: string;
  delivery_fee: number;
  estimated_delivery: string;
  is_active: boolean;
  display_order: number;
}

export interface SmartCustomer {
  customer_id: string;
  phone: string;
  full_name: string;
  email: string | null;
  role: "customer" | "admin";
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at: string;
}

export interface SmartAddress {
  address_id: string;
  customer_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  zone_id: number | null;
  city_area: string;
  street: string;
  building_floor: string | null;
  landmark: string | null;
  is_default: boolean;
  created_at: string;
}

export interface SmartCoupon {
  coupon_id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: "percentage" | "fixed" | "free_shipping";
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  is_public_collectible: boolean;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
}

export interface SmartBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  action_type: "category" | "tag" | "product" | "deals" | "url";
  action_target: string | null;
  badge_text: string | null;
  badge_color: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export type SmartPaymentMethod = "cod" | "whish" | "omt" | "card_pos";
export type SmartOrderStatus =
  | "Pending"
  | "Confirmed"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";

export interface SmartOrder {
  order_id: number;
  order_number: string;
  trx_id: number | null;
  b2b_order_id?: number | null;
  b2b_status?: string | null;
  customer_id: string | null;
  is_guest: boolean;
  recipient_name: string;
  recipient_phone: string;
  zone_id: number | null;
  zone_name: string | null;
  city_area: string;
  street_address: string;
  building_floor: string | null;
  landmark: string | null;
  payment_method: SmartPaymentMethod;
  subtotal: number;
  item_discount_total: number;
  coupon_code: string | null;
  coupon_discount: number;
  delivery_fee: number;
  total: number;
  status: SmartOrderStatus;
  note: string | null;
  created_date: string;
  modified_date: string;
}

export interface SmartOrderDetail {
  order_detail_id: number;
  order_id: number;
  item_id: number;
  quantity: number;
  srp: number;
  unit_price: number;
  discount: number;
  total: number;
  note: string | null;
  items?: CatalogItem;
}
