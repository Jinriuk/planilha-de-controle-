-- ─────────────────────────────────────────────────────────────────────────
-- 0002_functions_triggers.sql — Funções, triggers e Realtime
-- ─────────────────────────────────────────────────────────────────────────

-- ── is_admin(): helper SECURITY DEFINER ───────────────────────────────────
-- Lê o role de profiles IGNORANDO o RLS. Necessário para evitar recursão
-- infinita nas policies de profiles (§13.5: o role que vale é o da tabela
-- própria, não o do JWT).
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin' and ativo = true
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, anon, service_role;

-- ── handle_new_user(): cria profile ao criar auth.users ───────────────────
-- Dispara no cadastro/convite. Cria a linha em profiles com onboarded=false.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, onboarded)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'full_name'),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── profile_guard(): impede escalonamento de privilégio ───────────────────
-- Um operador pode atualizar o próprio profile (onboarding: nome, cargo,
-- onboarded), mas NÃO pode alterar role nem ativo. Apenas admin pode.
create or replace function public.profile_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    new.role  := old.role;
    new.ativo := old.ativo;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_guard on public.profiles;
create trigger trg_profile_guard
  before update on public.profiles
  for each row execute function public.profile_guard();

-- ── log_apuracao_change(): auditoria imutável ─────────────────────────────
-- Toda mudança de valor em apuracao gera uma linha em audit_log (§6.4),
-- inclusive N/A e retorno a vazio. SECURITY DEFINER garante o insert
-- independentemente do RLS.
create or replace function public.log_apuracao_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes text;
  v_nome  text;
begin
  if tg_op = 'INSERT' then
    if new.valor is null or new.valor = '' then
      return new; -- não audita criação vazia
    end if;
    v_antes := null;
  elsif tg_op = 'UPDATE' then
    if new.valor is not distinct from old.valor then
      return new; -- nada mudou
    end if;
    v_antes := old.valor;
  end if;

  select nome into v_nome from public.profiles where id = new.updated_by;

  insert into public.audit_log
    (company_cod, task_key, periodo, valor_antes, valor_depois, user_id, user_nome)
  values
    (new.company_cod, new.task_key, new.periodo, v_antes, new.valor, new.updated_by, v_nome);

  return new;
end;
$$;

drop trigger if exists trg_log_apuracao on public.apuracao;
create trigger trg_log_apuracao
  after insert or update on public.apuracao
  for each row execute function public.log_apuracao_change();

-- ── touch_updated_at(): mantém apuracao.updated_at ────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_apuracao on public.apuracao;
create trigger trg_touch_apuracao
  before update on public.apuracao
  for each row execute function public.touch_updated_at();

-- ── protege audit_log contra UPDATE/DELETE (imutabilidade — §13.4) ────────
create or replace function public.audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log é imutável: operação % não permitida', tg_op;
end;
$$;

drop trigger if exists trg_audit_no_update on public.audit_log;
create trigger trg_audit_no_update
  before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- ── Realtime: publica as tabelas sincronizadas em tempo real (§8.1) ────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.apuracao;
    alter publication supabase_realtime add table public.responsavel_empresa;
    alter publication supabase_realtime add table public.presence;
  end if;
exception
  when duplicate_object then null; -- já publicadas
end $$;
