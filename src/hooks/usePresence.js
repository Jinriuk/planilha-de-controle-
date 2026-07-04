import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const HEARTBEAT_MS = 10_000 // frequência do upsert
const ONLINE_WINDOW_MS = 30_000 // "online" = visto há < 30s (§9)

// Presença online via tabela `presence` (§9): upsert periódico + polling.
// Retorna a lista de nomes online (inclui o próprio usuário).
export function usePresence(user, profile) {
  const [online, setOnline] = useState([])
  const nomeRef = useRef('')

  useEffect(() => {
    if (!user?.id) return
    const nome = profile?.nome || user.email
    nomeRef.current = nome
    let active = true

    async function heartbeat() {
      await supabase
        .from('presence')
        .upsert(
          { user_id: user.id, user_nome: nome, last_seen: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
    }

    async function poll() {
      const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()
      const { data } = await supabase
        .from('presence')
        .select('user_nome, last_seen')
        .gte('last_seen', since)
        .order('user_nome', { ascending: true })
      if (!active) return
      const nomes = (data || []).map((r) => r.user_nome).filter(Boolean)
      if (!nomes.includes(nome)) nomes.push(nome)
      setOnline([...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR')))
    }

    heartbeat()
    poll()
    const hb = setInterval(heartbeat, HEARTBEAT_MS)
    const pl = setInterval(poll, HEARTBEAT_MS)

    const onUnload = () => {
      // best-effort: remove presença ao sair
      navigator.sendBeacon &&
        supabase
          .from('presence')
          .delete()
          .eq('user_id', user.id)
          .then(() => {})
    }
    window.addEventListener('beforeunload', onUnload)

    return () => {
      active = false
      clearInterval(hb)
      clearInterval(pl)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [user?.id, profile?.nome])

  return online
}
