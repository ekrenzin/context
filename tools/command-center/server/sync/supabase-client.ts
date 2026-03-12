import { getSetting } from "../db/index.js";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  jwt?: string;
}

export function resolveSupabaseConfig(): SupabaseConfig | null {
  const url = getSetting("supabase_url");
  const anonKey = getSetting("supabase_anon_key");
  if (!url || !anonKey) return null;
  return { url, anonKey, jwt: getSetting("supabase_jwt") ?? undefined };
}

export interface SupabaseClient {
  from(table: string): TableQuery;
  channel(name: string): RealtimeChannel;
}

export interface TableQuery {
  select(columns?: string): TableQuery;
  insert(rows: Record<string, unknown>[]): Promise<QueryResult>;
  upsert(rows: Record<string, unknown>[]): Promise<QueryResult>;
  update(fields: Record<string, unknown>): TableQuery;
  eq(column: string, value: unknown): TableQuery;
  order(column: string, opts?: { ascending: boolean }): TableQuery;
  limit(n: number): TableQuery;
  then(resolve: (result: QueryResult) => void): void;
}

export interface QueryResult {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
}

export interface RealtimeChannel {
  on(event: string, filter: Record<string, unknown>, callback: (payload: unknown) => void): RealtimeChannel;
  subscribe(): RealtimeChannel;
  unsubscribe(): void;
}

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient | null {
  try {
    // Dynamic import to avoid hard dependency when Supabase is not configured
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require("@supabase/supabase-js");
    return createClient(config.url, config.anonKey, {
      auth: { persistSession: false },
      global: { headers: config.jwt ? { Authorization: `Bearer ${config.jwt}` } : {} },
    });
  } catch {
    console.warn("[sync] @supabase/supabase-js not installed -- sync disabled");
    return null;
  }
}
