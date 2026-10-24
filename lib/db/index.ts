/**
 * Store selection (design.md §2, §4).
 *
 * Returns the active `Store` based on capability flags: the Supabase store when
 * configured, otherwise the in-memory demo store (REQ-1.6, REQ-1.7).
 *
 * Server-only: `getStore()` may reach the Supabase path, which pulls in
 * `server-only`. Import this from route handlers / server actions, never from
 * client components.
 */

import "server-only";
import { hasSupabase } from "@/lib/config";
import type { Store } from "./store";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";

export function getStore(): Store {
  return hasSupabase ? supabaseStore : memoryStore;
}

export type { Store } from "./store";
export * from "./types";
