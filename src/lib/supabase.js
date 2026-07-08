import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Falha cedo e com mensagem clara em vez de erro obscuro de rede.
  throw new Error(
    'Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env ' +
      '(copie de .env.example). Veja o README §3.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // captura o token do link de convite
    // 'implicit' (e não 'pkce'): o convite por e-mail (inviteUserByEmail) é
    // iniciado no servidor, então o navegador do convidado não tem o
    // code_verifier do PKCE — com PKCE o link do convite nunca troca por sessão
    // e o operador jamais consegue entrar. No fluxo implícito os tokens vêm no
    // hash da URL e detectSessionInUrl os captura. Login por senha não usa flow.
    flowType: 'implicit',
  },
})

// PostgREST limita o número de linhas por requisição (db-max-rows; padrão comum
// de 1000 no Supabase). Tabelas como apuracao (até 168×17 ≈ 2856 linhas/período)
// e anexos (168×13) estouram esse teto, o que truncava silenciosamente a leitura
// — escondendo/zerando status e, pior, permitindo sobrescrever dados reais que
// não haviam sido carregados. Este helper pagina com .range() até esgotar.
const PAGE = 1000

export async function fetchAllRows(build, pageSize = PAGE) {
  const out = []
  let from = 0
  for (;;) {
    const { data, error } = await build(supabase).range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    const chunk = data || []
    out.push(...chunk)
    // Avança pelo tamanho REAL da página e só para quando vier página vazia.
    // Uma página curta pode ser o teto do servidor (db-max-rows menor que
    // pageSize), não o fim dos dados — parar nela truncaria silenciosamente.
    // Custo: 1 requisição vazia final. Robusto a qualquer db-max-rows.
    if (chunk.length === 0) break
    from += chunk.length
  }
  return { data: out, error: null }
}
