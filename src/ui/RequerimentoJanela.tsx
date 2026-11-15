import type { ReactNode } from 'react'
import { cancelarAcao, escolherAcao } from '../game/agenda'
import { acaoBlockedReason } from '../game/agenda'
import { parecerAdvogado } from '../game/caso'
import { BILL_BY_ID, INSTRUMENTS } from '../game/data/bills'
import { GROUP_BY_ID } from '../game/data/groups'
import { GRUPO_REQ, REQUERIMENTO, type PautaId } from '../game/data/requerimento'
import { faixaTensao, tensaoOf } from '../game/tensao'
import { TEXTO_FAIXA } from './GruposJanela'
import { absMonth } from '../game/memory'
import {
  alvoDe, chanceContra, faixaContra, ministroDoSetor, passoBlockedReason, pautaInfo, requerimentoAtivo, requerimentosOf, setorEstado,
  type FaseReq, type PassoReq,
} from '../game/requerimento'
import { peekRound, sendBlockedReason } from '../game/rodada'
import { propostaDef } from '../game/risco'
import type { GameState } from '../game/types'
import { effectChips } from './effects'
import { num } from './format'

const FASES: { id: FaseReq | 'adocao'; nome: string }[] = [
  { id: 'aberto', nome: '1 · Chegada' },
  { id: 'pautas', nome: '2 · Pautas' },
  { id: 'acatado', nome: '3 · Acatado' },
  { id: 'estruturado', nome: '4 · Ministro' },
  { id: 'adocao', nome: '5 · Adoção' },
]
const NOME_FASE: Record<FaseReq, string> = { aberto: 'chegou', pautas: 'pautas', acatado: 'acatado', estruturado: 'ministro pronto' }

const mesesTexto = (n: number) => (n <= 0 ? 'vence neste mês' : `${n} ${n === 1 ? 'mês' : 'meses'}`)

/** Quantos meses faltam para decidir (0 = o prazo acaba ao encerrar este mês). */
export function mesesDoRequerimento(state: GameState): number | null {
  const a = requerimentoAtivo(state)
  return a ? Math.max(0, a.ate - absMonth(state)) : null
}

/** Resumo para o Radar. */
export function resumoRequerimentoRadar(state: GameState): { titulo: string; texto: string; tag: string; tom?: 'warn' | 'dn' } | null {
  const a = requerimentoAtivo(state)
  if (!a) return null
  const al = alvoDe(a.setor)
  const m = mesesDoRequerimento(state)!
  return { titulo: `Requerimento de um ${al.grupo ? 'grupo' : 'setor'}`, texto: `${al.nome}: ${NOME_FASE[a.fase]} · ${mesesTexto(m)}`, tag: m <= 0 ? 'último mês' : 'em andamento', tom: m <= 0 ? 'dn' : undefined }
}

const faixaRelacao = (v: number) => (v >= 70 ? 'boa' : v >= 45 ? 'neutra' : v >= 25 ? 'fria' : 'ruim')

/** O cartão do Painel: o requerimento em uma linha, com a fase e o prazo. O passo a passo fica na janela (Teste da interface). */
export function RequerimentoCard({ state, passo, onAbrir }: { state: GameState; passo: PassoReq | null; onAbrir: () => void }): ReactNode {
  const a = requerimentoAtivo(state)
  if (!a) return null
  const al = alvoDe(a.setor)
  const m = mesesDoRequerimento(state)!
  const reuniao = peekRound(state)?.acao?.tipo === 'reuniao'
  const marcado = reuniao ? 'Reunião anotada para este mês' : passo ? { ignorar: 'Ignorar anotado', pauta: 'Pauta escolhida', contrapor: 'Contraproposta anotada', desacatar: 'Desacato anotado', desistir: 'Desistência anotada' }[passo.passo] : null
  return (
    <section className="pn-card pn-card--gold">
      <h3>{al.icon} Requerimento de um {al.grupo ? 'grupo' : 'setor'} <span className="pn-badge">{al.nome} · {NOME_FASE[a.fase]} · {mesesTexto(m)}</span></h3>
      <p className="pn-proposta__pede">“{a.fase === 'aberto' ? al.pede : a.fase === 'pautas' ? 'O setor devolveu as pautas da reunião.' : a.fase === 'acatado' ? 'Pauta acatada: o ministro estrutura a medida.' : 'A medida está pronta para você adotar.'}”</p>
      <div className="pn-row" style={{ alignItems: 'center', gap: 8 }}>
        <button type="button" className="pn-btn pn-btn--small" onClick={onAbrir}>Abrir o requerimento ↗</button>
        {marcado ? <small className="up">✔ {marcado}: vale ao encerrar o mês.</small> : <small className="pn-hint">Sem decisão, o prazo corre e {al.grupo ? 'o grupo' : 'o setor'} se ressente.</small>}
      </div>
    </section>
  )
}

