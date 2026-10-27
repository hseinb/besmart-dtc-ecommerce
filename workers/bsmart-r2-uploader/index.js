const SUPABASE_URL = "https://nhellhapzcylcukdxcwo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_EDjiXt4xhai8kjZtcGL4Kg_hvDYJuMD";
const R2_PUBLIC_BASE = "https://pub-91d344728db8455caa2530306bdfbcb0.r2.dev";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Staff-User-Id",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "bsmart-r2-uploader" });
    }

    if (request.method !== "POST" || (url.pathname !== "/upload" && url.pathname !== "/")) {
      return jsonResponse({ success: false, error: "Method or path not allowed" }, 405);
    }

    try {
      const formData = await request.formData();
      const staffUserId =
        request.headers.get("X-Staff-User-Id") ||
        (formData.get("staffUserId") ? String(formData.get("staffUserId")).trim() : "");

      if (!staffUserId) {
        return jsonResponse({ success: false, error: "Missing staffUserId authentication." }, 401);
      }

      // Verify staff session & role with Supabase RPC
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/smart_verify_staff_session`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_user_id: staffUserId }),
      });

      if (!rpcRes.ok) {
        return jsonResponse(
          { success: false, error: `Auth verification failed (HTTP ${rpcRes.status})` },
          401
        );
      }

      const rpcData = await rpcRes.json();
      const role = rpcData?.user?.role;
      const isActive = rpcData?.user?.is_active;

      if (!rpcData?.success || !isActive || !["admin", "merchandising"].includes(role)) {
        return jsonResponse(
          {
            success: false,
            error: "Unauthorized: active admin or merchandising staff role required.",
          },
          403
        );
      }

      const itemIdRaw = formData.get("itemId");
      const codeRaw = formData.get("code") || "ITEM";
      const slotKeyRaw = formData.get("slotKey") || "main";

      const itemId = String(itemIdRaw || "").replace(/[^0-9a-zA-Z_-]/g, "");
      if (!itemId) {
        return jsonResponse({ success: false, error: "Invalid or missing itemId." }, 400);
      }

      const safeCode = String(codeRaw)
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 64) || "ITEM";

      const validSlots = [
        "hero1",
        "dim1",
        "angle1",
        "angle2",
        "angle3",
        "angle4",
        "angle5",
        "main",
        "angle",
        "lifestyle",
        "detail",
      ];
      const safeSlot = validSlots.includes(String(slotKeyRaw)) ? String(slotKeyRaw) : "hero1";

      const thumbBlob = formData.get("thumb");
      const viewBlob = formData.get("view");
      const rawBlob = formData.get("raw");

      if (!thumbBlob || !viewBlob || !rawBlob) {
        return jsonResponse(
          { success: false, error: "Missing one or more required WebP tiers (thumb, view, raw)." },
          400
        );
      }

      const ts = Date.now();
      const filename = `${safeCode}_${safeSlot}_${ts}.webp`;

      const thumbKey = `bsmart/thumb/${itemId}/${filename}`;
      const viewKey = `bsmart/view/${itemId}/${filename}`;
      const rawKey = `bsmart/raw/${itemId}/${filename}`;

      const putOptions = {
        httpMetadata: {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable",
        },
      };

      await Promise.all([
        env.CATALOG_IMAGES.put(thumbKey, await thumbBlob.arrayBuffer(), putOptions),
        env.CATALOG_IMAGES.put(viewKey, await viewBlob.arrayBuffer(), putOptions),
        env.CATALOG_IMAGES.put(rawKey, await rawBlob.arrayBuffer(), putOptions),
      ]);

      return jsonResponse({
        success: true,
        urls: {
          thumb: `${R2_PUBLIC_BASE}/${thumbKey}`,
          view: `${R2_PUBLIC_BASE}/${viewKey}`,
          raw: `${R2_PUBLIC_BASE}/${rawKey}`,
        },
      });
    } catch (err) {
      return jsonResponse(
        {
          success: false,
          error: err instanceof Error ? err.message : "Internal Worker upload error",
        },
        500
      );
    }
  },
};
