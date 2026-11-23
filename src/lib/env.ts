export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function isDemoMode() {
  return process.env.NODE_ENV === "development" && process.env.CLIENT_HUB_DEMO === "true";
}

export const serviceUrls = {
  app: process.env.NEXT_PUBLIC_APP_URL,
  admin: process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL,
  vault: process.env.NEXT_PUBLIC_PASS_VAULT_URL,
};

export const cookieOptions = {
  name: process.env.NODE_ENV === "production" ? "__Host-nmark-client-hub-auth" : "nmark-client-hub-auth",
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
} as const;
