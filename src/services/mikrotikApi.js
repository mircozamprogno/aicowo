import { supabase } from './supabase';

// Calls /api/mikrotik/<path> with the user's session: the proxy only serves logged-in admins
export const mikrotikFetch = async (path, init = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(`/api/mikrotik${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
};
