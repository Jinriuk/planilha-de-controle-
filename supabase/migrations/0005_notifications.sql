-- ─────────────────────────────────────────────────────────────────────────
-- 0005_notifications.sql — Notificações (admin → operador(es))
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id           bigint generated always as identity primary key,
  sender_id    uuid references public.profiles(id),
  sender_nome  text,
  recipient_id uuid references public.profiles(id), -- null = todos (broadcast)
  titulo       text,
  mensagem     text not null,
  tipo         text not null default 'mensagem',    -- 'mensagem' | 'tarefa'
  created_at   timestamptz not null default now(),
  constraint notifications_tipo_chk check (tipo in ('mensagem', 'tarefa'))
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_created_idx    on public.notifications (created_at desc);

create table if not exists public.notification_reads (
  notification_id bigint not null references public.notifications(id) on delete cascade,
  user_id         uuid   not null references public.profiles(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- ── RLS ──
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

drop policy if exists "admin insert notifications"        on public.notifications;
drop policy if exists "read own or broadcast notifications" on public.notifications;
drop policy if exists "admin delete notifications"        on public.notifications;

-- Só admin envia.
create policy "admin insert notifications" on public.notifications
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

-- Cada um lê as suas (destinatário = eu OU broadcast); admin lê todas.
create policy "read own or broadcast notifications" on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid() or recipient_id is null or public.is_admin(auth.uid()));

-- Só admin apaga.
create policy "admin delete notifications" on public.notifications
  for delete to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "own reads select" on public.notification_reads;
drop policy if exists "own reads insert" on public.notification_reads;

create policy "own reads select" on public.notification_reads
  for select to authenticated
  using (user_id = auth.uid());

create policy "own reads insert" on public.notification_reads
  for insert to authenticated
  with check (user_id = auth.uid());

-- ── Realtime ──
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
