// ─────────────────────────────────────────────────────────────────────────
// Edge Function: admin-users
//
// Gestão de operadores pelo admin, com service_role no servidor (nunca no
// frontend). Valida que o caller é admin via JWT + is_admin().
//
// POST body:
//   { action: 'create',       email, password, nome?, cargo? }
//   { action: 'set_password',  user_id, password }
//   { action: 'set_active',    user_id, active }
//
// 'create' cria o usuário já confirmado (login imediato) como operator.
// 'set_active' bane/desbane no Auth (revoga tokens) e reflete em profiles.ativo.
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

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'Sessão inválida' }, 401)

  const { data: isAdmin } = await userClient.rpc('is_admin', { uid: userData.user.id })
  if (!isAdmin) return json({ error: 'Apenas administradores' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const action = String(body.action ?? '')

  if (action === 'create') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const nome = String(body.nome ?? '').trim()
    const cargo = String(body.cargo ?? '').trim()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail inválido' }, 400)
    if (password.length < 6) return json({ error: 'A senha deve ter ao menos 6 caracteres' }, 400)

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    })
    if (cErr) return json({ error: cErr.message }, 400)

    const uid = created.user?.id
    // O trigger handle_new_user já criou o profile (role operator). Completa os dados.
    if (uid) {
      await admin
        .from('profiles')
        .update({ nome: nome || null, cargo: cargo || null, onboarded: true })
        .eq('id', uid)
    }
    return json({ ok: true, user_id: uid ?? null })
  }

  if (action === 'set_password') {
    const userId = String(body.user_id ?? '')
    const password = String(body.password ?? '')
    if (!userId) return json({ error: 'user_id obrigatório' }, 400)
    if (password.length < 6) return json({ error: 'A senha deve ter ao menos 6 caracteres' }, 400)

    const { error: uErr } = await admin.auth.admin.updateUserById(userId, { password })
    if (uErr) return json({ error: uErr.message }, 400)
    return json({ ok: true })
  }

  if (action === 'set_active') {
    const userId = String(body.user_id ?? '')
    const active = body.active === true
    if (!userId) return json({ error: 'user_id obrigatório' }, 400)
    if (userId === userData.user.id) return json({ error: 'Você não pode alterar o próprio acesso' }, 400)

    // Bane (revoga emissão de novos tokens) ao desativar; desbane ao reativar.
    const { error: bErr } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? 'none' : '876000h', // ~100 anos
    })
    if (bErr) return json({ error: bErr.message }, 400)

    const { error: pErr } = await admin.from('profiles').update({ ativo: active }).eq('id', userId)
    if (pErr) return json({ error: pErr.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'action inválida (use create | set_password | set_active)' }, 400)
})
