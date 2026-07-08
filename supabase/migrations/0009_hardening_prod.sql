-- ─────────────────────────────────────────────────────────────────────────
-- 0009_hardening_prod.sql — Correções de segurança e integridade (produção)
--
-- 1) Fecha a falsificação de audit_log: qualquer autenticado podia INSERIR
--    linhas forjadas (user_id/valores arbitrários) na trilha "imutável".
-- 2) Bloqueia usuários desativados (ativo=false) no nível do banco — mesmo com
--    um JWT ainda válido — via is_active() nas tabelas operacionais.
-- 3) Constraints de integridade em parcelamentos.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1) audit_log: remove a policy permissiva de INSERT ────────────────────
-- O trigger log_apuracao_change é SECURITY DEFINER (roda como dono da tabela e
-- ignora RLS), então a auditoria continua sendo gravada normalmente. Sem esta
-- policy, um cliente autenticado NÃO consegue mais inserir linhas forjadas.
drop policy if exists "authenticated insert audit" on public.audit_log;

-- ── 2) is_active(): usuário existe e está ativo ───────────────────────────
create or replace function public.is_active(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and ativo = true
  );
$$;
revoke all on function public.is_active(uuid) from public, anon;
grant execute on function public.is_active(uuid) to authenticated, service_role;

-- Gate das tabelas operacionais: um operador desativado deixa de ler/escrever
-- imediatamente (defesa em profundidade — não depende só do logout no front).
-- service_role (edge functions/seed) ignora RLS e não é afetado.
drop policy if exists "authenticated rw apuracao" on public.apuracao;
create policy "active rw apuracao" on public.apuracao
  for all to authenticated
  using (public.is_active((select auth.uid())))
  with check (public.is_active((select auth.uid())));

drop policy if exists "authenticated rw responsavel" on public.responsavel_empresa;
create policy "active rw responsavel" on public.responsavel_empresa
  for all to authenticated
  using (public.is_active((select auth.uid())))
  with check (public.is_active((select auth.uid())));

drop policy if exists "authenticated rw anexos" on public.anexos;
create policy "active rw anexos" on public.anexos
  for all to authenticated
  using (public.is_active((select auth.uid())))
  with check (public.is_active((select auth.uid())));

drop policy if exists "authenticated rw parcelamentos" on public.parcelamentos;
create policy "active rw parcelamentos" on public.parcelamentos
  for all to authenticated
  using (public.is_active((select auth.uid())))
  with check (public.is_active((select auth.uid())));

-- ── 3) parcelamentos: integridade dos números ────────────────────────────
alter table public.parcelamentos drop constraint if exists parcelamentos_valor_total_chk;
alter table public.parcelamentos drop constraint if exists parcelamentos_valor_parcela_chk;
alter table public.parcelamentos drop constraint if exists parcelamentos_qtd_chk;
alter table public.parcelamentos drop constraint if exists parcelamentos_pagas_le_qtd_chk;

alter table public.parcelamentos
  add constraint parcelamentos_valor_total_chk   check (valor_total  >= 0),
  add constraint parcelamentos_valor_parcela_chk check (valor_parcela >= 0),
  add constraint parcelamentos_qtd_chk           check (qtd_parcelas  >= 0),
  add constraint parcelamentos_pagas_le_qtd_chk  check (parcelas_pagas <= qtd_parcelas);

-- ── 4) profile_guard: permitir o contexto de servidor (service_role) ──────
-- A edge function admin-users (set_active) atualiza profiles.ativo com o
-- service_role, onde auth.uid() é NULL. O guard original revertia role/ativo
-- sempre que is_admin(auth.uid()) fosse falso — incluindo esse caso — anulando
-- a ativação/desativação. auth.uid() nulo só ocorre em contexto de servidor
-- (anon não passa pela policy de UPDATE de profiles), que já é confiável.
create or replace function public.profile_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    new.role  := old.role;
    new.ativo := old.ativo;
  end if;
  return new;
end;
$$;
revoke all on function public.profile_guard() from public, anon, authenticated;
