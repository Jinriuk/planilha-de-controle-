-- ─────────────────────────────────────────────────────────────────────────
-- 0010_delete_admin_only.sql — Exclusão de dados operacionais só por admin
--
-- Achado da auditoria de produção: as policies "for all" (0009) permitiam a
-- qualquer operador ativo APAGAR apuracao/anexos/parcelamentos — ação sem
-- trilha de auditoria nessas tabelas. Operadores seguem com a rotina normal
-- (ler/criar/editar); DELETE passa a exigir papel admin.
-- O app só usa DELETE em parcelamentos (botão Excluir, agora visível só a
-- admins) e em responsavel_empresa (limpeza automática — permanece liberado).
-- ─────────────────────────────────────────────────────────────────────────

-- ── apuracao ──
drop policy if exists "active rw apuracao" on public.apuracao;
create policy "active select apuracao" on public.apuracao
  for select to authenticated
  using (public.is_active((select auth.uid())));
create policy "active insert apuracao" on public.apuracao
  for insert to authenticated
  with check (public.is_active((select auth.uid())));
create policy "active update apuracao" on public.apuracao
  for update to authenticated
  using (public.is_active((select auth.uid())))
  with check (public.is_active((select auth.uid())));
create policy "admin delete apuracao" on public.apuracao
  for delete to authenticated
  using (public.is_active((select auth.uid())) and public.is_admin((select auth.uid())));

-- ── anexos ──
drop policy if exists "active rw anexos" on public.anexos;
create policy "active select anexos" on public.anexos
  for select to authenticated
  using (public.is_active((select auth.uid())));
create policy "active insert anexos" on public.anexos
  for insert to authenticated
  with check (public.is_active((select auth.uid())));
create policy "active update anexos" on public.anexos
  for update to authenticated
  using (public.is_active((select auth.uid())))
  with check (public.is_active((select auth.uid())));
create policy "admin delete anexos" on public.anexos
  for delete to authenticated
  using (public.is_active((select auth.uid())) and public.is_admin((select auth.uid())));

-- ── parcelamentos ──
drop policy if exists "active rw parcelamentos" on public.parcelamentos;
create policy "active select parcelamentos" on public.parcelamentos
  for select to authenticated
  using (public.is_active((select auth.uid())));
create policy "active insert parcelamentos" on public.parcelamentos
  for insert to authenticated
  with check (public.is_active((select auth.uid())));
create policy "active update parcelamentos" on public.parcelamentos
  for update to authenticated
  using (public.is_active((select auth.uid())))
  with check (public.is_active((select auth.uid())));
create policy "admin delete parcelamentos" on public.parcelamentos
  for delete to authenticated
  using (public.is_active((select auth.uid())) and public.is_admin((select auth.uid())));
