/**
 * Demo identity (design.md §2, REQ-1.3).
 *
 * Until auth lands, demo mode operates as a single stable user so the full
 * collect → Dex flow works with no keys. Server routes and the Dex screen share
 * this id. Replaced by real Supabase auth when configured (M7).
 */

export const DEMO_USER_ID = "demo-user";
export const DEMO_USERNAME = "you";
