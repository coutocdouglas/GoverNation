/**
 * Etapa 2B (v0.19): a central de pendências do Painel. Junta, por ordem de urgência, o que espera o presidente:
 * cobranças dos grupos, promessas de posse em risco, promessas a partidos, vaga no Supremo, sanção ou veto,
 * MP perto de caducar, liminares e a fila do Congresso. Só lê o estado.
 */
import { ACTION_BY_ID } from './actions'
import { BILL_BY_ID } from './data/bills'
import { CAMARA } from './data/camara'
import { DEMAND_BY_ID } from './data/demands'
import { FLUXO } from './data/fluxo'
import { GROUP_BY_ID } from './data/groups'
import { PARTY_BY_ID } from './data/parties'
import { PROMISE_BY_ID } from './data/promises'
import { absMonth } from './memory'
import { canRenew, dealMonthsLeft, dealStrength } from './congress'
import { DEALS } from './data/deals'
import { promiseStatus } from './promises'
import { TERM_MONTHS } from './game'
import { baseMembers, fidelityOf } from './base'
import { BASE, ESFRIA } from './data/base'
import type { BillId, GameState } from './types'
import { licitacoesAbertas, prazoLicitacao } from './risco'
import { casosAbertos, faixaGravidade } from './caso'
import { cpiAtual } from './cpi'
import { sementeAvisada } from './inteligencia'
import { CPI } from './data/cpi'
import { PRESSAO, pressaoLigada } from './data/pressao'
import { deAuthor, justiceName } from './supremo'
import { TSE_BY_ID } from './data/supremo'

export type Urgency = 'red' | 'yellow' | 'green'
export type PendingTarget = 'evento' | 'camara' | 'senado' | 'supremo' | 'promessas' | 'cobrancas' | 'licitacao' | 'caso' | 'cpi' | 'inteligencia' | 'pressao'

export interface Pendencia {
  id: string
  icon: string
  title: string
  detail: string
  /** Meses até vencer (0 = vence neste mês); sem prazo, undefined. */
  left?: number
  urgency: Urgency
  /** Para onde o clique leva. */
  target: PendingTarget
  /** Peso para ordenar (maior = mais urgente). */
  weight: number
  /** Fase A: texto do pedido que o botão "Atender" leva para o campo da medida do dia. */
  order?: string
  /** v0.27.2: licitação aberta (o clique abre a janela para escolher a empresa). */
  licitacao?: BillId
}

const urgencyOf = (left: number | undefined, grave: boolean): Urgency =>
  left !== undefined && left <= 1 ? 'red' : grave || (left !== undefined && left <= 3) ? 'yellow' : 'green'

const leftText = (left: number) => (left <= 0 ? 'vence agora' : `${left} ${left === 1 ? 'mês' : 'meses'}`)

/** O pedido de uma cobrança, em palavras que o gabinete entende: a primeira medida ou decreto que atende. */
export function orderOfDemand(def: { title: string; satisfiedBy: readonly string[] }): string {
  for (const x of def.satisfiedBy) {
    if (x in BILL_BY_ID) return BILL_BY_ID[x as keyof typeof BILL_BY_ID].name
    const a = ACTION_BY_ID[x as keyof typeof ACTION_BY_ID]
    if (a) return a.name
  }
  return def.title
}

