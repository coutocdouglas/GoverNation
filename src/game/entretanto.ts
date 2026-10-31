/**
 * Etapa 1B (v0.17): "Enquanto você decidia".
 * O que a oposição, o empresariado e a Câmara fizeram no mês, com a causa de cada linha.
 * É só leitura: monta o texto a partir do que o fechamento do mês já calculou.
 */
import { BILL_BY_ID } from './data/bills'
import { PARTY_BY_ID } from './data/parties'
import type { Cause, GameState, Headline, Impulse, Meanwhile, VoteRecord } from './types'

const fmt = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const top = <T extends { value: number }>(xs: T[]): T | undefined => [...xs].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]

export interface MeanwhileInput {
  /** Manchetes que o rival gerou no fechamento (ataque, postura, pesquisa). */
  rivalLines: Headline[]
  /** Causas do indicador de confiança do mercado e a variação no mês (pontos). */
  confidenceCauses: Cause[] | undefined
  confidenceDelta: number
  /** Impulsos que o grupo dos empresários recebeu no mês. */
  empresarios: Impulse[]
  /** Votações do fechamento (as da rodada já foram vistas na hora). */
  votes: VoteRecord[]
}

export function buildMeanwhile(s: GameState, input: MeanwhileInput): Meanwhile[] {
  const out: Meanwhile[] = []

  // Oposição
  const r = s.rival
  if (r) {
    const line = input.rivalLines[0]
    const cause = top(r.causes)
    const stance = r.stance === 'obstrucao' ? 'obstrução' : r.stance === 'desgaste' ? 'desgaste' : 'observando'
    out.push({
      who: 'oposicao', icon: '🎯',
      text: line ? line.text : `${r.name}: “${r.quote ?? 'Seguimos acompanhando o governo.'}”`,
      why: `Oposição em ${stance}, força ${Math.round(r.strength)}/100${cause ? ` (maior causa: ${cause.label.toLowerCase()}, ${cause.value > 0 ? '+' : ''}${fmt(cause.value)})` : ''}`,
      tone: line?.tone ?? (r.stance === 'observa' ? 'neutral' : 'bad'),
    })
  }

  // Empresariado
  const cs = top(input.confidenceCauses ?? [])
  if (Math.abs(input.confidenceDelta) >= 0.8) {
    const up = input.confidenceDelta > 0
    out.push({
      who: 'empresariado', icon: '💼',
      text: `Mercado e empresários: a confiança ${up ? 'sobe' : 'cai'} ${fmt(Math.abs(input.confidenceDelta))} ponto${Math.abs(input.confidenceDelta) >= 1.5 ? 's' : ''}`,
      why: cs ? `Maior causa: ${cs.label.toLowerCase()} (${cs.value > 0 ? '+' : ''}${fmt(cs.value)})` : undefined,
      tone: up ? 'good' : 'bad',
    })
  } else {
    const imp = top(input.empresarios)
    out.push({
      who: 'empresariado', icon: '💼',
      text: imp ? `Empresários reagem: ${imp.label.toLowerCase()} (${imp.value > 0 ? '+' : '−'}${fmt(Math.abs(imp.value))})` : 'Empresários e mercado sem sobressaltos este mês',
      why: imp ? 'Soma do que o governo fez e da economia no mês' : 'A confiança do mercado ficou estável',
      tone: imp ? (imp.value > 0 ? 'good' : 'bad') : 'neutral',
    })
  }

  // Câmara
  const v = input.votes.filter((x) => x.house !== 'senado').slice(-1)[0] ?? input.votes.slice(-1)[0]
  if (v) {
    const name = v.title ?? BILL_BY_ID[v.bill]?.name ?? 'projeto'
    const verb = v.kind === 'veto' ? (v.approved ? 'derruba o veto a' : 'mantém o veto a') : v.approved ? 'aprova' : 'rejeita'
    out.push({
      who: 'camara', icon: '🏛️',
      text: `${v.house === 'senado' ? 'Senado' : 'Câmara'} ${verb} ${name.charAt(0).toLowerCase()}${name.slice(1)} (${v.yes} a ${v.no})`,
      why: 'Votação fora da sua pauta, no fechamento do mês (pauta-bomba, veto ou projeto da fila)',
      tone: 'neutral',
    })
  } else if (r && r.stance === 'obstrucao') {
    out.push({
      who: 'camara', icon: '🏛️',
      text: `Na Câmara, o ${PARTY_BY_ID[r.party].sigla} e aliados travam a pauta do governo`,
      why: `${r.name} anunciou obstrução: a oposição usa o regimento`,
      tone: 'bad',
    })
  } else {
    out.push({
      who: 'camara', icon: '🏛️',
      text: `Câmara sem votações fora da sua pauta; ${s.congress.speaker.relation < 40 ? 'o presidente da Câmara segue de mal com o governo' : 'plenário calmo'}`,
      why: 'Nada foi a voto sem o seu aval neste fechamento',
      tone: 'neutral',
    })
  }
  return out
}
