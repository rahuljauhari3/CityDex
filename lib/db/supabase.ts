/**
 * Supabase-backed store skeleton (design.md §4).
 *
 * Selected by `getStore()` when `hasSupabase` is true. The real Postgres +
 * Storage queries and RLS land in a later milestone (M7). This skeleton exists
 * so the selection wiring compiles; each method throws until implemented, which
 * is unreachable in demo mode (the memory store is used when Supabase is not
 * configured).
 *
 * Server-only module: must never be imported into a client component.
 */

import "server-only";
import type { Store } from "./store";

const NOT_IMPLEMENTED = "supabaseStore is not implemented yet (see M7).";

function notImplemented(): never {
  throw new Error(NOT_IMPLEMENTED);
}

export const supabaseStore: Store = {
  getPlaces: notImplemented,
  getPlace: notImplemented,
  createPlace: notImplemented,
  recordCollection: notImplemented,
  createStamp: notImplemented,
  getStampsByUser: notImplemented,
  getDexForUser: notImplemented,
  createRoute: notImplemented,
  getGoals: notImplemented,
  upsertGoal: notImplemented,
  getLeaderboard: notImplemented,
  addFriend: notImplemented,
  acceptFriend: notImplemented,
  listFriends: notImplemented,
  getFeed: notImplemented,
  addKudos: notImplemented,
  listBadges: notImplemented,
  awardBadge: notImplemented,
  deleteAccount: notImplemented,
};