function Passos({ fase }: { fase: FaseReq }): ReactNode {
  const atual = fase === 'aberto' ? 0 : fase === 'pautas' ? 1 : fase === 'acatado' ? 2 : 3
  return (
    <div className="pn-subnav" style={{ flexWrap: 'wrap' }}>
      {FASES.map((f, i) => <span key={f.id} className={i === atual ? 'on' : ''} style={{ padding: '2px 8px', opacity: i < atual ? 0.55 : i === atual ? 1 : 0.7 }}>{i < atual ? '✔ ' : ''}{f.nome}</span>)}
    </div>
  )
}

function Escolha({ on, titulo, children, botao, onClick, motivo, tom }: { on: boolean; titulo: string; children: ReactNode; botao: string; onClick: () => void; motivo?: string | null; tom?: 'up' | 'dn' }): ReactNode {
  return (
    <div className={on ? 'on' : ''} style={{ border: '1px solid var(--pn-line, #8884)', borderRadius: 8, padding: 8, marginTop: 6 }}>
      <b className={tom}>{titulo}</b>
      <div style={{ margin: '4px 0' }}>{children}</div>
      <div className="pn-row">
        <button type="button" className={`pn-btn pn-btn--small ${on ? '' : 'pn-btn--ghost'}`} disabled={!!motivo} title={motivo ?? undefined} onClick={onClick}>{on ? `✔ ${botao} (desfazer)` : botao}</button>
        {motivo && <small className="pn-hint">🔒 {motivo}</small>}
      </div>
    </div>
  )
}

/**
 * v0.47.1 (H4): a janela do requerimento passo a passo. Mostra a fase, o prazo, o custo de cada saída antes de escolher e
 * sempre deixa uma saída (ignorar, desacatar ou desistir). A escolha vale ao encerrar o mês; a reunião é a ação da agenda.
 */
