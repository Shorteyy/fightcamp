// Deletes a user's auth account entirely (not just their app data), so no
// "zombie" login survives after removal. Coach-only. The DB handles the
// cascade (profiles -> fighters -> weight_entries/meal_entries/goals/
// training_attendees/gala_participants/meal_plans) and blocks deleting the
// last remaining coach via a trigger — this function just authorizes the
// caller and performs the one privileged call only the service role can make.
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401);

    // Client scoped to the CALLER's own JWT — respects RLS, used only to verify identity/role.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: 'Invalid session' }, 401);

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();
    if (profileErr || callerProfile?.role !== 'coach') {
      return jsonResponse({ error: 'Only coaches can delete a team member' }, 403);
    }

    const body = await req.json().catch(() => null);
    const targetUserId: string | undefined = body?.userId;
    if (!targetUserId) return jsonResponse({ error: 'Missing userId' }, 400);

    // Privileged client — service role, bypasses RLS. Only usable server-side.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(targetUserId);

    if (deleteErr) {
      // Surfaces the DB's own message, e.g. the last-coach lockout trigger.
      return jsonResponse({ error: deleteErr.message }, 400);
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
