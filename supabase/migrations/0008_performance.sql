-- ─────────────────────────────────────────────────────────────────────────
-- 0008_performance.sql — Otimização de RLS e índices (linter de performance)
--
-- Padrão initplan: (select auth.uid()) é avaliado 1x por consulta, não por
-- linha — relevante em audit_log/notifications conforme o volume cresce.
-- Consolida políticas múltiplas da mesma ação e indexa FKs consultadas.
-- ─────────────────────────────────────────────────────────────────────────

-- ── profiles ──
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "admin all profiles" on public.profiles;
drop policy if exists "team read profiles" on public.profiles;

create policy "profiles select" on public.profiles
  for select to authenticated using (true);
create policy "profiles update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin((select auth.uid())))
  with check (id = (select auth.uid()) or public.is_admin((select auth.uid())));
create policy "profiles admin insert" on public.profiles
  for insert to authenticated with check (public.is_admin((select auth.uid())));
create policy "profiles admin delete" on public.profiles
  for delete to authenticated using (public.is_admin((select auth.uid())));

-- ── companies ──
drop policy if exists "authenticated read companies" on public.companies;
drop policy if exists "admin write companies"        on public.companies;

create policy "companies select" on public.companies
  for select to authenticated using (true);
create policy "companies admin insert" on public.companies
  for insert to authenticated with check (public.is_admin((select auth.uid())));
create policy "companies admin update" on public.companies
  for update to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));
create policy "companies admin delete" on public.companies
  for delete to authenticated using (public.is_admin((select auth.uid())));

-- ── audit_log ──
drop policy if exists "admin read audit" on public.audit_log;
create policy "admin read audit" on public.audit_log
  for select to authenticated using (public.is_admin((select auth.uid())));

-- ── notifications ──
drop policy if exists "admin insert notifications"          on public.notifications;
drop policy if exists "read own or broadcast notifications" on public.notifications;
drop policy if exists "admin delete notifications"          on public.notifications;

create policy "admin insert notifications" on public.notifications
  for insert to authenticated with check (public.is_admin((select auth.uid())));
create policy "read own or broadcast notifications" on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()) or recipient_id is null or public.is_admin((select auth.uid())));
create policy "admin delete notifications" on public.notifications
  for delete to authenticated using (public.is_admin((select auth.uid())));

-- ── notification_reads (consolida 2 selects em 1) ──
drop policy if exists "own reads select"     on public.notification_reads;
drop policy if exists "own reads insert"     on public.notification_reads;
drop policy if exists "admin read all reads" on public.notification_reads;

create policy "reads select" on public.notification_reads
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));
create policy "reads insert" on public.notification_reads
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ── presence ──
drop policy if exists "presence read"       on public.presence;
drop policy if exists "presence own write"  on public.presence;
drop policy if exists "presence own update" on public.presence;
drop policy if exists "presence own delete" on public.presence;

create policy "presence read" on public.presence
  for select to authenticated using (true);
create policy "presence own write" on public.presence
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "presence own update" on public.presence
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "presence own delete" on public.presence
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── Índices para FKs consultadas ──
create index if not exists notification_reads_user_idx  on public.notification_reads (user_id);
create index if not exists notifications_sender_idx     on public.notifications (sender_id);
create index if not exists apuracao_updated_by_idx      on public.apuracao (updated_by);
create index if not exists apuracao_responsavel_idx     on public.apuracao (responsavel_id);
create index if not exists anexos_updated_by_idx        on public.anexos (updated_by);
create index if not exists parcelamentos_updated_by_idx on public.parcelamentos (updated_by);
create index if not exists responsavel_user_idx         on public.responsavel_empresa (user_id);
