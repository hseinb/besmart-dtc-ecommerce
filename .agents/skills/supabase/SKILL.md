---
name: supabase
description: Expert guidelines and best practices for developing and managing Supabase applications, smart_* PostgreSQL schema migrations, B2C Row-Level Security (RLS) policies, and TypeScript client integration.
license: Apache-2.0
metadata:
  version: v2
  publisher: supabase
---

# Supabase Development & `smart_*` Schema Management Skill

This skill provides operational and architectural guidelines for managing the **B's Mart (B2C)** Supabase backend, `smart_*` PostgreSQL schemas, B2C Row-Level Security (RLS) policies, and client integrations.

---

## 1. Supabase MCP Tools Usage

When interacting with Supabase via MCP tools:
- **`list_tables`**: Always inspect the existing schema and foreign key constraints before planning new tables or migrations.
- **`apply_migration`**: Use this for all DDL changes (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `CREATE POLICY`).
- **`execute_sql`**: Use for executing analytical or operational SQL queries. Never perform destructive unconstrained queries.
- **`get_project_url` & `get_publishable_keys`**: Retrieve connection URLs and anon/publishable keys for client configuration.
- **`query_logs`**: Inspect Postgres logs when debugging connection or constraint errors.

---

## 2. `smart_*` Table Naming & Schema Isolation Rules

1. **Mandatory `smart_` Prefix for All B's Mart Tables**:
   - Because B's Mart shares the Supabase project with Bhome B2B, every table created for B's Mart **MUST** begin with `smart_` (`smart_orders`, `smart_order_items`, `smart_users`, `smart_customers`, `smart_app_settings`, `smart_coupons`, `smart_wishlists`, `smart_reviews`, `smart_banners`, `smart_task_queue`).
   - **Never** modify or drop existing B2B tables (`orders`, `users`, `app_settings`, etc.).
2. **Primary Keys & Timestamps**:
   - Use `UUID PRIMARY KEY DEFAULT gen_random_uuid()` for consumer orders, customers, wishlists, and reviews.
   - Use `TIMESTAMPTZ DEFAULT now()` for `created_at` and `updated_at`.
3. **Foreign Keys & Indexes**:
   - Index all foreign keys (`user_id`, `order_id`, `item_id`) and lookup columns (`code` on `smart_coupons`, `status` on `smart_orders`, `phone` on `smart_customers`).

---

## 3. B2C Row Level Security (RLS) Policies

1. **Always Enable RLS on `smart_*` Tables**:
   ```sql
   ALTER TABLE public.smart_orders ENABLE ROW LEVEL SECURITY;
   ```
2. **Public Read Access for Storefront Config & Approved Reviews**:
   - `smart_app_settings`, `smart_banners`, and approved `smart_reviews` allow `SELECT` for both `anon` (guest) and `authenticated` roles.
3. **Dual Guest & Authenticated Order Insertion (`smart_orders`)**:
   - Allow `INSERT` for both `anon` (Guest Checkout where `user_id IS NULL`) and `authenticated` (`auth.uid() = user_id`).
   - Allow `SELECT` for authenticated users on their own orders (`auth.uid() = user_id`) or via a secure guest order tracking token RPC.
4. **Customer Profile & Wishlist Isolation (`smart_customers`, `smart_wishlists`)**:
   ```sql
   CREATE POLICY "Customers manage own wishlist"
   ON public.smart_wishlists
   FOR ALL
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id);
   ```
