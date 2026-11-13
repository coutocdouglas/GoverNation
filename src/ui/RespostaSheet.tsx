import { useState } from 'react'
import type { EventDef } from '../game/data/events'
import { GROUP_BY_ID, GROUPS } from '../game/data/groups'
import { MINISTER_BY_AREA } from '../game/data/ministers'
import { PARTIES, PARTY_BY_ID } from '../game/data/parties'
import { DEMAND_BY_ID } from '../game/data/demands'
import { NOME_ORGAO, NOME_RESPOSTA, type Orgao } from '../game/data/resposta'
import { AREAS } from '../game/ministerios'
import { alivioTexto, calcularResposta, respostaBlockedReason, rotuloResposta, type RespostaFato } from '../game/resposta'
import type { GameState, GroupId, PartyId } from '../game/types'
import type { AreaId } from '../game/data/ministers'
import { GROUP_ICON } from './icons'

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const sinal = (n: number) => `${n > 0 ? '+' : '−'}${num(Math.abs(n))}`

/** Que dados cada ação pede (o que o texto não disse, o jogador ajusta aqui). */
const CAMPOS: Record<RespostaFato['tipo'], ('partido' | 'area' | 'tom' | 'grupo' | 'demanda' | 'orgao')[]> = {
  pasta: ['area', 'partido'], lider: ['partido'], ministro: ['area', 'tom'], barganha: ['partido'], entidades: ['grupo'], campanha: ['grupo'],
  pedido: ['demanda'], apurar: ['orgao'], ordem: [], verba: [], visita: [], desculpas: [],
}

/**
 * Etapa 6G, H1 (v0.44): "Entendi isto". O texto do presidente virou uma ação do governo, sem votação.
 * Mostra o que acontece, quanto custa e quanto resolve o fato antes de dar a ordem (Efeitos visíveis).
 */
