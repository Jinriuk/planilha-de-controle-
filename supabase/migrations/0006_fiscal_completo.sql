-- ─────────────────────────────────────────────────────────────────────────
-- 0006_fiscal_completo.sql — Controle Operacional completo, Anexos e
-- Parcelamentos (spec Departamento Fiscal)
-- ─────────────────────────────────────────────────────────────────────────

-- ── apuracao: campos por atividade (responsável, prazo, conclusão, obs) ──
alter table public.apuracao add column if not exists responsavel_id   uuid references public.profiles(id);
alter table public.apuracao add column if not exists responsavel_nome text;
alter table public.apuracao add column if not exists prazo            date;
alter table public.apuracao add column if not exists data_conclusao   date;
alter table public.apuracao add column if not exists observacoes      text;

-- ── profiles: time inteiro pode ler (necessário p/ seleção de responsável,
--    dashboards por colaborador e notificações). Escrita continua restrita. ──
drop policy if exists "team read profiles" on public.profiles;
create policy "team read profiles" on public.profiles
  for select to authenticated using (true);

-- ── anexos: controle de documentos anexados por cliente/competência ──
create table if not exists public.anexos (
  id             uuid primary key default gen_random_uuid(),
  company_cod    text not null references public.companies(cod) on delete cascade,
  periodo        text not null,           -- 'YYYY-MM'
  doc_key        text not null,           -- ex: 'guia_iss', 'rec_efd_f'
  status         text not null default '',-- '' | andamento | feito | na
  link           text,                    -- URL rede/OneDrive/Drive
  observacoes    text,
  updated_by     uuid references public.profiles(id),
  updated_by_nome text,
  updated_at     timestamptz not null default now(),
  unique (company_cod, doc_key, periodo),
  constraint anexos_status_chk check (status in ('', 'andamento', 'feito', 'na'))
);
create index if not exists anexos_periodo_idx on public.anexos (periodo, company_cod);

alter table public.anexos enable row level security;
drop policy if exists "authenticated rw anexos" on public.anexos;
create policy "authenticated rw anexos" on public.anexos
  for all to authenticated using (true) with check (true);

-- ── parcelamentos: gestão de parcelamentos fiscais ──
create table if not exists public.parcelamentos (
  id                 uuid primary key default gen_random_uuid(),
  company_cod        text not null references public.companies(cod) on delete cascade,
  orgao              text,                -- ex: RFB, SEFAZ-RJ, Município
  tipo_debito        text,
  valor_total        numeric(14,2) not null default 0,
  qtd_parcelas       integer       not null default 0,
  valor_parcela      numeric(14,2) not null default 0,
  parcelas_pagas     integer       not null default 0,
  proximo_vencimento date,
  status             text not null default 'ativo', -- ativo|quitado|suspenso|cancelado
  link_guias         text,
  observacoes        text,
  updated_by         uuid references public.profiles(id),
  updated_by_nome    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint parcelamentos_status_chk check (status in ('ativo','quitado','suspenso','cancelado')),
  constraint parcelamentos_pagas_chk check (parcelas_pagas >= 0)
);
create index if not exists parcelamentos_company_idx on public.parcelamentos (company_cod);
create index if not exists parcelamentos_venc_idx    on public.parcelamentos (proximo_vencimento);

alter table public.parcelamentos enable row level security;
drop policy if exists "authenticated rw parcelamentos" on public.parcelamentos;
create policy "authenticated rw parcelamentos" on public.parcelamentos
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_touch_anexos on public.anexos;
create trigger trg_touch_anexos
  before update on public.anexos
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_parcelamentos on public.parcelamentos;
create trigger trg_touch_parcelamentos
  before update on public.parcelamentos
  for each row execute function public.touch_updated_at();

-- ── Realtime ──
do $$
begin
  alter publication supabase_realtime add table public.anexos;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.parcelamentos;
exception when duplicate_object then null;
end $$;
