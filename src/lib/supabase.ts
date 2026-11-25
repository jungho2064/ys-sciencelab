import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const SCIENCE_LAB_SCHEMA =
  process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "science_lab";

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);

let browserClient: SupabaseClient | null = null;

/**
 * `science_lab` 전용 스키마와 통신하는 싱글톤 Supabase 클라이언트 반환
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return browserClient;
}

/**
 * `science_lab` 스키마 쿼리 빌더 단축 헬퍼
 */
export function getScienceLabDb() {
  const client = getSupabaseClient();
  if (!client) return null;
  return client.schema(SCIENCE_LAB_SCHEMA);
}
