// ─────────────────────────────────────────────────────────────────────────
// Edge Function: invite-user  (§12)
//
// POST /functions/v1/invite-user  { "email": "pessoa@empresa.com" }
//
// - Valida, via JWT do header Authorization, que o CALLER é admin (lendo o
//   role da tabela `profiles` — §13.5).
// - Só então usa a SERVICE_ROLE_KEY (server-only, nunca no frontend — §13.2)
//   para chamar auth.admin.inviteUserByEmail.
//
// Secrets necessários (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// (os dois primeiros já são injetados automaticamente pelo runtime).
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401)

  // Cliente no contexto do usuário (respeita RLS) para descobrir quem chama.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'Sessão inválida' }, 401)

  // Verifica se o caller é admin (via helper is_admin, que ignora RLS).
  const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin', {
    uid: userData.user.id,
  })
  if (adminErr) return json({ error: 'Falha ao validar permissão' }, 500)
  if (!isAdmin) return json({ error: 'Apenas administradores podem convidar' }, 403)

  let email: string | undefined
  try {
    const body = await req.json()
    email = String(body?.email ?? '').trim().toLowerCase()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'E-mail inválido' }, 400)
  }

  // Cliente admin (service_role) — só aqui, no servidor.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const redirectTo = Deno.env.get('INVITE_REDIRECT_TO') // ex: https://app.vercel.app/onboarding
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined
  )

  if (error) return json({ error: error.message }, 400)
  return json({ ok: true, user_id: data?.user?.id ?? null })
})
