// Cálculos automáticos de parcelamentos (módulo puro — usado no app e no relatório).
import { hojeISO, localISO } from './constants.js'

export function calcParcelamento(p) {
  const qtd = Number(p.qtd_parcelas) || 0
  const pagas = Math.min(Number(p.parcelas_pagas) || 0, qtd)
  const valorParcela = Number(p.valor_parcela) || 0
  const valorTotal = Number(p.valor_total) || 0
  const pendentes = Math.max(qtd - pagas, 0)
  const valorPago = pagas * valorParcela
  // Saldo devedor = dívida total − valor pago (reconcilia com a "Dívida" exibida:
  // pago + saldo = valorTotal). Cai para o cálculo por parcela quando o total não
  // foi informado.
  const saldo = valorTotal > 0
    ? Math.max(valorTotal - valorPago, 0)
    : Math.max(pendentes * valorParcela, 0)
  const pct = qtd > 0 ? Math.round((pagas / qtd) * 100) : 0
  return { pendentes, valorPago, saldo, pct, pagas, qtd, valorParcela, valorTotal }
}

export function vencimentoProximo(p, dias = 7) {
  if (!p.proximo_vencimento || p.status !== 'ativo') return false
  const lim = localISO(new Date(Date.now() + dias * 86400000))
  return p.proximo_vencimento >= hojeISO() && p.proximo_vencimento <= lim
}

export function vencimentoAtrasado(p) {
  if (!p.proximo_vencimento || p.status !== 'ativo') return false
  return p.proximo_vencimento < hojeISO()
}
