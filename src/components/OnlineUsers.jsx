import { corAvatar, iniciais } from '../lib/constants'

// Avatares de quem está online, na barra superior (§8.1).
export default function OnlineUsers({ nomes, meNome }) {
  if (!nomes.length) return null
  const visiveis = nomes.slice(0, 5)
  const extra = nomes.length - visiveis.length

  return (
    <div className="online-wrap">
      <div className="online-tooltip">
        <div className="online-avatars">
          {visiveis.map((n) => (
            <div
              key={n}
              className="avatar-mini"
              style={{ background: corAvatar(n) }}
              title={n}
            >
              {iniciais(n)}
            </div>
          ))}
          {extra > 0 && (
            <div className="avatar-mini" style={{ background: '#475569' }}>
              +{extra}
            </div>
          )}
        </div>
        <div className="tip-box">
          <div className="tip-title">QUEM ESTÁ ONLINE</div>
          {nomes.map((n) => (
            <div className="tip-row" key={n}>
              <div className="avatar-mini" style={{ background: corAvatar(n) }}>
                {iniciais(n)}
              </div>
              {n}
              {n === meNome && <span style={{ color: '#94a3b8' }}>(você)</span>}
            </div>
          ))}
        </div>
      </div>
      <span className="online-count">
        {nomes.length === 1 ? `${nomes[0]} online` : `${nomes.length} pessoas online`}
      </span>
    </div>
  )
}
