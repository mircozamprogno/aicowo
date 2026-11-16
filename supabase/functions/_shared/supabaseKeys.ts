// New Supabase API keys (sb_publishable_… / sb_secret_…), injected by the runtime as JSON maps keyed by name.
// They replace the legacy anon / service_role JWTs.
const pick = (env: string): string => {
  const keys = JSON.parse(Deno.env.get(env) ?? "{}");
  const key = keys["default"] ?? Object.values(keys)[0];
  if (!key) throw new Error(`${env} is empty`);
  return key as string;
};

export const SUPABASE_SECRET_KEY = pick("SUPABASE_SECRET_KEYS");
export const SUPABASE_PUBLISHABLE_KEY = pick("SUPABASE_PUBLISHABLE_KEYS");
