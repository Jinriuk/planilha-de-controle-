export default function Spinner({ full = false, label = 'Carregando...' }) {
  const content = (
    <div className="loading">
      <div className="spinner" />
      <br />
      {label}
    </div>
  )
  if (full) return <div className="full-center">{content}</div>
  return content
}
