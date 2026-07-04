-- ─────────────────────────────────────────────────────────────────────────
-- 0003_rls.sql — Row Level Security (§5)
-- RLS habilitado em TODAS as tabelas. Nenhuma leitura pública.
-- Nota: as policies de admin usam public.is_admin() (SECURITY DEFINER) para
-- evitar recursão infinita no RLS de profiles (§13.5).
-- ─────────────────────────────────────────────────────────────────────────

-- ── profiles ──────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "admin all profiles"  on public.profiles;

-- Cada usuário lê o próprio profile.
create policy "own profile read" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

-- Cada usuário atualiza o próprio profile (onboarding).
-- role/ativo são protegidos pelo trigger profile_guard.
create policy "own profile update" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admin lê/escreve todos.
create policy "admin all profiles" on public.profiles
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ── companies ─────────────────────────────────────────────────────────────
alter table public.companies enable row level security;

drop policy if exists "authenticated read companies" on public.companies;
drop policy if exists "admin write companies"        on public.companies;

create policy "authenticated read companies" on public.companies
  for select to authenticated
  using (true);

create policy "admin write companies" on public.companies
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ── apuracao ──────────────────────────────────────────────────────────────
alter table public.apuracao enable row level security;

drop policy if exists "authenticated rw apuracao" on public.apuracao;

create policy "authenticated rw apuracao" on public.apuracao
  for all to authenticated
  using (true)
  with check (true);

-- ── responsavel_empresa ───────────────────────────────────────────────────
alter table public.responsavel_empresa enable row level security;

drop policy if exists "authenticated rw responsavel" on public.responsavel_empresa;

create policy "authenticated rw responsavel" on public.responsavel_empresa
  for all to authenticated
  using (true)
  with check (true);

-- ── audit_log ─────────────────────────────────────────────────────────────
-- Todos autenticados inserem; só admin lê. UPDATE/DELETE bloqueados por
-- trigger (imutável). Operadores nunca leem (§13.4).
alter table public.audit_log enable row level security;

drop policy if exists "authenticated insert audit" on public.audit_log;
drop policy if exists "admin read audit"           on public.audit_log;

create policy "authenticated insert audit" on public.audit_log
  for insert to authenticated
  with check (true);

create policy "admin read audit" on public.audit_log
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- ── presence ──────────────────────────────────────────────────────────────
alter table public.presence enable row level security;

drop policy if exists "authenticated rw presence" on public.presence;

create policy "authenticated rw presence" on public.presence
  for all to authenticated
  using (true)
  with check (true);
