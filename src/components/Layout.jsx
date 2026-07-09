import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../hooks/usePresence'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { corAvatar, iniciais } from '../lib/constants'
import OnlineUsers from './OnlineUsers'

export default function Layout() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const online = usePresence(user, profile)
  const { count: naoLidas } = useUnreadCount(user?.id)

  const nome = profile?.nome || user?.email || ''

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <header className="topo">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <div className="topo-titulo">Controle de Apuração Mensal</div>
            <div className="topo-sub">AM Assessoria e Consultoria Tributária</div>
          </div>
          <nav className="nav">
            <NavLink to="/app/planilha"><span className="nav-ico">📋</span><span className="nav-txt">Planilha</span></NavLink>
            <NavLink to="/app/anexos"><span className="nav-ico">📎</span><span className="nav-txt">Anexos</span></NavLink>
            <NavLink to="/app/parcelamentos"><span className="nav-ico">💰</span><span className="nav-txt">Parcelam.</span></NavLink>
            <NavLink to="/app/notificacoes">
              <span className="nav-ico">🔔</span><span className="nav-txt">Notificações</span>
              {naoLidas > 0 && <span className="nav-badge">{naoLidas > 99 ? '99+' : naoLidas}</span>}
            </NavLink>
            {isAdmin && <NavLink to="/app/dashboard"><span className="nav-ico">📊</span><span className="nav-txt">Dashboard</span></NavLink>}
            {isAdmin && <NavLink to="/app/clientes"><span className="nav-ico">🏢</span><span className="nav-txt">Clientes</span></NavLink>}
            {isAdmin && <NavLink to="/app/auditoria"><span className="nav-ico">🧾</span><span className="nav-txt">Auditoria</span></NavLink>}
            {isAdmin && <NavLink to="/app/usuarios"><span className="nav-ico">👥</span><span className="nav-txt">Usuários</span></NavLink>}
          </nav>
        </div>

        <div className="topo-right">
          <div className="badge-online">AO VIVO</div>
          <OnlineUsers nomes={online} meNome={nome} />
          <div className="usuario-info">
            <div className="avatar sm" style={{ background: corAvatar(nome) }}>
              {iniciais(nome)}
            </div>
            <span className="usuario-nome">{nome}</span>
          </div>
          <button
            className="btn btn-sec"
            style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }}
            onClick={handleSignOut}
          >
            Sair
          </button>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </>
  )
}