export function RespostaSheet({ state, ev, inicial, resumo, fallback, onClose, onDar, onRewrite, onIrMinisterios }: {
  state: GameState
  ev: EventDef
  inicial: RespostaFato
  /** O que a IA entendeu, em palavras (vazio sem IA). */
  resumo: string
  fallback: string | null
  onClose: () => void
  onDar: (r: RespostaFato) => void
  onRewrite: () => void
  onIrMinisterios?: () => void
}) {
  const [r, setR] = useState<RespostaFato>(inicial)
  const nome = NOME_RESPOSTA[r.tipo]
  const bloqueio = respostaBlockedReason(state, r)
  const c = calcularResposta(state, ev, r)
  const bom = ev.kind === 'bom'
  const grupos = (Object.entries(c.fx.groups ?? {}) as [GroupId, number][]).filter(([, v]) => v).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const partidos = (Object.entries(c.partidos) as [PartyId, number][]).filter(([, v]) => v)
  const set = (patch: Partial<RespostaFato>) => setR((x) => ({ ...x, ...patch }))
  const campos = CAMPOS[r.tipo]

  return (
    <aside className="detail pn-sheet-back" onClick={onClose}>
      <div className="pn-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <div className="pn-kicker">Leitura do gabinete · antes de dar a ordem</div>
        <h2>Entendi: {nome.icone} {rotuloResposta(state, r)}</h2>
        <div className="pn-memo pn-memo--flat">
          {resumo ? <p>{resumo}</p> : <p>É uma ação do governo, não uma lei: não passa pela Câmara, pelo Senado nem pelo Supremo. Vale ao encerrar o mês.</p>}
        </div>
        {fallback && <p className="pn-hint">⚠️ {fallback} Lido por palavras-chave.</p>}

        {campos.length > 0 && (
          <div className="pn-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {campos.includes('area') && (
              <label className="pn-hint" style={{ margin: 0 }}>{r.tipo === 'ministro' ? 'Ministro: ' : 'Ministério: '}
                <select value={r.area ?? ''} onChange={(e) => set({ area: (e.target.value || undefined) as AreaId | undefined })}>
                  <option value="">escolha</option>
                  {AREAS.map((a) => <option key={a} value={a}>{MINISTER_BY_AREA[a].areaName}</option>)}
                </select>
              </label>
            )}
            {campos.includes('partido') && (
              <label className="pn-hint" style={{ margin: 0 }}>Partido:{' '}
                <select value={r.partido ?? ''} onChange={(e) => set({ partido: (e.target.value || undefined) as PartyId | undefined })}>
                  <option value="">escolha</option>
                  {PARTIES.filter((p) => p.id !== state.playerParty).map((p) => <option key={p.id} value={p.id}>{p.sigla} · {p.name}</option>)}
                </select>
              </label>
            )}
            {campos.includes('tom') && (
              <label className="pn-hint" style={{ margin: 0 }}>Como:{' '}
                <select value={r.tom ?? 'particular'} onChange={(e) => set({ tom: e.target.value as 'particular' | 'publico' })}>
                  <option value="particular">em particular</option>
                  <option value="publico">em público</option>
                </select>
              </label>
            )}
            {campos.includes('grupo') && (
              <label className="pn-hint" style={{ margin: 0 }}>{r.tipo === 'campanha' ? 'Público: ' : 'Com quem: '}
                <select value={r.grupo ?? ''} onChange={(e) => set({ grupo: (e.target.value || undefined) as GroupId | undefined })}>
                  {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            )}
            {campos.includes('demanda') && (
              <label className="pn-hint" style={{ margin: 0 }}>Pedido:{' '}
                <select value={r.demanda ?? ''} onChange={(e) => set({ demanda: e.target.value || undefined, grupo: DEMAND_BY_ID[e.target.value]?.group })}>
                  {state.demands.length === 0 && <option value="">nenhum pedido em aberto</option>}
                  {state.demands.map((d) => <option key={d.id} value={d.id}>{DEMAND_BY_ID[d.id]?.title}</option>)}
                </select>
              </label>
            )}
            {campos.includes('orgao') && (
              <label className="pn-hint" style={{ margin: 0 }}>Quem apura:{' '}
                <select value={r.orgao ?? 'pf'} onChange={(e) => set({ orgao: e.target.value as Orgao })}>
                  {(Object.keys(NOME_ORGAO) as Orgao[]).map((o) => <option key={o} value={o}>{NOME_ORGAO[o]}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        <div className="pn-sheet__grid">
          <div><span>Vira</span><b>{nome.icone} Ação do governo</b><small>sem votação e sem Supremo</small></div>
          <div><span>Gasto</span><b className={c.gastoBi > 0 ? 'dn' : ''}>{c.gastoBi > 0 ? `−R$ ${num(c.gastoBi)} bi` : 'Nenhum'}</b><small>{c.gastoBi > 0 ? 'passageiro, nos próximos meses' : 'não mexe nas contas'}</small></div>
          <div><span>{bom ? 'Aproveita a notícia' : 'Resolve o fato'}</span><b className={c.alivio >= 0.5 ? 'up' : c.alivio < 0.2 ? 'dn' : ''}>{alivioTexto(c.alivio, bom)}</b><small>{bom ? 'o resto do crédito pode ir para a oposição' : 'o que sobra vale como deixar passar'}</small></div>
        </div>

        {(grupos.length > 0 || partidos.length > 0 || c.escandalo > 0) && (
          <>
            <div className="pn-label">Quem sente</div>
            <div className="pn-feel">
              {grupos.map(([g, v]) => <span key={g} className={v > 0 ? 'up' : 'dn'}>{GROUP_ICON[g]} {GROUP_BY_ID[g].name} {sinal(v)}</span>)}
              {partidos.map(([p, v]) => <span key={p} className={v > 0 ? 'up' : 'dn'}>🏛️ {PARTY_BY_ID[p].sigla} {sinal(v)} na relação</span>)}
              {c.escandalo > 0 && <span className="dn">🕵️ exposição a escândalo +{num(c.escandalo)}</span>}
            </div>
          </>
        )}
        {c.avisos.length > 0 && <ul className="causes">{c.avisos.map((a, i) => <li key={i}><span className={a.bom ? 'up' : 'dn'}>{a.bom ? '+' : '−'} {a.texto}</span></li>)}</ul>}
        {r.tipo === 'pasta' && onIrMinisterios && (
          <button type="button" className="pn-btn pn-btn--ghost pn-btn--small" onClick={onIrMinisterios}>🏛️ Ver a aba Ministérios</button>
        )}
        <p className="pn-hint">Se não é isso que você quis dizer, volte e reescreva: <b>nada foi decidido ainda</b>. Deixar passar continua possível.</p>

        <div className="pn-sheet__foot">
          <button className="pn-btn pn-btn--big" disabled={!!bloqueio} onClick={() => onDar(r)}>🖊️ Dar a ordem</button>
          <button className="pn-btn pn-btn--ghost pn-btn--big" onClick={onRewrite}>Voltar e reescrever</button>
        </div>
        {bloqueio && <p className="pn-action__blk">⏳ {bloqueio}</p>}
      </div>
    </aside>
  )
}
