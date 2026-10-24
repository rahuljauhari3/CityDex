/**
 * Supabase-backed store (design.md §4). Selected by `getStore()` only when
 * Supabase keys are present. The SQL schema with RLS lives in
 * `supabase/schema.sql`; the query layer is not implemented yet, so every
 * method throws a clear error. Demo mode never reaches this module.
 *
 * Server-only module: must never be imported into a client component.
 */

import "server-only";
import type { Store } from "./store";

const NOT_IMPLEMENTED =
  "supabaseStore is not implemented yet. Unset NEXT_PUBLIC_SUPABASE_URL to use the demo store.";

export const supabaseStore: Store = new Proxy({} as Store, {
  get() {
    return () => Promise.reject(new Error(NOT_IMPLEMENTED));
  },
});
