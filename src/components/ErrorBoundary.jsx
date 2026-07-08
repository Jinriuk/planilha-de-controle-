import { Component } from 'react'

// Captura erros de renderização para não deixar a SPA em tela branca (§produção).
// Sem isso, qualquer exceção durante o render derruba a árvore inteira do React.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Log no console para diagnóstico; em produção pode ser enviado a um serviço.
    console.error('ErrorBoundary capturou:', error, info?.componentStack)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="full-center">
          <div className="auth-card" style={{ textAlign: 'center', maxWidth: 460 }}>
            <div className="auth-logo">Ops, algo deu errado</div>
            <p className="hint" style={{ margin: '12px 0 18px' }}>
              A tela encontrou um erro inesperado. Seus dados estão salvos — basta
              recarregar para continuar. Se o problema persistir, avise o administrador.
            </p>
            <button className="btn btn-prim btn-block" onClick={this.handleReload}>
              Recarregar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
