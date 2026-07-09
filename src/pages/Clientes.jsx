import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Spinner from '../components/Spinner'

const TIPOS = ['Comércio', 'Serviços', 'Comércio / Serviços']

// Cadastro de clientes (admin): incluir/editar empresas sem depender de SQL.
// Não há exclusão física — apagar uma empresa levaria junto (cascade) todo o
// histórico de apuração/anexos/parcelamentos; o caminho é marcá-la como SAIU.
export default function Clientes() {
  const toast = useToast()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [soAtivas, setSoAtivas] = useState(true)
  const [modal, setModal] = useState(null) // { company } para editar · {} para novo

  async function carregar() {
    const { data, error } = await supabase.from('companies').select('*')
    if (error) { toast('Erro ao carregar clientes'); setLoading(false); return }
    setCompanies((data || []).sort((a, b) => (Number(a.cod) || 0) - (Number(b.cod) || 0)))
    setLoading(false)
  }
  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase()
    return companies.filter((c) => {
      if (soAtivas && c.ativo === false) return false
      if (q && !c.empresa.toLowerCase().includes(q) && !String(c.cod).includes(q) &&
        !(c.grupo || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [companies, busca, soAtivas])

  const ativas = companies.filter((c) => c.ativo !== false).length

  async function salvar(form, isNovo) {
    if (isNovo) {
      const { error } = await supabase.from('companies').insert(form)
      if (error) {
        toast(error.code === '23505'
          ? `Já existe um cliente com o código ${form.cod}`
          : 'Erro ao salvar o cliente')
        return false
      }
    } else {
      const { cod, ...resto } = form
      const { error } = await supabase.from('companies').update(resto).eq('cod', cod)
      if (error) { toast('Erro ao salvar o cliente'); return false }
    }
    toast(isNovo ? 'Cliente cadastrado!' : 'Cliente atualizado!')
    setModal(null)
    carregar()
    return true
  }

  if (loading) return <Spinner full label="Carregando clientes..." />

  return (
    <div className="page">
      <div className="barra">
        <div className="page-title" style={{ margin: 0 }}>Clientes</div>
        <input className="busca" placeholder="Buscar por nome, código ou grupo..."
          value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="ctrl-label" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={soAtivas} onChange={(e) => setSoAtivas(e.target.checked)} />
          Só ativos
        </label>
        <div className="ml-auto" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="stat"><strong>{ativas}</strong>&nbsp;ativos · <strong>{companies.length - ativas}</strong>&nbsp;inativos</span>
          <button className="btn btn-prim" onClick={() => setModal({})}>+ Novo cliente</button>
        </div>
      </div>

      <div className="tabela-wrap">
        {filtradas.length === 0 ? (
          <div className="sem-resultado">Nenhum cliente encontrado.</div>
        ) : (
          <table className="planilha">
            <thead>
              <tr>
                <th style={{ width: 44 }}>Cód</th>
                <th className="th-emp">Empresa</th>
                <th style={{ width: 120 }}>CNPJ</th>
                <th style={{ width: 90 }}>Grupo</th>
                <th style={{ width: 130 }}>Tipo</th>
                <th style={{ width: 110 }}>Regime</th>
                <th style={{ width: 140 }}>Município/UF</th>
                <th style={{ width: 140 }}>Obrigações</th>
                <th style={{ width: 110 }}>Resp. padrão</th>
                <th style={{ width: 70 }}>Situação</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr key={c.cod} style={c.ativo === false ? { opacity: 0.55 } : undefined}>
                  <td className="td-num" style={{ fontWeight: 600, color: '#475569' }}>{c.cod}</td>
                  <td className="td-emp" title={c.empresa}>{c.empresa}</td>
                  <td style={{ fontSize: 11 }}>{c.cnpj || '—'}</td>
                  <td className="td-grp">{c.grupo ? <span className="grp-chip">{c.grupo}</span> : ''}</td>
                  <td className="td-tipo">{c.tipo || '—'}</td>
                  <td style={{ fontSize: 11 }}>{c.regime || '—'}</td>
                  <td style={{ fontSize: 11 }}>{[c.municipio, c.uf].filter(Boolean).join('/') || '—'}</td>
                  <td style={{ fontSize: 10 }}>
                    {[c.iss && 'ISS', c.icms && 'ICMS', c.sf && 'EFD Fiscal', c.sc && 'EFD Contrib.']
                      .filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td style={{ fontSize: 11 }}>{c.resp_padrao || '—'}</td>
                  <td>
                    {c.ativo === false
                      ? <span className="tag-saiu">SAIU</span>
                      : <span style={{ color: '#15803d', fontWeight: 600, fontSize: 11 }}>Ativo</span>}
                  </td>
                  <td>
                    <button className="btn btn-sec" style={{ padding: '3px 10px' }}
                      onClick={() => setModal({ company: c })}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <ClienteModal company={modal.company} onClose={() => setModal(null)} onSave={salvar} />
      )}
    </div>
  )
}

function ClienteModal({ company, onClose, onSave }) {
  const toast = useToast()
  const isNovo = !company
  const [form, setForm] = useState({
    cod: company?.cod || '',
    empresa: company?.empresa || '',
    cnpj: company?.cnpj || '',
    grupo: company?.grupo || '',
    tipo: company?.tipo || '',
    regime: company?.regime || '',
    municipio: company?.municipio || '',
    uf: company?.uf || '',
    iss: company?.iss ?? false,
    icms: company?.icms ?? false,
    sf: company?.sf ?? false,
    sc: company?.sc ?? false,
    resp_padrao: company?.resp_padrao || '',
    ativo: company?.ativo ?? true,
  })
  const [busy, setBusy] = useState(false)

  const set = (campo) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [campo]: v }))
  }

  async function submit(e) {
    e.preventDefault()
    // required do HTML aceita string só de espaços — valida após o trim para
    // nunca criar cliente com código (primary key) ou razão social vazios.
    if (!form.cod.trim() || !form.empresa.trim()) {
      toast('Preencha o código e a razão social')
      return
    }
    setBusy(true)
    const ok = await onSave(
      {
        ...form,
        cod: form.cod.trim(),
        empresa: form.empresa.trim(),
        cnpj: form.cnpj.trim() || null,
        grupo: form.grupo.trim() || null,
        tipo: form.tipo || null,
        regime: form.regime.trim() || null,
        municipio: form.municipio.trim() || null,
        uf: form.uf.trim().toUpperCase() || null,
        resp_padrao: form.resp_padrao.trim() || null,
      },
      isNovo
    )
    if (!ok) setBusy(false) // sucesso desmonta o modal (setModal(null) no pai)
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal lg" onSubmit={submit}>
        <h2>{isNovo ? '➕ Novo cliente' : `✏️ ${company.empresa}`}</h2>

        <div className="field-row">
          <div className="field" style={{ maxWidth: 110 }}>
            <label>Código *</label>
            <input required value={form.cod} onChange={set('cod')} disabled={!isNovo}
              placeholder="ex.: 310" title={isNovo ? '' : 'O código não pode ser alterado'} />
          </div>
          <div className="field">
            <label>Razão social / nome *</label>
            <input required value={form.empresa} onChange={set('empresa')} placeholder="Nome da empresa" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>CNPJ</label>
            <input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" />
          </div>
          <div className="field">
            <label>Grupo</label>
            <input value={form.grupo} onChange={set('grupo')} placeholder="ex.: GRUPO 12" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Tipo</label>
            <select value={form.tipo} onChange={set('tipo')}>
              <option value="">—</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Regime</label>
            <input value={form.regime} onChange={set('regime')} placeholder="ex.: Simples Nacional" />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Município</label>
            <input value={form.municipio} onChange={set('municipio')} />
          </div>
          <div className="field" style={{ maxWidth: 80 }}>
            <label>UF</label>
            <input value={form.uf} onChange={set('uf')} maxLength={2} placeholder="RJ" />
          </div>
          <div className="field">
            <label>Responsável padrão</label>
            <input value={form.resp_padrao} onChange={set('resp_padrao')} placeholder="ex.: MARIANNA" />
          </div>
        </div>

        <div className="field">
          <label>Obrigações aplicáveis (dica visual na planilha)</label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '4px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.iss} onChange={set('iss')} /> ISS
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.icms} onChange={set('icms')} /> ICMS
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.sf} onChange={set('sf')} /> EFD Fiscal (Sped Fiscal)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.sc} onChange={set('sc')} /> EFD Contribuições (Sped Contrib.)
            </label>
          </div>
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.ativo} onChange={set('ativo')} />
            Cliente ativo na carteira (desmarque para registrar saída — "SAIU")
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sec" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-prim" disabled={busy}>
            {busy ? 'Salvando...' : isNovo ? 'Cadastrar' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
