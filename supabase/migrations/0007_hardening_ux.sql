-- ─────────────────────────────────────────────────────────────────────────
-- 0007_hardening_ux.sql — Identidade forçada no servidor + recibos de leitura
--
-- Todo autor de escrita passa a ser SEMPRE o usuário autenticado (auth.uid()),
-- impedindo que um cliente malicioso atribua ações a outra pessoa via API.
-- Quando executado fora de sessão (service_role/SQL), mantém o valor enviado.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.force_updated_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    select nome into v_nome from public.profiles where id = auth.uid();
    if v_nome is not null then
      new.updated_by_nome := v_nome;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.force_updated_by() from public, anon, authenticated;

drop trigger if exists trg_force_identity_apuracao on public.apuracao;
create trigger trg_force_identity_apuracao
  before insert or update on public.apuracao
  for each row execute function public.force_updated_by();

drop trigger if exists trg_force_identity_anexos on public.anexos;
create trigger trg_force_identity_anexos
  before insert or update on public.anexos
  for each row execute function public.force_updated_by();

drop trigger if exists trg_force_identity_parcelamentos on public.parcelamentos;
create trigger trg_force_identity_parcelamentos
  before insert or update on public.parcelamentos
  for each row execute function public.force_updated_by();

create or replace function public.force_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  if auth.uid() is not null then
    new.sender_id := auth.uid();
    select nome into v_nome from public.profiles where id = auth.uid();
    if v_nome is not null then
      new.sender_nome := v_nome;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.force_sender() from public, anon, authenticated;

drop trigger if exists trg_force_sender_notif on public.notifications;
create trigger trg_force_sender_notif
  before insert on public.notifications
  for each row execute function public.force_sender();

create or replace function public.force_presence_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function public.force_presence_user() from public, anon, authenticated;

drop trigger if exists trg_force_presence on public.presence;
create trigger trg_force_presence
  before insert or update on public.presence
  for each row execute function public.force_presence_user();

-- presence: cada um só escreve na própria linha (defesa em profundidade)
drop policy if exists "authenticated rw presence" on public.presence;
create policy "presence read" on public.presence
  for select to authenticated using (true);
create policy "presence own write" on public.presence
  for insert to authenticated with check (user_id = auth.uid());
create policy "presence own update" on public.presence
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "presence own delete" on public.presence
  for delete to authenticated using (user_id = auth.uid());

-- notification_reads: leitura marcada sempre pelo próprio usuário
create or replace function public.force_read_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function public.force_read_user() from public, anon, authenticated;

drop trigger if exists trg_force_read_user on public.notification_reads;
create trigger trg_force_read_user
  before insert on public.notification_reads
  for each row execute function public.force_read_user();

-- Admin enxerga confirmações de leitura (recibo nas notificações enviadas)
drop policy if exists "admin read all reads" on public.notification_reads;
create policy "admin read all reads" on public.notification_reads
  for select to authenticated using (public.is_admin(auth.uid()));
