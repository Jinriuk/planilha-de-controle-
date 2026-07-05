import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import Spinner from '../components/Spinner'
import {
  PARC_STATUS, PARC_STATUS_LABEL, PARC_STATUS_CLS,
  fmtMoeda, fmtData,
} from '../lib/constants'
import { calcParcelamento, vencimentoProximo, vencimentoAtrasado } from '../lib/parc'

export default function Parcelamentos() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const nome = profile?.nome || user?.email || ''

  const [companies, setCompanies] = useState([])
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [modal, setModal] = useState(null) // null | 'novo' | parcelamento

  useEffect(() => {
    supabase.from('companies').select('cod, empresa, ativo').then(({ data }) => {
      setCompanies((data || []).sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR')))
    })
  }, [])

  const carregar = useCallback(async (spin = false) => {
    if (spin) setLoading(true)
    const { data } = await supabase
      .from('parcelamentos')
      .select('*')
      .order('proximo_vencimento', { ascending: true, nullsFirst: false })
    setLista(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar(true)
    const canal = supabase
      .channel('parcelamentos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parcelamentos' }, () => carregar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [carregar])

  const empresaNome = useMemo(() => {
    const m = {}
    companies.forEach((c) => { m[c.cod] = c.empresa })
    return m
  }, [companies])

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase()
    return lista.filter((p) => {
      if (fStatus && p.status !== fStatus) return false
      if (q) {
        const emp = (empresaNome[p.company_cod] || '').toLowerCase()
        if (!emp.includes(q) && !(p.orgao || '').toLowerCase().includes(q) && !(p.tipo_debito || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [lista, busca, fStatus, empresaNome])

  const totais = useMemo(() => {
    const ativos = lista.filter((p) => p.status === 'ativo')
    let divida = 0, pago = 0, saldo = 0
    ativos.forEach((p) => {
      const c = calcParcelamento(p)
      divida += c.valorTotal
      pago += c.valorPago
      saldo += c.saldo
    })
    const proximos = ativos.filter((p) => vencimentoProximo(p)).length
    const atrasados = ativos.filter((p) => vencimentoAtrasado(p)).length
    return { ativos: ativos.length, divida, pago, saldo, proximos, atrasados }
  }, [lista])

  async function salvar(form, id) {
    const payload = {
      ...form,
      valor_total: Number(form.valor_total) || 0,
      qtd_parcelas: Number(form.qtd_parcelas) || 0,
      valor_parcela: Number(form.valor_parcela) || 0,
      parcelas_pagas: Number(form.parcelas_pagas) || 0,
      proximo_vencimento: form.proximo_vencimento || null,
      link_guias: form.link_guias?.trim() || null,
      observacoes: form.observacoes?.trim() || null,
      updated_by: user.id,
      updated_by_nome: nome,
    }
    let error
    if (id) ({ error } = await supabase.from('parcelamentos').update(payload).eq('id', id))
    else ({ error } = await supabase.from('parcelamentos').insert(payload))
    if (error) { toast('Erro: ' + error.message); return false }
    toast(id ? 'Parcelamento atualizado!' : 'Parcelamento cadastrado!')
    carregar()
    return true
  }

  async function excluir(p) {
    if (!window.confirm(`Excluir o parcelamento de ${empresaNome[p.company_cod] || p.company_cod} (${p.orgao || 'sem órgão'})?`)) return
    const { error } = await supabase.from('parcelamentos').delete().eq('id', p.id)
    if (error) return toast('Erro: ' + error.message)
    toast('Parcelamento excluído')
    carregar()
  }

  if (loading) return <Spinner full label="Carregando parcelamentos..." />

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="page-title" style={{ margin: 0 }}>Controle de Parcelamentos</div>
        <button className="btn btn-prim" onClick={() => setModal('novo')}>+ Novo parcelamento</button>
      </div>

      <div className="cards">
        <Card label="Parcelamentos ativos" value={totais.ativos} />
        <Card label="Valor total das dívidas" value={fmtMoeda(totais.divida)} small />
        <Card label="Valor total pago" value={fmtMoeda(totais.pago)} small verde />
        <Card label="Saldo devedor" value={fmtMoeda(totais.saldo)} small vermelho />
        <Card label="Vencem em 7 dias" value={totais.proximos} ambar alerta={totais.proximos > 0 ? 'warn' : ''} />
        {totais.atrasados > 0 && <Card label="Vencimento atrasado" value={totais.atrasados} vermelho alerta="err" />}
      </div>

      <div className="barra" style={{ position: 'static', borderRadius: 10, border: '1px solid var(--cinza3)', marginBottom: 12 }}>
        <input className="busca" placeholder="Buscar cliente, órgão ou débito..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Status:</label>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Todos</option>
            {PARC_STATUS.map((s) => <option key={s} value={s}>{PARC_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <button className="btn btn-sec" onClick={() => { setBusca(''); setFStatus('') }}>Limpar</button>
      </div>

      <div className="data-table">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Cliente</th><th>Órgão</th><th>Débito</th>
                <th>Dívida</th><th>Parcelas</th><th>Vlr. parcela</th>
                <th>Pagas</th><th>Pend.</th><th>Saldo devedor</th><th>% quitado</th>
                <th>Próx. venc.</th><th>Status</th><th>Guias</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={14} className="muted" style={{ textAlign: 'center', padding: 24 }}>Nenhum parcelamento cadastrado.</td></tr>
              ) : filtrados.map((p) => {
                const c = calcParcelamento(p)
                const atrasado = vencimentoAtrasado(p)
                const proximo = vencimentoProximo(p)
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={empresaNome[p.company_cod]}>
                      {empresaNome[p.company_cod] || p.company_cod}
                    </td>
                    <td>{p.orgao || '—'}</td>
                    <td>{p.tipo_debito || '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoeda(c.valorTotal)}</td>
                    <td>{c.qtd}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoeda(c.valorParcela)}</td>
                    <td style={{ color: '#15803d', fontWeight: 600 }}>{c.pagas}</td>
                    <td style={{ color: c.pendentes ? '#b45309' : '#15803d', fontWeight: 600 }}>{c.pendentes}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtMoeda(c.saldo)}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>{c.pct}%</span>
                      <div className="prog-bar-bg" style={{ width: 54 }}>
                        <div className="prog-bar-fill" style={{ width: `${c.pct}%`, background: c.pct === 100 ? '#15803d' : '#2E5FA3' }} />
                      </div>
                    </td>
                    <td style={{ color: atrasado ? '#b91c1c' : proximo ? '#b45309' : undefined, fontWeight: atrasado || proximo ? 700 : 400 }}>
                      {atrasado ? '⚠ ' : proximo ? '⏰ ' : ''}{fmtData(p.proximo_vencimento)}
                    </td>
                    <td><span className={`chip ${PARC_STATUS_CLS[p.status]}`}>{PARC_STATUS_LABEL[p.status]}</span></td>
                    <td>{p.link_guias ? <a href={p.link_guias} target="_blank" rel="noreferrer" title={p.link_guias}>🔗</a> : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sec" onClick={() => setModal(p)}>✎ Editar</button>
                        <button className="btn btn-danger" onClick={() => excluir(p)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ParcelamentoModal
          parc={modal === 'novo' ? null : modal}
          companies={companies}
          onClose={() => setModal(null)}
          onSave={async (form, id) => {
            const ok = await salvar(form, id)
            if (ok) setModal(null)
          }}
        />
      )}
    </div>
  )
}

function Card({ label, value, sub, small, verde, vermelho, ambar, alerta }) {
  return (
    <div className={`card${alerta === 'err' ? ' card-alerta' : alerta === 'warn' ? ' card-alerta-warn' : ''}`}>
      <div className="card-label">{label}</div>
      <div className={`card-value${verde ? ' verde' : ''}${vermelho ? ' vermelho' : ''}${ambar ? ' ambar' : ''}`}
        style={small ? { fontSize: 17 } : undefined}>{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  )
}

function ParcelamentoModal({ parc, companies, onClose, onSave }) {
  const [form, setForm] = useState({
    company_cod: parc?.company_cod || '',
    orgao: parc?.orgao || '',
    tipo_debito: parc?.tipo_debito || '',
    valor_total: parc?.valor_total ?? '',
    qtd_parcelas: parc?.qtd_parcelas ?? '',
    valor_parcela: parc?.valor_parcela ?? '',
    parcelas_pagas: parc?.parcelas_pagas ?? 0,
    proximo_vencimento: parc?.proximo_vencimento || '',
    status: parc?.status || 'ativo',
    link_guias: parc?.link_guias || '',
    observacoes: parc?.observacoes || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const prev = calcParcelamento(form)

  async function submit(e) {
    e.preventDefault()
    if (!form.company_cod) return
    setBusy(true)
    await onSave(form, parc?.id)
    setBusy(false)
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal lg" onSubmit={submit} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <h2>{parc ? 'Editar parcelamento' : 'Novo parcelamento'}</h2>
        <p style={{ marginBottom: 14 }}>Pendentes, saldo devedor e % quitado são calculados automaticamente.</p>

        <div className="field">
          <label>Cliente</label>
          <select value={form.company_cod} onChange={set('company_cod')} required>
            <option value="">— selecione —</option>
            {companies.map((c) => <option key={c.cod} value={c.cod}>{c.cod} · {c.empresa}</option>)}
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Órgão</label>
            <input value={form.orgao} onChange={set('orgao')} placeholder="RFB, SEFAZ, Município..." maxLength={60} />
          </div>
          <div className="field">
            <label>Tipo do débito</label>
            <input value={form.tipo_debito} onChange={set('tipo_debito')} placeholder="Simples, ICMS, ISS..." maxLength={60} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Valor total da dívida (R$)</label>
            <input type="number" step="0.01" min="0" value={form.valor_total} onChange={set('valor_total')} required />
          </div>
          <div className="field">
            <label>Qtd. parcelas</label>
            <input type="number" min="1" value={form.qtd_parcelas} onChange={set('qtd_parcelas')} required />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Valor de cada parcela (R$)</label>
            <input type="number" step="0.01" min="0" value={form.valor_parcela} onChange={set('valor_parcela')} required />
          </div>
          <div className="field">
            <label>Parcelas pagas</label>
            <input type="number" min="0" value={form.parcelas_pagas} onChange={set('parcelas_pagas')} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Próximo vencimento</label>
            <input type="date" value={form.proximo_vencimento} onChange={set('proximo_vencimento')} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={set('status')}>
              {PARC_STATUS.map((s) => <option key={s} value={s}>{PARC_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Link das guias (rede, OneDrive, Google Drive)</label>
          <input type="url" value={form.link_guias} onChange={set('link_guias')} placeholder="https://..." />
        </div>
        <div className="field">
          <label>Observações</label>
          <textarea rows={2} maxLength={500} value={form.observacoes} onChange={set('observacoes')} />
        </div>

        <div className="auth-ok" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>Pendentes: <strong>{prev.pendentes}</strong></span>
          <span>Pago: <strong>{fmtMoeda(prev.valorPago)}</strong></span>
          <span>Saldo: <strong>{fmtMoeda(prev.saldo)}</strong></span>
          <span>Quitado: <strong>{prev.pct}%</strong></span>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sec" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-prim" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
