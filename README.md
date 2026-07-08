# Controle de Apuração Contábil — AM Assessoria

App web para controle da apuração mensal de um escritório contábil.
Substitui o HTML standalone (`controle_apuracao_online.html`) por um app real com
backend no Supabase.

**Stack:** React + Vite · Supabase (Auth + Postgres + RLS + Realtime + Edge Functions) · Vercel

---

## 1. O que já está pronto

| Camada | Onde |
|---|---|
| Frontend React/Vite | `src/` |
| Migrations SQL (schema, triggers, RLS) | `supabase/migrations/` |
| Seed das 168 empresas | `supabase/seed.sql` (gerado por `scripts/generate-seed.mjs`) |
| Edge Function de convite | `supabase/functions/invite-user/` |
| Config de deploy | `vercel.json` |

Funcionalidades implementadas (checklist do §14 do spec):

- Auth por convite → onboarding (nome + cargo + senha) → redirect por papel
- `/app/planilha`: tabela com ciclo de estados, responsável automático, progresso,
  filtros, export CSV, **sync em tempo real** (Realtime + polling de fallback) e presença online
- Audit log gravando **toda** mudança (via trigger no banco — imutável)
- `/app/auditoria`: cards de resumo + registro de mudanças (com filtros e paginação 50/pág) + abas Por Operador / Por Empresa
- `/app/usuarios`: lista + convite + alterar papel + ativar/desativar
- RLS habilitado em todas as tabelas, com papéis `admin` / `operator`

---

## 2. Pré-requisitos

- Node 18+ (testado no 22)
- Conta Supabase (projeto na região **South America / São Paulo**)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para aplicar migrations e deploy da function)
- Conta Vercel (deploy do frontend)

---

## 3. Rodar localmente

```bash
npm install
cp .env.example .env      # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:5173
```

As chaves ficam em **Supabase → Project Settings → API**
(`Project URL` e a chave `anon` / `publishable`).

---

## 4. Banco de dados (Supabase)

### 4.1 Aplicar o schema

Com a Supabase CLI, já logado e com o projeto linkado (`supabase link`):

```bash
# aplica 0001_schema, 0002_functions_triggers, 0003_rls (nessa ordem)
supabase db push
```

> Alternativa sem CLI: copie o conteúdo de cada arquivo em
> `supabase/migrations/*.sql` (na ordem `0001 → 0002 → 0003`) e cole no
> **SQL Editor** do dashboard, executando um de cada vez.

### 4.2 Popular as empresas (seed)

O arquivo `supabase/seed.sql` já vem gerado (168 empresas, 161 ativas, 7 "SAIU").

```bash
# regenerar a partir do array COMPANIES, se necessário:
npm run seed:gen
```

Aplicar o seed no projeto remoto (uma vez) — escolha um caminho:

```bash
# via psql (pegue a connection string em Project Settings → Database):
psql "postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres" -f supabase/seed.sql
```

> Sem psql: abra `supabase/seed.sql`, copie tudo e cole no **SQL Editor** do
> dashboard. Localmente, `supabase db reset` também aplica o seed automaticamente.

> Os campos `cnpj`, `regime`, `municipio`, `uf` ficam `NULL` — complemente-os a
> partir do XLSX (`LISTA_EMPRESAS_ATUALIZADA_062026.xlsx`) quando quiser.

### 4.3 Realtime

A migration `0002` já adiciona `apuracao`, `responsavel_empresa` e `presence` à
publicação `supabase_realtime`. Se o Realtime estiver desligado no projeto, o app
continua funcionando via **polling a cada 20s** (planilha) e 10s (presença).

---

## 5. Edge Functions (`invite-user` e `admin-users`)

As duas usam a `service_role key`, que **nunca** pode ir para o frontend (§13.2).
Por isso rodam em Edge Functions que validam se quem chama é admin.

- `invite-user` — convite por e-mail.
- `admin-users` — criar operador com senha, resetar senha e
  ativar/desativar acesso (`set_active`, que **bane/desbane no Auth** para
  revogar os tokens de quem foi desativado).

```bash
# secrets (a URL e a anon key já são injetadas pelo runtime; defina a service role):
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<sua_service_role_key>

# opcional: para onde o link de convite redireciona (recomendado apontar p/ /onboarding)
supabase secrets set INVITE_REDIRECT_TO=https://SEU-APP.vercel.app/onboarding

# deploy das duas functions
supabase functions deploy invite-user
supabase functions deploy admin-users
```

Configure também, em **Authentication → URL Configuration**, a *Site URL* e as
*Redirect URLs* do seu domínio Vercel (ex.: `https://SEU-APP.vercel.app` e
`https://SEU-APP.vercel.app/onboarding`), senão o link do convite não volta pro app.

---

## 6. Criar o primeiro admin

O trigger `handle_new_user` cria todo mundo como `operator`. Para ter o primeiro
administrador:

