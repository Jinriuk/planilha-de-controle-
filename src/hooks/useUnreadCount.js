import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const POLL_MS = 15_000

// Conta notificações não lidas endereçadas ao usuário (destinatário = eu ou
// broadcast), excluindo as que ele mesmo enviou. Faz polling + expõe refresh().
export function useUnreadCount(userId) {
  const [count, setCount] = useState(0)
  const bump = useRef(0)

  const refresh = useCallback(async () => {
    if (!userId) return
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      supabase
        .from('notifications')
        .select('id')
        .or(`recipient_id.eq.${userId},recipient_id.is.null`)
        .neq('sender_id', userId),
      supabase.from('notification_reads').select('notification_id').eq('user_id', userId),
    ])
    const lidas = new Set((reads || []).map((r) => r.notification_id))
    setCount((notifs || []).filter((n) => !lidas.has(n.id)).length)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    refresh()
    const t = setInterval(refresh, POLL_MS)

    // realtime: nova notificação -> re-checa na hora
    const canal = supabase
      .channel('notif-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        clearTimeout(bump.current)
        bump.current = setTimeout(refresh, 300)
      })
      .subscribe()

    return () => {
      clearInterval(t)
      supabase.removeChannel(canal)
    }
  }, [userId, refresh])

  return { count, refresh }
}
