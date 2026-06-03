/* ============================================================
   R&B — Research and Beyond | supabase.js
   Supabase client configuration and auth helpers
   ============================================================

   SETUP — 3 steps, takes about 60 seconds:

   1. Go to https://supabase.com/dashboard
      → open your project
      → click "Project Settings" (gear icon, bottom-left sidebar)
      → click "API" in the left menu

   2. Copy the value under "Project URL"
      Paste it below as the value of RB_SUPABASE_URL (replace the placeholder).

   3. Copy the key listed under "Project API Keys → anon public"
      Paste it below as the value of RB_SUPABASE_KEY (replace the placeholder).

   The anon key is safe to expose in the browser — Supabase Row Level Security
   controls what data each user can read/write.

   ============================================================ */

const RB_SUPABASE_URL = 'https://ycwadtbkmszncncqhctn.supabase.co'; // ← PASTE YOUR PROJECT URL HERE
const RB_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljd2FkdGJrbXN6bmNuY3FoY3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzk5MzcsImV4cCI6MjA5NDk1NTkzN30.4gClfnSnTfJeMKEbCV-_n7NKC2KeNlVMXdxbgdQnqgA';    // ← PASTE YOUR ANON PUBLIC KEY HERE

/* ── Initialize client ───────────────────────────────────────────── */
const rbSupabase = window.supabase.createClient(RB_SUPABASE_URL, RB_SUPABASE_KEY);

// Fire session fetch immediately so it's in-flight before DOMContentLoaded
const _rbSessionPromise = rbSupabase.auth.getSession();

/* ── Auth helpers ────────────────────────────────────────────────── */

/**
 * Create a new user account.
 * Stores full_name in user_metadata so the dashboard can display it.
 * Returns { data, error } from Supabase.
 */
async function rbSignUp(name, email, password) {
  return rbSupabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: 'https://rn-b-website.vercel.app/dashboard.html',
    },
  });
}

/**
 * Sign in an existing user with email + password.
 * Returns { data, error } from Supabase.
 */
async function rbSignIn(email, password) {
  return rbSupabase.auth.signInWithPassword({ email, password });
}

/**
 * Sign out the currently logged-in user.
 * Returns { error } from Supabase.
 */
async function rbSignOut() {
  return rbSupabase.auth.signOut();
}

/**
 * Return the current session object, or null if logged out.
 */
async function rbGetSession() {
  const { data: { session } } = await _rbSessionPromise;
  return session;
}

/* ── Payment helpers ─────────────────────────────────────────────── */

/**
 * Insert a payment request row with status 'pending'.
 * Requires a `payment_requests` table with columns:
 *   user_id uuid, plan text, payment_method text, transaction_id text,
 *   status text, created_at timestamptz (default now())
 */
async function rbSubmitPayment(plan, method, transactionId) {
  const session = await rbGetSession();
  if (!session) return { error: { message: 'Not logged in.' } };
  return rbSupabase.from('payment_requests').insert({
    user_id: session.user.id,
    plan: plan,
    payment_method: method,
    transaction_id: transactionId,
    status: 'pending',
  });
}

/**
 * Return the effective plan status for the current user.
 * Possible return values: 'free' | 'pending' | 'scholar' | 'pro'
 * Reads the most recent payment_request row for this user.
 */
async function rbGetPaymentStatus() {
  const session = await rbGetSession();
  if (!session) return 'free';
  const { data, error } = await rbSupabase
    .from('payment_requests')
    .select('plan, status')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return 'free';
  if (data.status === 'pending') return 'pending';
  if (data.status === 'approved') return data.plan; // 'scholar' or 'pro'
  return 'free';
}

/* ── Page guards ─────────────────────────────────────────────────── */

/**
 * Use on PROTECTED pages (e.g. dashboard.html).
 * Redirects to signin.html if the visitor is not logged in.
 * Returns the session if authenticated, null otherwise.
 */
async function rbRequireAuth() {
  const session = await rbGetSession();
  if (!session) {
    window.location.replace('signin.html');
    return null;
  }
  return session;
}

/**
 * Use on PUBLIC-ONLY pages (signup.html, signin.html).
 * Redirects already-logged-in users to the dashboard so they
 * don't land on the auth pages unnecessarily.
 */
async function rbRedirectIfLoggedIn() {
  const session = await rbGetSession();
  if (session) {
    window.location.replace('dashboard.html');
  }
}