export function RequerimentoJanela({ state, passo, onPasso, onState, onToast, onAtender }: {
  state: GameState
  passo: PassoReq | null
  onPasso: (p: PassoReq | null) => void
  onState: (s: GameState) => void
  onToast: (t: string) => void
  onAtender: (ordem: string) => void
}): ReactNode {
  const a = requerimentoAtivo(state)
  if (!a) return <p className="pn-hint">Nenhum requerimento de setor em andamento. Quando um setor mandar um, ele aparece no Painel e aqui.</p>
  const al = alvoDe(a.setor)
  const tipo = al.grupo ? 'grupo' : 'setor'
  const rec = al.grupo ? null : propostaDef(a.setor)!.recusa
  const setor = setorEstado(state, a.setor)
  const m = mesesDoRequerimento(state)!
  const ministro = ministroDoSetor(state, a.setor)
  const bill = BILL_BY_ID[al.medida]
  const grupo = rec ? GROUP_BY_ID[rec.group].name.toLowerCase() : ''
  const D = REQUERIMENTO.desfecho
  const GD = GRUPO_REQ.desfecho
  const reuniaoOn = peekRound(state)?.acao?.tipo === 'reuniao'
  const custoDescaso = (k: { relacao: number; grupo: number }, g: { tensao: number; queda: number }) => al.grupo
    ? `relação com o grupo ${k.relacao}, tensão +${g.tensao}, aprovação −${g.queda}; a greve fica mais perto`
    : `relação com o setor ${k.relacao}, ${grupo} ${num(rec!.value * k.grupo, 1)}; pode voltar como fato do mês`
  const escolher = (x: PassoReq) => {
    const on = passo?.passo === x.passo && (x.passo !== 'pauta' || (passo as { pauta?: PautaId }).pauta === x.pauta)
    if (on) { onPasso(null); onToast('↩️ Escolha desfeita.'); return }
    if (reuniaoOn) onState(cancelarAcao(state))
    onPasso(x)
    onToast('🗂️ Escolha anotada: vale ao encerrar o mês.')
  }
  const reunir = () => {
    try {
      if (reuniaoOn) { onState(cancelarAcao(state)); onToast('↩️ Reunião desfeita: a medida do mês está livre de novo.'); return }
      onPasso(null)
      onState(escolherAcao(state, { tipo: 'reuniao' }))
      onToast('🗓️ Reunião anotada: vale ao encerrar o mês, no lugar da medida nova.')
    } catch (e) { onToast(`✋ ${(e as Error).message}`) }
  }
  const on = (k: PassoReq['passo'], pauta?: PautaId) => passo?.passo === k && (k !== 'pauta' || (passo as { pauta?: PautaId }).pauta === pauta)
  const motivo = (x: PassoReq) => (on(x.passo, x.passo === 'pauta' ? x.pauta : undefined) ? null : passoBlockedReason(state, x))

  const pautaBox = (id: PautaId): ReactNode => {
    const info = pautaInfo(a.setor, id)
    const chips = effectChips({ groups: info.ganho.groups, confidence: info.ganho.confidence || undefined }, {}).filter((c) => c.text !== 'sem efeito imediato')
    if (info.ganho.baseRelacao) chips.push({ text: `partidos da base +${info.ganho.baseRelacao}`, tone: 'up', title: 'Relação com a base aliada' })
    const par = id === 'limpa' || al.grupo ? null : parecerAdvogado(state, a.setor, info.peso, info.rastro)
    if (info.tensao) chips.push({ text: `🔥 tensão −${Math.abs(info.tensao)}`, tone: 'up', title: `Tensão de ${al.nome}` })
    return (
      <>
        <p style={{ margin: 0 }}>{info.texto}</p>
        {chips.length > 0 && <span className="pn-chips">{chips.map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}</span>}
        {info.rastro > 0
          ? <small className="dn">⚠️ Pesa sobre você (rastro +{info.rastro}) e planta uma semente de risco.{par ? ` Parecer de ${par.advogado}: risco ${par.faixa}.` : ''}</small>
          : <small className="up">Nenhum risco: nada pesa sobre você.</small>}
      </>
    )
  }

  const chance = chanceContra(state, a.setor)
  const faixa = faixaContra(chance)
  const FX = { improvavel: 'improvável', arriscada: 'arriscada', provavel: 'provável' } as const
  const adotarMotivo = sendBlockedReason(state, al.medida)

  return (
    <div>
      <p className="pn-hint">{al.icon} <b>{al.nome}</b>{al.grupo && <> · tensão: <b>{TEXTO_FAIXA[faixaTensao(tensaoOf(state).nivel[al.grupo] ?? 0)]}</b></>} · relação com o governo: <b>{faixaRelacao(setor.relacao)}</b>{setor.ignorados || setor.desacatados ? ` · ${setor.ignorados} ignorado${setor.ignorados === 1 ? '' : 's'}, ${setor.desacatados} desacatado${setor.desacatados === 1 ? '' : 's'}` : ''} · prazo: <b>{mesesTexto(m)}</b></p>
      <Passos fase={a.fase} />

      {a.fase === 'aberto' && <>
        <p className="pn-proposta__pede">“{al.pede}”</p>
        <Escolha on={reuniaoOn} titulo={`Reunir com o ${tipo}`} botao="Anotar a reunião" onClick={reunir} motivo={reuniaoOn ? null : acaoBlockedReason(state, { tipo: 'reuniao' })} tom="up">
          <small>Gasta o espaço de ação do mês, <b>no lugar da medida nova</b>. No mês seguinte o {tipo} devolve duas pautas ({al.rotulos.media.toLowerCase()} e {al.rotulos.duvidosa.toLowerCase()}) e você pode contrapor {al.grupo ? 'o primeiro passo' : 'uma pauta limpa'}.</small>
        </Escolha>
        <Escolha on={on('ignorar')} titulo="Ignorar" botao="Ignorar o requerimento" onClick={() => escolher({ passo: 'ignorar' })} motivo={motivo({ passo: 'ignorar' })}>
          <small>Não custa agenda agora, mas o {tipo} se ressente: {custoDescaso(D.ignorar, GD.ignorar)}. Deixar o prazo vencer custa um pouco menos ({custoDescaso(D.vencer, GD.vencer)}).</small>
        </Escolha>
      </>}

      {a.fase === 'pautas' && <>
        <p className="pn-hint">O {tipo} oferece {a.oferecidas.length === 2 ? 'duas pautas' : 'só uma pauta'}. Você pode escolher uma, contrapor ou desacatar.{a.contra === 'recusada' ? ` O ${tipo} recusou sua contraproposta e endureceu.` : ''}</p>
        {a.oferecidas.includes('media') && <Escolha on={on('pauta', 'media')} titulo={al.rotulos.media} botao="Acatar esta pauta" onClick={() => escolher({ passo: 'pauta', pauta: 'media' })} motivo={motivo({ passo: 'pauta', pauta: 'media' })}>{pautaBox('media')}</Escolha>}
        {a.oferecidas.includes('duvidosa') && <Escolha on={on('pauta', 'duvidosa')} titulo={`${al.rotulos.duvidosa}${al.grupo ? ' (o que o grupo exige)' : ' (a oferta original)'}`} botao="Acatar esta pauta" onClick={() => escolher({ passo: 'pauta', pauta: 'duvidosa' })} motivo={motivo({ passo: 'pauta', pauta: 'duvidosa' })} tom="dn">{pautaBox('duvidosa')}</Escolha>}
        <Escolha on={on('contrapor')} titulo={`Contrapor ${al.grupo ? 'o primeiro passo' : 'a pauta limpa'} · chance ${FX[faixa]}`} botao="Fazer a contraproposta" onClick={() => escolher({ passo: 'contrapor' })} motivo={motivo({ passo: 'contrapor' })}>
          {pautaBox('limpa')}
          <small>Só uma vez. Se o {tipo} recusar, sobra {al.grupo ? 'a pauta cheia' : 'a pauta duvidosa'} ou o desacato. A chance depende da relação e do que já foi ignorado ou desacatado.</small>
        </Escolha>
        <Escolha on={on('desacatar')} titulo="Desacatar" botao="Desacatar o requerimento" onClick={() => escolher({ passo: 'desacatar' })} motivo={motivo({ passo: 'desacatar' })}>
          <small>Encerra o requerimento sem acatar nada: {custoDescaso(D.desacatar, GD.desacatar)}.</small>
        </Escolha>
      </>}

      {(a.fase === 'acatado' || a.fase === 'estruturado') && <>
        <p className="pn-hint">Pauta acatada: <b>{al.rotulos[a.pauta ?? 'media'].toLowerCase()}</b>. A medida do {tipo} é <b>{bill.name}</b> ({INSTRUMENTS[bill.instrument].label}), que entra como a medida do mês.</p>
        {a.fase === 'acatado'
          ? <p className="pn-hint">🧑‍💼 {ministro.name} ({ministro.role}) estrutura a medida e entrega no mês que vem. Adotar antes disso contraria a pasta (desgaste +{REQUERIMENTO.antesDoMinistro.desgaste}).</p>
          : <div className="pn-announce"><small>🧑‍💼 {ministro.name} estruturou a medida e destaca:</small><ul className="causes">{(a.pontos ?? []).map((t, i) => <li key={i}><span>{t}</span></li>)}</ul>{a.ressalva && <small className="warn">⚠️ {a.ressalva}</small>}</div>}
        <span className="pn-chips">{effectChips(bill.effects, {}).map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}</span>
        <div className="pn-row" style={{ marginTop: 8 }}>
          <button type="button" className="pn-btn pn-btn--small" disabled={!!adotarMotivo} title={adotarMotivo ?? 'Leva a medida para o campo da medida do mês. Você ainda confere a leitura do gabinete antes de assinar.'} onClick={() => onAtender(bill.name)}>✍️ Adotar: levar para a medida do mês</button>
          {adotarMotivo && <small className="pn-hint">🔒 {adotarMotivo}</small>}
        </div>
        <Escolha on={on('desistir')} titulo="Desistir" botao="Desistir do requerimento" onClick={() => escolher({ passo: 'desistir' })} motivo={motivo({ passo: 'desistir' })}>
          <small>Depois de acatar, desistir custa mais que recusar antes: {custoDescaso(D.desistir, GD.desistir)}. O prazo vencido conta como falta de resposta ({custoDescaso(D.vencer, GD.vencer)}).</small>
        </Escolha>
      </>}

      {requerimentosOf(state).historico.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary className="pn-hint">Requerimentos anteriores</summary>
          <ul className="causes">{requerimentosOf(state).historico.slice(-5).reverse().map((h, i) => <li key={i}><span>{alvoDe(h.setor).nome}</span><span>{{ adotado: 'adotado', ignorado: 'ignorado', desacatado: 'desacatado', desistiu: 'desistiu', venceu: 'venceu sem resposta' }[h.desfecho]}</span></li>)}</ul>
        </details>
      )}
    </div>
  )
}

