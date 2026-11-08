import { useState } from 'react'
import { agendaLivre, faixaChance, type DecisaoCaso } from '../game/caso'
import { ABAFAR, AGENDA_INTEL, DOSSIE, INTELIGENCIA, type AcaoIntel, type OrdemIntel } from '../game/data/inteligencia'
import { GDP_BILLIONS } from '../game/data/bills'
import { PARTIES, PARTY_BY_ID } from '../game/data/parties'
import type { AcaoCpi } from '../game/data/cpi'
import { chanceAbafarFalhar, intelOf, ordemBlockedReason, riscoRevelado, sementeAvisada } from '../game/inteligencia'
import { leaderOf } from '../game/partidos'
import { absMonth } from '../game/memory'
import { pessoasAtuais, pistaRisco } from '../game/risco'
import { AgendaBadge } from './CasoCard'
import { eloDe } from './Elo'
import { Portrait } from './Portrait'
import type { GameState, PartyId } from '../game/types'

/**
 * Etapa 5C, bloco 3 (v0.32.0): o serviço de inteligência na tela. Tudo é uma ordem por mês, com o custo à vista.
 * O serviço avisa de vazamentos e de pedidos de CPI, revela o risco oculto de uma pessoa, pode tentar abafar um
 * vazamento avisado e junta dossiês (que viram votos na Câmara, mas alimentam um esquema escondido com a sua assinatura).
 * A ordem vai em `MonthPlan.inteligencia` e vale ao encerrar o mês. Fechar e queimar não gastam agenda (saídas).
 */
const PAPEL: Record<string, string> = { ministro: 'ministro(a)', supremo: 'Supremo', lider: 'líder de partido', advogado: 'advogado', presidente: 'presidente' }