1. Crie o usuário em **Authentication → Users → Add user** (ou convide a si mesmo).
2. Aceite o convite / faça login e conclua o onboarding (define a senha).
3. No **SQL Editor**, promova o usuário:

```sql
update public.profiles
set role = 'admin', onboarded = true
where email = 'seu-email@escritorio.com';
```

A partir daí esse admin convida os demais pela tela **Usuários**.

---

## 7. Deploy no Vercel

1. Importe o repositório no Vercel (framework detectado: **Vite**).
2. Em **Settings → Environment Variables**, defina:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy. O `vercel.json` já cuida do rewrite de SPA (todas as rotas → `index.html`).

> Nunca configure `SUPABASE_SERVICE_ROLE_KEY` no Vercel do frontend — ela vive
> apenas nos *secrets* da Edge Function.

---

## 8. Papéis e permissões

| Papel | Acesso |
|---|---|
| `admin` | Planilha + Auditoria + Usuários; leitura/escrita geral; gestão de usuários |
| `operator` | Apenas a planilha operacional (iniciar/avançar/desmarcar tarefas) |

O papel que vale é o da tabela `profiles` (não o do JWT) — as policies usam a
função `is_admin()` (SECURITY DEFINER) para evitar recursão no RLS (§13.5).

---

## 9. Regras da planilha (resumo)

- **Ciclo da célula:** `vazio → andamento → feito → N/A → vazio` (clique cíclico).
- **Responsável:** definido para quem gera a primeira atividade da empresa no
  período; é **limpo** quando **todas** as tarefas da empresa voltam a vazio
  (consistente com §8.1). O primeiro responsável não é sobrescrito enquanto houver atividade.
- **Aplicabilidade das tarefas:** depende de `tipo`, `iss`, `icms`, `sf`, `sc`
  (ver `src/lib/constants.js`). Tarefas não aplicáveis aparecem esmaecidas, mas
  podem ser preenchidas mesmo assim.
- **Auditoria:** cada mudança de valor grava uma linha imutável em `audit_log`
  (inclusive N/A e retorno a vazio), via trigger no banco.

---

## 10. Estrutura do projeto

```
├── index.html                     # entry do Vite
├── vercel.json                    # rewrite SPA
├── scripts/generate-seed.mjs      # gera supabase/seed.sql
├── supabase/
│   ├── migrations/
│   │   ├── 0001_schema.sql .. 0008_performance.sql
│   │   └── 0009_hardening_prod.sql   # auditoria imutável, is_active, checks
│   ├── seed.sql
│   └── functions/{invite-user,admin-users}/index.ts
└── src/
    ├── main.jsx / App.jsx          # bootstrap + rotas
    ├── index.css                   # estilos globais (portados do HTML)
    ├── lib/{supabase.js,constants.js}
    ├── context/AuthContext.jsx
    ├── hooks/usePresence.js
    ├── components/                 # Layout, rotas protegidas, Toast, etc.
    └── pages/                      # Login, Onboarding, Planilha, Auditoria, Usuarios
```

---

## 11. Notas / desvios em relação ao spec

- Adicionadas duas colunas úteis não previstas explicitamente:
  `profiles.ativo` (para desativar login, citado no §8.3) e
  `apuracao.updated_by_nome` (snapshot do nome para o tooltip da célula, já que o
  RLS de `profiles` impede um operador de ler o nome de outro).
- O onboarding também define a **senha** (o convite cria o usuário sem senha; sem
  esse passo o operador não conseguiria logar depois).
- Limpeza do responsável segue a regra do §8.1 ("todas as tarefas voltam a vazio"),
  ligeiramente diferente da leitura literal do §6.3, para não apagar o responsável
  enquanto ainda há tarefas ativas.

---

## 12. Checklist de produção

Endurecimentos já aplicados (migration `0009_hardening_prod.sql`):

- **Auditoria à prova de forjaria:** removida a policy que deixava qualquer
  autenticado inserir linhas em `audit_log`. A trilha só é escrita pelo trigger
  (imutável).
- **Desativar usuário tem efeito imediato:** as tabelas operacionais
  (`apuracao`, `anexos`, `parcelamentos`, `responsavel_empresa`) exigem
  `is_active()`; um operador desativado perde leitura/escrita na hora, mesmo com
  o token ainda válido. A tela Usuários também **revoga os tokens** no Auth.
- **Integridade de parcelamentos:** checks de valores não-negativos e
  `parcelas_pagas ≤ qtd_parcelas`.

Passo manual recomendado (Dashboard do Supabase, não vai no código):

- **Authentication → Providers → Password:** ligue *Leaked password protection*
  (checagem no HaveIBeenPwned) e, se quiser, um comprimento mínimo de senha
  maior que 6.

Por design (modelo de confiança "todo autenticado é da equipe"): operadores
ativos podem editar planilha, anexos e parcelamentos. As leituras grandes
(planilha/dashboard/auditoria) são **paginadas** no cliente, então não sofrem o
corte de 1000 linhas do PostgREST conforme o volume cresce.
