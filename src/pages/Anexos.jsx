import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase, fetchAllRows } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import Spinner from '../components/Spinner'
import {
  DOCS_ANEXOS, DOC_CAT_LABEL, DOC_CAT_HDR,
  CICLO, CICLO_LABEL, CICLO_CLS,
  PERIODOS_ANO_ATUAL, PERIODOS_ANO_ANT, ANO_ATUAL, ANO_ANT, periodoLabel, PERIODO_ATUAL,
  safeUrl,
} from '../lib/constants'

const POLL_MS = 25_000
const akey = (cod, doc) => `${cod}__${doc}`

// Controle de Anexos: status + link + observações por documento/cliente/competência.
export default function Anexos() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const nome = profile?.nome || user?.email || ''

  const [companies, setCompanies] = useState([])
  const [periodo, setPeriodo] = useState(PERIODO_ATUAL)
  const [docs, setDocs] = useState({}) // { cod__doc: {status, link, observacoes, nome, at} }
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [detalhe, setDetalhe] = useState(null) // { company, docKey }
  const clickPend = useRef(null)

  const docsRef = useRef(docs)
  docsRef.current = docs

  useEffect(() => {
    supabase.from('companies').select('cod, empresa, grupo, tipo, ativo').then(({ data }) => {
      setCompanies((data || []).sort((a, b) => (Number(a.cod) || 0) - (Number(b.cod) || 0)))
    })
  }, [])

  const carregar = useCallback(async (per, spin = false) => {
    if (spin) setLoading(true)
    const { data, error } = await fetchAllRows((sb) =>
      sb.from('anexos')
        .select('company_cod, doc_key, status, link, observacoes, updated_by_nome, updated_at')
        .eq('periodo', per)
        .order('company_cod', { ascending: true })
        .order('doc_key', { ascending: true }) // desempate único p/ paginação estável
    )
    if (error) { toast('Erro ao carregar anexos'); setLoading(false); return }
    const m = {}
    for (const r of data || []) {
      m[akey(r.company_cod, r.doc_key)] = {
        status: r.status || '', link: r.link, observacoes: r.observacoes,
        nome: r.updated_by_nome, at: r.updated_at,
      }
    }
    setDocs(m)
    setLoading(false)
  }, [toast])

  useEffect(() => { carregar(periodo, true) }, [periodo, carregar])

  useEffect(() => {
    const canal = supabase
      .channel(`anexos:${periodo}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'anexos', filter: `periodo=eq.${periodo}` },
        () => carregar(periodo))
      .subscribe()
    const poll = setInterval(() => carregar(periodo), POLL_MS)
    return () => { supabase.removeChannel(canal); clearInterval(poll) }
  }, [periodo, carregar])

  const salvar = useCallback(async (company, docKey, patch) => {
    const k = akey(company.cod, docKey)
    const atual = docsRef.current[k] || {}
    const novo = { ...atual, ...patch }
    setDocs((prev) => ({ ...prev, [k]: { ...novo, nome, at: new Date().toISOString() } }))
    const { error } = await supabase.from('anexos').upsert(
      {
        company_cod: company.cod,
        doc_key: docKey,
        periodo,
        status: novo.status || '',
        link: novo.link || null,
        observacoes: novo.observacoes || null,
        updated_by: user.id,
        updated_by_nome: nome,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_cod,doc_key,periodo' }
    )
    if (error) { toast('Erro ao salvar — recarregando'); carregar(periodo); return false }
    return true
  }, [periodo, user, nome, toast, carregar])

  const handleClick = useCallback(async (company, docKey) => {
    const atual = docsRef.current[akey(company.cod, docKey)]?.status || ''
    const prox = CICLO[(CICLO.indexOf(atual) + 1) % CICLO.length]
    const ok = await salvar(company, docKey, { status: prox })
    if (ok) toast(`${CICLO_LABEL[prox]} — salvo!`)
  }, [salvar, toast])

  // Clique com atraso: duplo clique cancela o ciclo e abre o modal de link/obs.
  // Clicar em outra célula antes dos 230ms descarrega o clique anterior na hora.
  const cellClick = useCallback((company, docKey) => {
    const pend = clickPend.current
    if (pend) {
      clearTimeout(pend.timer)
      if (pend.cod !== company.cod || pend.doc !== docKey) handleClick(pend.company, pend.doc)
    }
    const timer = setTimeout(() => { clickPend.current = null; handleClick(company, docKey) }, 230)
    clickPend.current = { cod: company.cod, doc: docKey, company, timer }
  }, [handleClick])

  const cellDetail = useCallback((company, docKey) => {
    if (clickPend.current) { clearTimeout(clickPend.current.timer); clickPend.current = null }
    setDetalhe({ company, docKey })
  }, [])

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase()
    return companies.filter((c) => {
      if (q && !c.empresa.toLowerCase().includes(q) && !String(c.cod).includes(q)) return false
      if (fStatus) {
        const alvo = fStatus === 'vazio' ? '' : fStatus
        const tem = DOCS_ANEXOS.some((d) => (docs[akey(c.cod, d[0])]?.status || '') === alvo)
        if (!tem) return false
      }
      return true
    })
  }, [companies, busca, fStatus, docs])

  const pendencias = useMemo(() => {
    let pendentes = 0
    let anexados = 0
    companies.forEach((c) => {
      DOCS_ANEXOS.forEach((d) => {
        const st = docs[akey(c.cod, d[0])]?.status || ''
        if (st === 'feito') anexados++
        else if (st !== 'na') pendentes++
      })
    })
    return { pendentes, anexados }
  }, [companies, docs])

  const catSpans = useMemo(() => {
    const out = []
    let prev = ''
    let count = 0
    DOCS_ANEXOS.forEach((d, i) => {
      if (d[2] !== prev) { if (prev) out.push({ cat: prev, count }); prev = d[2]; count = 1 }
      else count++
      if (i === DOCS_ANEXOS.length - 1) out.push({ cat: prev, count })
    })
    return out
  }, [])

  if (loading) return <Spinner full label="Carregando anexos..." />

  return (
    <>
      <div className="barra">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Competência:</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}
            style={{ fontWeight: 700, color: 'var(--azul)', borderColor: 'var(--azul2)' }}>
            <optgroup label={`── ${ANO_ATUAL} ──`}>
              {PERIODOS_ANO_ATUAL.map((p) => <option key={p} value={p}>{periodoLabel(p)}</option>)}
            </optgroup>
            <optgroup label={`── ${ANO_ANT} ──`}>
              {PERIODOS_ANO_ANT.map((p) => <option key={p} value={p}>{periodoLabel(p)}</option>)}
            </optgroup>
          </select>
        </div>
        <input className="busca" placeholder="Buscar cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label className="ctrl-label">Com status:</label>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="vazio">Não iniciado</option>
            <option value="andamento">Em andamento</option>
            <option value="feito">Finalizado</option>
            <option value="na">Não se aplica</option>
          </select>
        </div>
        <button className="btn btn-sec" onClick={() => { setBusca(''); setFStatus('') }}>Limpar</button>
        <div className="ml-auto stat" style={{ gap: 14 }}>
          <span><strong>{pendencias.anexados}</strong> anexados</span>
          <span style={{ color: '#b91c1c' }}><strong>{pendencias.pendentes}</strong> pendentes</span>
        </div>
      </div>

      <div className="stats">
        <div className="stat">💡 clique = muda status · duplo clique = link do arquivo + observações · 🔗 = tem link</div>
      </div>

      <div className="tabela-wrap">
        <table className="planilha" style={{ minWidth: 1400 }}>
          <thead>
            <tr>
              <th className="th-grupo-id" rowSpan={2} style={{ width: 36 }}>Cód</th>
              <th className="th-grupo-id th-emp" rowSpan={2}>Cliente</th>
              {catSpans.map((c) => (
                <th key={c.cat} className={DOC_CAT_HDR[c.cat]} colSpan={c.count} style={{ fontSize: 11 }}>
                  {DOC_CAT_LABEL[c.cat]}
                </th>
              ))}
            </tr>
            <tr>
              {DOCS_ANEXOS.map((d) => (
                <th key={d[0]} className={DOC_CAT_HDR[d[2]]} style={{ width: 84, fontSize: 9, fontWeight: 500 }}>
                  {d[1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <tr key={c.cod} style={c.ativo === false ? { opacity: 0.55 } : undefined}>
                <td className="td-num" style={{ fontWeight: 600, color: '#475569' }}>{c.cod}</td>
                <td className="td-emp" title={c.empresa}>
                  {c.empresa}{c.ativo === false && <span className="tag-saiu"> (SAIU)</span>}
                </td>
                {DOCS_ANEXOS.map((d) => {
                  const cell = docs[akey(c.cod, d[0])]
                  const st = cell?.status || ''
                  const dicas = [CICLO_LABEL[st]]
                  if (cell?.link) dicas.push(`Link: ${cell.link}`)
                  if (cell?.observacoes) dicas.push(`Obs: ${cell.observacoes}`)
                  if (cell?.nome) dicas.push(`Últ. alteração: ${cell.nome}`)
                  dicas.push('Clique: status · Duplo clique: link/obs')
                  return (
                    <td key={d[0]}>
                      <span className={`cel ${CICLO_CLS[st]}`}
                        onClick={() => cellClick(c, d[0])}
                        onDoubleClick={(e) => { e.preventDefault(); cellDetail(c, d[0]) }}
                        title={dicas.join('\n')}>
                        {st ? CICLO_LABEL[st] : ''}
                        {safeUrl(cell?.link) && (
                          <span className="cel-meta">
                            <a className="cel-link" href={safeUrl(cell.link)} target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}>🔗 abrir</a>
                          </span>
                        )}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalhe && (
        <AnexoModal
          company={detalhe.company}
          docKey={detalhe.docKey}
          cell={docs[akey(detalhe.company.cod, detalhe.docKey)] || {}}
          onClose={() => setDetalhe(null)}
          onSave={async (patch) => {
            const ok = await salvar(detalhe.company, detalhe.docKey, patch)
            if (ok) { toast('Anexo salvo!'); setDetalhe(null) }
          }}
        />
      )}
    </>
  )
}

function AnexoModal({ company, docKey, cell, onClose, onSave }) {
  const doc = DOCS_ANEXOS.find((d) => d[0] === docKey)
  const [status, setStatus] = useState(cell.status || '')
  const [link, setLink] = useState(cell.link || '')
  const [obs, setObs] = useState(cell.observacoes || '')
  const [busy, setBusy] = useState(false)

  async function salvar(e) {
    e.preventDefault()
    setBusy(true)
    await onSave({ status, link: link.trim() || null, observacoes: obs.trim() || null })
    setBusy(false)
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal lg" onSubmit={salvar}>
        <h2>📎 {doc[1]}</h2>
        <p style={{ marginBottom: 14 }}>{company.cod} · {company.empresa}</p>

        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {CICLO.map((v) => <option key={v} value={v}>{CICLO_LABEL[v]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Link / localização do arquivo (rede, OneDrive, Google Drive)</label>
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)}
            placeholder="https://drive.google.com/..." />
        </div>
        <div className="field">
          <label>Observações</label>
          <textarea rows={3} maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)}
            placeholder="Anotações sobre este documento..." />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {safeUrl(link) && <a className="btn btn-sec" href={safeUrl(link)} target="_blank" rel="noreferrer" style={{ marginRight: 'auto', textDecoration: 'none' }}>🔗 Abrir arquivo</a>}
          <button type="button" className="btn btn-sec" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-prim" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