export function InteligenciaCard({ state, ordem, decisoes, advogado, cpi, onOrdem }: {
  state: GameState
  ordem: OrdemIntel | null
  decisoes: DecisaoCaso[]
  advogado: string | null
  cpi: AcaoCpi | null
  onOrdem: (o: OrdemIntel | null) => void
}) {
  const I = intelOf(state)
  const now = absMonth(state)
  const [pessoa, setPessoa] = useState('')
  const base = { casos: decisoes, advogado: advogado ?? undefined, cpi: cpi ?? undefined }
  const livre = agendaLivre(base)
  const plan = { ...base, inteligencia: ordem ?? undefined }
  /** Motivo de a ordem não valer agora (regra do motor ou agenda cheia), ou null. */
  const why = (o: OrdemIntel): string | null => {
    const r = ordemBlockedReason(state, o)
    if (r) return r
    return AGENDA_INTEL[o.acao] > livre ? 'A agenda do presidente já está cheia neste mês.' : null
  }
  const pick = (acao: AcaoIntel, alvo?: string) => onOrdem(ordem && ordem.acao === acao && ordem.alvo === alvo ? null : { acao, alvo })
  const chosen = (acao: AcaoIntel, alvo?: string) => ordem?.acao === acao && ordem.alvo === alvo
  const btn = (acao: AcaoIntel, label: string, alvo?: string) => {
    const r = why({ acao, alvo })
    const on = chosen(acao, alvo)
    return (
      <button key={`${acao}-${alvo ?? ''}`} className={`pn-btn ${on ? '' : 'pn-btn--ghost'} pn-btn--small`} disabled={!!r && !on} title={r ?? undefined} onClick={() => pick(acao, alvo)}>
        {on ? '✔ ' : ''}{label}{on ? ' (desfazer)' : ''}
      </button>
    )
  }
  const custoAno = ((INTELIGENCIA.pctPib / 100) * GDP_BILLIONS).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const avisoSem = I.ativo ? sementeAvisada(state) : undefined
  const left = I.aviso ? Math.max(0, I.aviso.vazaEm - now) : 0
  const nomes = pessoasAtuais(state).filter((p) => p.ctx.papel !== 'presidente' && !I.revelados.includes(p.name))
  const lideres = PARTIES.filter((p) => p.id !== state.playerParty && state.congress.parties[p.id])
  const falha = chanceAbafarFalhar(state)

  return (
    <section className="pn-card" id="inteligencia">
      <h3>📡 Serviço de inteligência <AgendaBadge plan={plan} /></h3>
      <p className="pn-hint" style={{ margin: '0 0 8px' }}>
        Uma ordem por mês. Sabe de coisas antes dos outros, mas tudo o que ele faz deixa rastro com a sua assinatura: o serviço não avisa sobre o que ele mesmo faz.
      </p>
      {ordem && (
        <p className="up" style={{ margin: '4px 0' }}>✔ Ordem do mês: {ordemTexto(ordem)} Vale ao encerrar o mês. <button className="pn-link" onClick={() => onOrdem(null)}>desfazer</button></p>
      )}

      {!I.ativo ? (
        <>
          <div className="pn-offer">
            <b>{I.fechadoEm > -99 ? 'O serviço está fechado.' : 'O serviço ainda não foi montado.'}</b>
            <ul className="pn-integ__list">
              <li>Gasta <b>1 espaço da agenda</b> e custa cerca de <b>R$ {custoAno} bi por ano</b> enquanto aberto.</li>
              <li>Sobe a exposição a escândalo em {INTELIGENCIA.montar.exposicao} e enfraquece o Controle do Estado.</li>
              <li>Avisa de ~70% dos vazamentos e pedidos de CPI com 2 meses de antecedência, e o golpe vem menor.</li>
              <li>Depois de montado, dá para fechar quando quiser (reabre só {INTELIGENCIA.reabrirEm} meses depois).</li>
            </ul>
            {btn('montar', '📡 Montar o serviço')}
          </div>
        </>
      ) : (
        <>
          {/* Avisos */}
          <div className="pn-intel__box">
            <b>📬 Avisos</b>
            {!I.aviso && !I.avisoCpi && <p className="pn-hint" style={{ margin: '4px 0' }}>Nada no radar. Os avisos chegam sozinhos, 2 meses antes.</p>}
            {I.avisoCpi && <p className="pn-hint" style={{ margin: '4px 0' }}>🏛️ A oposição prepara um pedido de CPI sobre o caso. Ele começa com menos assinaturas por causa do aviso.</p>}
            {I.aviso && avisoSem && (
              <>
                <p style={{ margin: '4px 0' }}>
                  🗞️ <b>{avisoSem.quem}</b> deve aparecer na imprensa {left <= 0 ? 'neste fechamento' : `em ${left} ${left === 1 ? 'mês' : 'meses'}`}. O golpe vem menor porque o governo está preparado.
                </p>
                {I.aviso.queimado ? (
                  <p className="dn" style={{ margin: '4px 0' }}>A tentativa de abafar deu errado: vai vazar neste fechamento.</p>
                ) : (
                  <>
                    <div className="pn-row" style={{ marginTop: 4 }}>
                      {btn('abafar', '🤫 Tentar abafar')}
                    </div>
                    <small className="pn-hint">
                      Chance de dar errado: <b className={falha >= 0.45 ? 'dn' : 'warn'}>{faixaChance(falha).toLowerCase()}</b> (sobe com os pedidos de dossiê e com o Controle do Estado alto).
                      Se der certo: some por {ABAFAR.adia} meses e o caso nasce menor, mas deixa rastro grande e, quando vier, chama CPI.
                      Se der errado: vaza já, mais grave, e chega em você. Só dá para tentar uma vez a cada {ABAFAR.intervalo} meses.
                    </small>
                  </>
                )}
              </>
            )}
          </div>

          {/* Revelar */}
          <div className="pn-intel__box">
            <b>🔎 Levantar a vida de alguém</b>
            <small className="pn-hint" style={{ display: 'block' }}>Mostra o risco oculto de um ministro, de um ministro do Supremo ou de um líder. Gasta 1 espaço e deixa um pequeno rastro. Uma vez por pessoa.</small>
            <div className="pn-row" style={{ marginTop: 6 }}>
              <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} className="pn-select">
                <option value="">Escolha a pessoa…</option>
                {nomes.map((p) => <option key={p.name} value={p.name}>{p.name} ({PAPEL[p.ctx.papel] ?? p.ctx.papel})</option>)}
              </select>
              {pessoa && btn('revelar', 'Mandar levantar', pessoa)}
            </div>
            {I.revelados.length > 0 && (
              <ul className="pn-integ__list">
                {I.revelados.map((n) => {
                  const r = riscoRevelado(state, n)
                  return <li key={n}><b>{n}</b>: {r === null ? 'sem dados' : <>risco <b className={r >= 50 ? 'dn' : r >= 25 ? 'warn' : 'up'}>{Math.round(r)}/100</b> · {pistaRisco(r).toLowerCase()}</>}</li>
                })}
              </ul>
            )}
          </div>

          {/* Dossiês */}
          <div className="pn-intel__box">
            <b>🗂️ Dossiês sobre líderes de bancada</b>
            <small className="pn-hint" style={{ display: 'block' }}>
              Cada pedido junta {DOSSIE.junta[0]} a {DOSSIE.junta[1]} de material (gasta 1 espaço). Com {DOSSIE.usarDesde} ou mais, o dossiê vira voto na janela de votação da Câmara.
              <b> O preço:</b> todo pedido alimenta um esquema escondido com a sua assinatura. Quanto mais pedidos, mais grave, e se vazar vira caso na PF e CPI.
            </small>
            <div className="pn-intel__parties">
              {lideres.map((p) => {
                const d = I.dossies[p.id]
                const m = Math.round(d?.material ?? 0)
                const l = leaderOf(state, p.id)
                return (
                  <div key={p.id} className="pn-intel__party">
                    <Portrait name={l.name} feminine={l.feminine} color={p.color} size={40} title={l.name} elo={eloDe(state, l.name, { papel: 'lider', party: p.id })} />
                    <div className="grow">
                      <b style={{ color: p.color }}>{p.sigla}</b> · {l.name}
                      <span className="pn-meter" style={{ display: 'block', marginTop: 3 }}><span style={{ width: `${m}%`, background: m >= DOSSIE.usarDesde ? 'var(--pn-gold)' : 'var(--pn-mut)' }} /></span>
                      <small className="pn-hint">material {m}/100{m >= DOSSIE.usarDesde ? ' · pronto para usar numa votação' : ''}</small>
                    </div>
                    {btn('investigar', 'Investigar', p.id)}
                  </div>
                )
              })}
            </div>
            {(I.pedidos > 0 || I.semente) && (
              <p className="pn-hint" style={{ margin: '6px 0 0' }}>
                🧯 Há um esquema escondido ligado a você ({I.pedidos} pedido{I.pedidos === 1 ? '' : 's'}). Queimar os arquivos zera o material, reduz o esquema pela metade e não gasta agenda; fica a exposição de +{DOSSIE.queimar.exposicao}.
              </p>
            )}
            <div className="pn-row">
              {btn('queimar', '🔥 Queimar os dossiês')}
            </div>
          </div>

          <div className="pn-row">
            {btn('fechar', 'Fechar o serviço')}
            <small className="pn-hint">Fechar não gasta agenda, tira o gasto contínuo e só reabre em {INTELIGENCIA.reabrirEm} meses.</small>
          </div>
        </>
      )}
    </section>
  )
}

/** Frase curta da ordem escolhida, com o custo. */
function ordemTexto(o: OrdemIntel): string {
  switch (o.acao) {
    case 'montar': return 'montar o serviço (agenda 1).'
    case 'fechar': return 'fechar o serviço.'
    case 'revelar': return `levantar a vida de ${o.alvo} (agenda 1).`
    case 'abafar': return 'tentar abafar o vazamento avisado (agenda 1, com risco).'
    case 'investigar': return `juntar material sobre o líder do ${PARTY_BY_ID[o.alvo as PartyId]?.sigla ?? ''} (agenda 1).`
    case 'queimar': return 'queimar os dossiês.'
  }
}
