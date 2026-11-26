import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

function normalizeHost(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).host.toLowerCase();
  } catch {
    return null;
  }
}

function readVitePublicEnv(
  key: "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY",
): string | undefined {
  const value = key === "VITE_SUPABASE_URL"
    ? import.meta.env?.["VITE_SUPABASE_URL"]
    : import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"];
  return (typeof value === "string" ? value.trim() : undefined) || process.env[key]?.trim();
}

export function validateServerSupabaseConfig(options?: { requireServiceRole?: boolean }) {
  const url = (
    process.env["SUPABASE_URL"]?.trim() || readVitePublicEnv("VITE_SUPABASE_URL")
  )?.trim();
  const publishableKey = (
    process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim() ||
    readVitePublicEnv("VITE_SUPABASE_PUBLISHABLE_KEY")
  )?.trim();
  // Service-role secret MUST remain server-only (never read from VITE_ variables).
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();

  const missing: string[] = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!publishableKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
  if (options?.requireServiceRole && !serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length > 0) {
    throw new SupabaseConfigError(
      `CONFIG_ERROR: إعدادات اتصال Supabase على الخادم غير مكتملة (${missing.join(", ")}).`,
    );
  }

  const clientUrl = readVitePublicEnv("VITE_SUPABASE_URL");
  const serverHost = normalizeHost(url);
  const clientHost = normalizeHost(clientUrl);
  if (serverHost && clientHost && serverHost !== clientHost) {
    throw new SupabaseConfigError(
      "CONFIG_ERROR: عدم تطابق عنوان مشروع Supabase بين متغير المتصفح والخادم.",
    );
  }

  return {
    url: url!,
    publishableKey: publishableKey!,
    serviceRoleKey,
  };
}

/**
 * Non-persistent Supabase client using ONLY the publishable/anon key.
 * Used for server-proxied password authentication (e.g., student code lookup)
 * so passwords are never authenticated via the service-role client.
 */
export function createEphemeralPublishableClient() {
  const { url, publishableKey } = validateServerSupabaseConfig();
  return createClient<Database>(url, publishableKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Simple per-identifier in-memory sliding window rate limiter for unauthenticated auth lookups
const authAttempts = new Map<string, { count: number; resetAt: number }>();

export function assertAuthRateLimit(bucketKey: string, maxAttempts = 12, windowMs = 60_000) {
  const now = Date.now();
  const current = authAttempts.get(bucketKey);
  if (!current || current.resetAt <= now) {
    authAttempts.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= maxAttempts) {
    throw new Error(
      "RATE_LIMIT: تم تجاوز عدد محاولات تسجيل الدخول المسموح بها؛ يرجى المحاولة بعد دقيقة.",
    );
  }
  current.count += 1;
}
