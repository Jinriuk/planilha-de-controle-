import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../hooks/usePresence'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { corAvatar, iniciais } from '../lib/constants'
import OnlineUsers from './OnlineUsers'

// className como função para manter o "active" automático do NavLink
const navSec = ({ isActive }) => `nav-sec${isActive ? ' active' : ''}`
const sheetItem = ({ isActive }) => (isActive ? 'active' : '')

export default function Layout() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const online = usePresence(user, profile)
  const { count: naoLidas } = useUnreadCount(user?.id)
  // Menu "Mais" (mobile): telas de admin ficam numa folha inferior
  const [maisAberto, setMaisAberto] = useState(false)

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
            {isAdmin && <NavLink className={navSec} to="/app/dashboard"><span className="nav-ico">📊</span><span className="nav-txt">Dashboard</span></NavLink>}
            {isAdmin && <NavLink className={navSec} to="/app/clientes"><span className="nav-ico">🏢</span><span className="nav-txt">Clientes</span></NavLink>}
            {isAdmin && <NavLink className={navSec} to="/app/auditoria"><span className="nav-ico">🧾</span><span className="nav-txt">Auditoria</span></NavLink>}
            {isAdmin && <NavLink className={navSec} to="/app/usuarios"><span className="nav-ico">👥</span><span className="nav-txt">Usuários</span></NavLink>}
            {isAdmin && (
              <button type="button" className="nav-mais" onClick={() => setMaisAberto(true)}>
                <span className="nav-ico">☰</span><span className="nav-txt">Mais</span>
              </button>
            )}
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

      {maisAberto && (
        <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMaisAberto(false) }}>
          <div className="sheet">
            <div className="sheet-handle" />
            <NavLink className={sheetItem} to="/app/dashboard" onClick={() => setMaisAberto(false)}>
              <span className="nav-ico">📊</span> Dashboard
            </NavLink>
            <NavLink className={sheetItem} to="/app/clientes" onClick={() => setMaisAberto(false)}>
              <span className="nav-ico">🏢</span> Clientes
            </NavLink>
            <NavLink className={sheetItem} to="/app/auditoria" onClick={() => setMaisAberto(false)}>
              <span className="nav-ico">🧾</span> Auditoria
            </NavLink>
            <NavLink className={sheetItem} to="/app/usuarios" onClick={() => setMaisAberto(false)}>
              <span className="nav-ico">👥</span> Usuários
            </NavLink>
          </div>
        </div>
      )}

      <main>
        <Outlet />
      </main>
    </>
  )
}
