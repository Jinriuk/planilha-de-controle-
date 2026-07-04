-- ─────────────────────────────────────────────────────────────────────────
-- 0004_security_hardening.sql
-- Ajustes recomendados pelo linter de segurança do Supabase.
-- ─────────────────────────────────────────────────────────────────────────

-- Pin search_path nas funções que faltavam (evita hijack de search_path).
alter function public.touch_updated_at() set search_path = public;
alter function public.audit_log_immutable() set search_path = public;

-- Funções de trigger não devem ser expostas como RPC no PostgREST.
-- (A execução via trigger não exige EXECUTE do usuário — nada quebra.)
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.log_apuracao_change() from public, anon, authenticated;
revoke all on function public.profile_guard() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.audit_log_immutable() from public, anon, authenticated;

-- is_admin: necessária para authenticated (policies RLS + edge function) e
-- service_role; anon não precisa.
revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;
