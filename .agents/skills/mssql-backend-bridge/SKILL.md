---
name: mssql-backend-bridge
description: On-premise Node.js daemon (smartBridge.js) architecture, smart_* table polling, B2C order ingestion, and MSSQL warehouse database sync.
---

# MSSQL Backend Bridge & On-Premise Daemon (`smartBridge.js`)

This skill documents the architecture and governance of the dedicated B's Mart on-premise Node.js daemon (`smartBridge.js`, stored in `reference/smartBridge.js`) connected to the enterprise MSSQL warehouse database (`BachirHome_2026`).

---

## 1. Governance & Network Isolation Notice

> [!IMPORTANT]
> **Roman's Sole Ownership & Zero Direct Client Connection**:
> 1. **Roman's Exclusive File**: Only Roman manages `reference/smartBridge.js`. Reference updates only happen when the user pastes a new full file or confirms a deployed server edit with **`alry`**.
> 2. **MSSQL Zero-Assumption Protocol**: Never guess MSSQL table names, column names, views, or stored procedure signatures—always ask the user first.
> 3. **Zero Direct Customer Connection**: Consumer web browsers and mobile apps connect **exclusively to Supabase Cloud** and **Cloudflare R2**. They **NEVER** call `http://192.168.1.3:8090`.

---

## 2. Bridge Responsibilities (`smartBridge.js`)

### A. Outbound B2C Order Sync (`smart_orders` $\rightarrow$ MSSQL)
- Polls or subscribes to `public.smart_orders` where `status = 'Pending'` (or `erp_synced = false`).
- Fetches associated line items from `public.smart_order_items`.
- Resolves customer or guest metadata (`full_name`, `phone`, `city`, `address`, `delivery_fee`, `coupon_code`, `discount_amount`, `total_amount`).
- Executes the corresponding MSSQL transaction / stored procedure in `BachirHome_2026`.
- Updates `public.smart_orders` with the ERP reference ID and transitions `status` to `'Confirmed'`.

### B. Order Status & Inventory Synchronization (MSSQL $\rightarrow$ Supabase)
- Periodically syncs stock quantities (`qtty`), retail prices (`price`), and item discounts (`discount`) from MSSQL (`BachirHome_2026`) to the shared `public.tbl_items` table in Supabase.
- Pushes fulfillment status updates (`Confirmed`, `Out for Delivery`, `Delivered`, `Cancelled`) back to `public.smart_orders`.

### C. Asynchronous RPC Broker (`smart_task_queue`)
- Watches `public.smart_task_queue` for `status = 'pending'` tasks initiated by B's Mart clients or admins.
- Executes the requested MSSQL action and writes the response payload along with `status = 'completed'` or `status = 'error'`.

---

## 3. Resilience & Error Handling

- **Idempotency**: Ensure order ingestion checks for existing `smart_order_id` references before inserting into MSSQL so network retries never duplicate an order in the warehouse ERP.
- **Graceful Reconnection**: Handle temporary internet or Supabase WebSocket drops with exponential backoff and automatic polling fallback.