export function pendencias(s: GameState): Pendencia[] {
  const out: Pendencia[] = []
  const now = absMonth(s)
  const c = s.congress

  // Cobranças dos grupos (prazo, recompensa e penalidade).
  for (const d of s.demands) {
    const def = DEMAND_BY_ID[d.id]
    if (!def) continue
    const left = d.expires - s.month
    out.push({
      id: `dem-${d.id}`, icon: '📣', title: def.title, target: 'cobrancas', left,
      detail: `${GROUP_BY_ID[def.group].name} cobra · ${leftText(left)} · +${def.reward} / −${def.penalty} · atende: ${def.satisfiedBy.map((x) => (x in BILL_BY_ID ? BILL_BY_ID[x as keyof typeof BILL_BY_ID].name : ACTION_BY_ID[x as keyof typeof ACTION_BY_ID]?.name ?? x)).join(' ou ')}`,
      urgency: urgencyOf(left, def.penalty >= 4), weight: 50 - left * 6 + def.penalty,
      order: orderOfDemand(def),
    })
  }

  // v0.27.2: licitação aberta (a medida passou a valer e espera a escolha da empresa).
  for (const l of licitacoesAbertas(s)) {
    const left = prazoLicitacao(l) - now
    out.push({
      id: `lic-${l.bill}`, icon: '🏗️', target: 'licitacao', left, licitacao: l.bill,
      title: `Licitação: ${BILL_BY_ID[l.bill].name}`,
      detail: `Escolha quem executa (${l.empresas.length} empresas) · ${leftText(left)} · sem escolha, fica a empresa de sempre`,
      urgency: urgencyOf(left, false), weight: 45 - left * 6,
    })
  }

  // v0.36.1 (6D): pressão sobre uma medida da fila. Sem resposta, cresce todo mês; deixar passar também é uma saída.
  const pr = pressaoLigada() ? s.pressao?.ativa : null
  if (pr) {
    const left = Math.max(0, pr.ate - now)
    out.push({
      id: `pressao-${pr.bill}`, icon: PRESSAO.tipos[pr.tipo].icon, target: 'pressao', left,
      title: `${PRESSAO.tipos[pr.tipo].nome} contra: ${BILL_BY_ID[pr.bill]?.name ?? pr.bill}`,
      detail: pr.resposta ? `Você respondeu (${pr.resposta}) · esfria em ${leftText(left)}` : `Tira votos da medida · enfrentar, negociar, adiar ou retirar · sem resposta, cresce todo mês`,
      urgency: pr.resposta ? 'green' : left <= 1 ? 'red' : 'yellow', weight: pr.resposta ? 20 : 48,
    })
  }

  // Etapa 5C (v0.32.0): o serviço de inteligência avisa de um vazamento ou de um pedido de CPI.
  const intel = s.inteligencia
  if (intel?.ativo && intel.aviso && sementeAvisada(s)) {
    const left = Math.max(0, intel.aviso.vazaEm - absMonth(s))
    out.push({
      id: `aviso-${intel.aviso.semente}`, icon: '📡', target: 'inteligencia',
      title: `O serviço avisa: ${sementeAvisada(s)!.quem} deve vazar`,
      detail: `${left <= 0 ? 'neste fechamento' : `em ${left} mês${left > 1 ? 'es' : ''}`} · dá para tentar abafar (com risco) ou deixar o golpe vir menor`,
      urgency: left <= 1 ? 'red' : 'yellow', weight: 44,
    })
  }
  if (intel?.ativo && intel.avisoCpi) {
    out.push({
      id: `aviso-cpi-${intel.avisoCpi.caso}`, icon: '📡', target: 'inteligencia',
      title: 'O serviço avisa: a oposição prepara pedido de CPI',
      detail: 'O pedido começa com menos assinaturas por causa do aviso',
      urgency: 'yellow', weight: 30,
    })
  }

  // Etapa 5C (v0.29.1): pedido de CPI ou CPI instalada. Sem prazo do jogador: deixar passar também é uma decisão.
  const cpi = cpiAtual(s)
  if (cpi) {
    const coleta = cpi.fase === 'coleta'
    out.push({
      id: `cpi-${cpi.caso}`, icon: '🏛️', target: 'cpi',
      title: `${coleta ? 'Pedido de CPI' : 'CPI em andamento'}: ${cpi.alvo}`,
      detail: coleta ? `${cpi.assinaturas} de ${CPI.assinaturas} assinaturas · agir ou deixar passar` : `Provas ${Math.round(cpi.provas ?? 0)}/100 · comissão ${CPI.tons[cpi.tom ?? 1].rotulo} · agir ou deixar passar`,
      urgency: (coleta ? cpi.assinaturas >= CPI.assinaturas * 0.8 : (cpi.provas ?? 0) >= 60) ? 'red' : 'yellow', weight: 46,
    })
  }

  // Etapa 5B (v0.28.1): caso aberto (na PF ou no Supremo). Sem prazo: deixar passar também é uma decisão.
  for (const k of casosAbertos(s)) {
    const grave = faixaGravidade(k.gravidade) === 'grave'
    out.push({
      id: `caso-${k.id}`, icon: k.fase === 'supremo' ? '🏛️' : '🕵️', target: 'caso',
      title: `${k.fase === 'supremo' ? 'Caso no Supremo' : 'Caso na PF'}: ${k.alvo}`,
      detail: `Provas ${Math.round(k.provas)}/100 · caso ${grave ? 'grave' : faixaGravidade(k.gravidade) === 'medio' ? 'médio' : 'leve'} · agir ou deixar passar`,
      urgency: grave || k.provas >= 60 ? 'red' : 'yellow', weight: 47 + (grave ? 5 : 0),
    })
  }

  // Sanção ou veto esperando a caneta.
  for (const it of c.toSanction) {
    out.push({
      id: `san-${it.id}`, icon: '🖋️', target: 'camara', left: 0,
      title: it.kind === 'bomba' ? `Sancionar ou vetar: ${BILL_BY_ID[it.bill].name}` : `Jabuti em “${BILL_BY_ID[it.bill].name}”`,
      detail: 'Sem decisão até o fim do mês, vale a sanção tácita.', urgency: 'red', weight: 60,
    })
  }

  // MP perto de caducar.
  for (const p of c.pending) {
    if (BILL_BY_ID[p.id]?.instrument !== 'mp') continue
    const left = CAMARA.mpDeadline - 1 - (s.month - p.sentMonth)
    out.push({
      id: `mp-${p.id}`, icon: '⚡', target: 'camara', left,
      title: `MP na fila: ${BILL_BY_ID[p.id].name}`,
      detail: left <= 0 ? 'Caduca no fim deste mês se não for pautada.' : `Caduca em ${leftText(left)} sem votação.`,
      urgency: urgencyOf(left, false), weight: 55 - left * 8,
    })
  }

  // Vaga no Supremo.
  if (s.supremo.vacancy) {
    out.push({ id: 'stf-vaga', icon: '⚖️', target: 'supremo', title: 'Vaga no Supremo: indicar um ministro', detail: 'A sabatina é no Senado (41 votos). Quem senta ali julga as suas medidas por anos.', urgency: 'yellow', weight: 40 })
  }

  // Etapa 4 (v0.23): "O Supremo pede você" (cadeira de jurista no tribunal eleitoral) e embargos que vencem.
  const tse = s.supremo.tse
  if (tse?.open) {
    out.push({ id: 'tse', icon: '🗳️', target: 'supremo', left: 0, title: 'O Supremo pede você: jurista no tribunal eleitoral', detail: `A lista chegou. Decida neste mês; sem decisão, ${TSE_BY_ID[tse.seat]?.name ?? 'quem está'} é reconduzid${TSE_BY_ID[tse.seat]?.feminine ? 'a' : 'o'}. Quem senta ali julga a sua campanha.`, urgency: 'red', weight: 58 })
  }
  for (const m of s.supremo.modulated ?? []) {
    const left = m.until - now
    out.push({ id: `emb-${m.bill}`, icon: '📜', target: 'supremo', left, title: `Embargos: ${m.name} vale até cair`, detail: `O Supremo modulou os efeitos: a medida cai em ${leftText(left)}.`, urgency: urgencyOf(left, false), weight: 30 - left })
  }

  // Etapa 3: pedido de impeachment de ministro no Senado (vota no fechamento deste mês).
  const imp = c.senate.impeach
  if (imp) {
    out.push({ id: 'impeach', icon: '⚖️', target: 'senado', left: 0, title: `Impeachment de ${imp.minister} no Senado`, detail: 'Vota no fechamento do mês (54 afastam). Defender, demitir antes ou deixar o Senado decidir: no fato do mês.', urgency: 'red', weight: 60 })
  }

  // Liminar segurando uma medida.
  for (const k of s.supremo.cases.filter((x) => x.suspended && !x.vista)) {
    const name = BILL_BY_ID[k.bill]?.name ?? k.bill
    out.push({ id: `lim-${k.id}`, icon: '🚫', target: 'supremo', left: Math.max(0, k.judgeAt - now), title: k.kind === 'projeto' ? `Projeto travado no Supremo: ${name}` : `Liminar suspende: ${name}`, detail: `Ação ${deAuthor(k)}; o plenário julga em breve.`, urgency: 'yellow', weight: 38 })
  }
  // Etapa 4: julgamento parado por pedido de vista (dá para trabalhar o plenário ou recuar até voltar).
  for (const k of s.supremo.cases.filter((x) => x.vista)) {
    const name = BILL_BY_ID[k.bill]?.name ?? k.bill
    out.push({ id: `vista-${k.id}`, icon: '⏸️', target: 'supremo', left: Math.max(0, k.judgeAt - now), title: `Vista no Supremo: ${name}`, detail: `${justiceName(k.vista!.justice)} pediu vista${k.suspended && k.kind !== 'projeto' ? '; a medida segue suspensa' : ''}. Até voltar, dá para trabalhar o plenário ou recuar.`, urgency: k.judgeAt - now <= 1 ? 'red' : 'yellow', weight: 39 })
  }

  // Promessas a partidos (pauta, espaço) com prazo.
  for (const p of c.promises) {
    const left = p.due - s.month
    out.push({
      id: `prom-${p.party}-${p.bill}`, icon: '🤝', target: 'camara', left,
      title: p.kind === 'espaco' ? `Espaço prometido ao ${PARTY_BY_ID[p.party].sigla}`
        : p.kind === 'favor' ? `Favor devido ao ${PARTY_BY_ID[p.party].sigla}`
          : p.kind === 'sancionar' ? `Não vetar nada do ${PARTY_BY_ID[p.party].sigla}`
            : `Pautar ${BILL_BY_ID[p.bill]?.name ?? p.bill} (promessa ao ${PARTY_BY_ID[p.party].sigla})`,
      detail: p.kind === 'favor' ? `${leftText(left)} · paga com um acordo de dinheiro, cargo ou pasta para o partido.`
        : p.kind === 'sancionar' ? `${leftText(left)} · vetar algo do partido quebra o acordo.`
          : `${leftText(left)} · quebrar custa relação e reputação.`,
      urgency: p.kind === 'sancionar' ? 'green' : urgencyOf(left, false), weight: 42 - left * 5,
    })
  }

  // Promessas de posse em risco ou longe da meta.
  const monthsLeft = TERM_MONTHS - 1 - s.month
  for (const id of s.promises ?? []) {
    const def = PROMISE_BY_ID[id]
    if (!def) continue
    const st = promiseStatus(s, def)
    if (st.status !== 'risco' && st.status !== 'longe') continue
    // No começo do mandato, a promessa fica só no cartão de promessas; vira pendência na reta final.
    if (monthsLeft > FLUXO.promiseWindow) continue
    out.push({
      id: `posse-${id}`, icon: '🎯', target: 'promessas',
      title: `Promessa de posse ${st.status === 'longe' ? 'longe da meta' : 'em risco'}: ${def.name}`,
      detail: `Cobrada no fim do mandato (faltam ${monthsLeft} meses).`,
      urgency: st.status === 'longe' && monthsLeft <= 12 ? 'red' : 'yellow', weight: (st.status === 'longe' ? 30 : 22) + Math.max(0, 12 - monthsLeft),
    })
  }

  // Etapa 2C: a base rachando (fidelidade baixa) e pactos que acabam.
  for (const m of baseMembers(s)) {
    const fid = fidelityOf(s, m.party)
    const sigla = PARTY_BY_ID[m.party].sigla
    if (fid < BASE.warnAt) {
      out.push({
        id: `base-${m.party}`, icon: '🧱', target: 'camara',
        title: fid < BASE.dropAt ? `${sigla} rachou com o governo (fidelidade ${Math.round(fid)})` : `${sigla} está rachando (fidelidade ${Math.round(fid)})`,
        detail: m.via === 'pasta' ? 'Renegocie (acordos, conversa) ou retome a pasta na aba Ministérios.' : 'O pacto não segura a bancada: converse ou deixe o pacto acabar.',
        urgency: fid < BASE.dropAt ? 'red' : 'yellow', weight: 45 - fid / 3,
      })
    }
    if (m.pact && m.pact.until - s.month <= 1) {
      out.push({ id: `pacto-${m.party}`, icon: '📜', target: 'camara', left: m.pact.until - s.month - 1, title: `Pacto com o ${sigla} acaba`, detail: 'Dá para assinar outro na aba Câmara, se o partido topar.', urgency: 'green', weight: 12 })
    }
  }
  // Etapa 2C: projetos que esfriam na fila (arquivados depois de 6 rodadas).
  for (const p of [...c.pending, ...c.senate.pending]) {
    if (BILL_BY_ID[p.id]?.instrument === 'mp') continue
    const left = ESFRIA.archiveAfter - 1 - (s.month - p.sentMonth)
    if (left > 2) continue
    out.push({ id: `esfria-${p.id}`, icon: '🧊', target: c.pending.includes(p) ? 'camara' : 'senado', left, title: `Esfriando na fila: ${BILL_BY_ID[p.id]?.name ?? p.id}`, detail: left <= 0 ? 'É arquivado no fim deste mês se não for votado.' : `Arquivado em ${leftText(left)} sem votação.`, urgency: urgencyOf(left, false), weight: 36 - left * 6 })
  }

  // v0.32.1 (6.0): acordo guardado numa medida da fila que esfriou ou está para vencer (renovar custa menos que fechar de novo).
  for (const p of [...c.pending, ...c.senate.pending]) {
    const naCamara = c.pending.includes(p)
    const acordos = naCamara ? [...(p.deals ?? []), ...(p.senateDeals ?? [])] : (p.deals ?? [])
    const velhos = acordos.filter((d) => d.month !== undefined && canRenew(d, s.month))
    if (velhos.length === 0) continue
    const left = Math.min(...velhos.map((d) => dealMonthsLeft(d, s.month)))
    const siglas = [...new Set(velhos.map((d) => PARTY_BY_ID[d.party].sigla))].join(', ')
    const forca = Math.round(Math.min(...velhos.map((d) => dealStrength(d, s.month))) * 100)
    out.push({
      id: `acordo-${p.id}`, icon: '🤝', target: naCamara ? 'camara' : 'senado', left,
      title: `Acordo para vencer: ${BILL_BY_ID[p.id]?.name ?? p.id} (${siglas})`,
      detail: `${left <= 0 ? 'Já não segura voto' : `Perde o efeito em ${leftText(left)}`} · força ${forca}% · renovar custa ${Math.round(DEALS.validade.renewPrice * 100)}% do preço e gasta uma conversa da rodada`,
      urgency: urgencyOf(left, false), weight: 41 - left * 5,
    })
  }

  // Fila do Congresso (projetos esperando pauta).
  const fila = c.pending.filter((p) => BILL_BY_ID[p.id]?.instrument !== 'mp').length + c.senate.pending.length
  if (fila > 0) out.push({ id: 'fila', icon: '🏛️', target: 'camara', title: `${fila} projeto${fila > 1 ? 's' : ''} na fila do Congresso`, detail: 'Dá para pautar um por casa a cada rodada.', urgency: 'green', weight: 10 })

  const rank: Record<Urgency, number> = { red: 0, yellow: 1, green: 2 }
  return out.sort((a, z) => rank[a.urgency] - rank[z.urgency] || z.weight - a.weight)
}
