-- ─────────────────────────────────────────────────────────────────────────
-- 0001_schema.sql — Tabelas, colunas e índices
-- Controle de Apuração Contábil — AM Assessoria
-- ─────────────────────────────────────────────────────────────────────────

-- ── profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  nome        text,
  cargo       text,
  role        text not null default 'operator', -- 'admin' | 'operator'
  onboarded   boolean not null default false,
  ativo       boolean not null default true,    -- false = login bloqueado (§8.3)
  created_at  timestamptz not null default now(),
  constraint profiles_role_chk check (role in ('admin', 'operator'))
);

-- ── companies ─────────────────────────────────────────────────────────────
create table if not exists public.companies (
  cod         text primary key,       -- Cód. Domínio da planilha
  empresa     text not null,
  cnpj        text,
  grupo       text,
  tipo        text,                    -- 'Serviços' | 'Comércio' | 'Comércio / Serviços'
  regime      text,
  municipio   text,
  uf          text,
  iss         boolean not null default false,
  icms        boolean not null default false,
  sf          boolean not null default false, -- Sped Fiscal
  sc          boolean not null default false, -- Sped Contribuições
  resp_padrao text,                    -- responsável padrão (planilha original)
  ativo       boolean not null default true,  -- false = "SAIU"
  created_at  timestamptz not null default now()
);

-- ── apuracao ──────────────────────────────────────────────────────────────
-- Uma linha por (company_cod, task_key, periodo).
create table if not exists public.apuracao (
  id           uuid primary key default gen_random_uuid(),
  company_cod  text not null references public.companies(cod) on delete cascade,
  task_key     text not null,          -- ex: 'nfe_ent', 'iss_g', ...
  periodo      text not null,          -- 'YYYY-MM'
  valor        text not null default '', -- '' | 'andamento' | 'feito' | 'na'
  updated_by   uuid references public.profiles(id),
  updated_by_nome text,                  -- snapshot p/ tooltip (RLS de profiles restringe leitura)
  updated_at   timestamptz not null default now(),
  unique (company_cod, task_key, periodo),
  constraint apuracao_valor_chk check (valor in ('', 'andamento', 'feito', 'na'))
);

-- ── responsavel_empresa ───────────────────────────────────────────────────
-- Quem iniciou a primeira tarefa de uma empresa em um período.
create table if not exists public.responsavel_empresa (
  company_cod  text not null references public.companies(cod) on delete cascade,
  periodo      text not null,
  user_id      uuid references public.profiles(id),
  user_nome    text,                   -- snapshot do nome no momento
  started_at   timestamptz not null default now(),
  primary key (company_cod, periodo)
);

-- ── audit_log ─────────────────────────────────────────────────────────────
-- Registro imutável de toda mudança de estado (§6.4).
create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  company_cod  text not null,
  task_key     text not null,
  periodo      text not null,
  valor_antes  text,
  valor_depois text,
  user_id      uuid references public.profiles(id),
  user_nome    text,                   -- snapshot do nome no momento da ação
  ts           timestamptz not null default now(),
  ip           text                    -- opcional (via Edge Function)
);

-- ── presence ──────────────────────────────────────────────────────────────
-- Presença online simples (§9). Alternativa sem Realtime Presence.
create table if not exists public.presence (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  user_nome  text,
  last_seen  timestamptz not null default now()
);

-- ── Índices obrigatórios (§4.6) ───────────────────────────────────────────
create index if not exists apuracao_periodo_company_idx on public.apuracao (periodo, company_cod);
create index if not exists audit_log_ts_idx             on public.audit_log (ts desc);
create index if not exists audit_log_company_periodo_idx on public.audit_log (company_cod, periodo);
create index if not exists audit_log_user_idx           on public.audit_log (user_id);
create index if not exists responsavel_periodo_idx      on public.responsavel_empresa (periodo);
