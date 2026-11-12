/**
 * Impeachment do presidente (v0.43.0, regras; telas na v0.43.1). DESIGN.md 27.41; números em data/impeachPres.ts.
 *
 * Pressão oculta (0 a 100) → pedido da oposição → o presidente da Câmara abre ou engaveta → Câmara (342) →
 * Senado (54, vice interino) → absolvido ou condenado (o mandato termina). Uma decisão por mês, sempre com saída:
 * deixar passar é permitido em toda fase. Tudo deixa semente, biografia e crônica.
 */
import { baseMembers, fidelityOf } from './base'
import { advogadoAtual, envolvePresidente, hitTodos } from './caso'
import { bumpScandal } from './causas'
import { forecastChamberAgainst, forecastSenateAgainst, runChamberAgainst, runSenateAgainst, type Forecast } from './congress'
import type { BillDef } from './data/bills'
import { IMPEACH_PRES as K, impeachPresLigado, pistaPressao, type AcaoImpeach, type DesfechoImpeach, type FaseImpeach } from './data/impeachPres'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { overallApproval } from './groups'
import { clamp } from './ideology'
import { absMonth, addBio, addChronicle } from './memory'
import { noteRecord } from './reputacao'
import { Rng } from './rng'
import { viceDef } from './governo'
import type { Cause, GameState, GroupId, Headline, Impulse, PartyId } from './types'

export type { AcaoImpeach, DesfechoImpeach, FaseImpeach }

export interface ImpeachPresState {
  /** Oculta: a tela só mostra a pista em palavras. */
  pressao: number
  fase: FaseImpeach
  /** Mês absoluto em que a fase atual começou. */
  desde: number
  /** Registros já somados à pressão (para contar cada um uma só vez). */
  contados: { cpi: number; denuncias: number; descumpriu: number }
  /** Motivos do pedido, em palavras (aparecem na tela e na biografia). */
  motivos: string[]
  mesaNegociou?: boolean
  ruaUsada?: boolean
  /** O presidente está afastado e o vice assumiu como interino (fase do Senado). */
  afastado?: boolean
  historico: { abertoEm: number; fim: number; desfecho: DesfechoImpeach }[]
  /** Mês absoluto do fim do último processo. */
  ultimoFim: number
}

export const initialImpeachPres = (): ImpeachPresState => ({
  pressao: 0, fase: 'nenhum', desde: -99, contados: { cpi: 0, denuncias: 0, descumpriu: 0 }, motivos: [], historico: [], ultimoFim: -99,
})
export const impeachPresOf = (s: GameState): ImpeachPresState => (s.impeachPres ??= initialImpeachPres())
export const processoAtivo = (s: GameState) => s.impeachPres != null && s.impeachPres.fase !== 'nenhum'

const round1 = (x: number) => Math.round(x * 10) / 10

/** Casos abertos que atingem o presidente. */
const casosDoPresidente = (s: GameState) => (s.investigacao?.casos ?? []).filter((c) => c.fase !== 'encerrado' && envolvePresidente(c))

/** Motivos de hoje, em palavras, do mais pesado ao menos. */
export function motivosAtuais(s: GameState): string[] {
  const out: string[] = []
  if ((s.comissoes?.contraPresidente.length ?? 0) > 0) out.push('Relatório de CPI que atinge o presidente')
  if ((s.investigacao?.denuncias.length ?? 0) > 0) out.push('Denúncia da PGR contra o presidente')
  if (casosDoPresidente(s).length > 0) out.push('Investigação aberta que o atinge')
  if ((s.supremo?.defied.length ?? 0) > 0) out.push('Decisão do Supremo descumprida')
  if (s.governo?.vice.rompeu) out.push('Vice rompido, falando como alternativa')
  if (overallApproval(s.groups) < K.pressao.aprovacaoBaixa) out.push('Aprovação muito baixa')
  if (s.congress.scandal >= K.pressao.escandaloAcima) out.push('Escândalos acumulados')
  return out
}

/** Soma o que aconteceu no mês à pressão. Devolve as linhas de causa para a memória. */
export function atualizarPressao(s: GameState): number {
  const st = impeachPresOf(s)
  const P = K.pressao
  const appr = overallApproval(s.groups)
  let d = 0
  if (appr < P.aprovacaoBaixa) d += (P.aprovacaoBaixa - appr) * P.porPontoBaixa
  else if (appr > P.aprovacaoCalma) d -= (appr - P.aprovacaoCalma) * P.porPontoCalma
  if (s.congress.scandal > P.escandaloAcima) d += (s.congress.scandal - P.escandaloAcima) * P.porPontoEscandalo
  const forca = s.rival?.strength ?? 0
  if (forca > P.rivalAcima) d += (forca - P.rivalAcima) * P.porPontoRival
  if (s.governo?.vice.rompeu) d += P.viceRompido
  d += casosDoPresidente(s).length * P.casoPresidente
  // Registros novos contam uma só vez.
  const cpi = s.comissoes?.contraPresidente.length ?? 0
  const den = s.investigacao?.denuncias.length ?? 0
  const desc = s.supremo?.defied.length ?? 0
  if (cpi > st.contados.cpi) d += (cpi - st.contados.cpi) * P.cpiContra
  if (den > st.contados.denuncias) d += (den - st.contados.denuncias) * P.denuncia
  if (desc > st.contados.descumpriu) d += (desc - st.contados.descumpriu) * P.descumpriu
  st.contados = { cpi, denuncias: den, descumpriu: desc }
  d -= P.esquecimento
  st.pressao = clamp(round1(st.pressao + d), 0, P.teto)
  return d
}

// ─── Votação ──────────────────────────────────────────────────────────────────

/** A votação vista como um "projeto": a posição do partido do líder da oposição, puxada para o centro. */
function impeachBill(s: GameState): BillDef {
  const rp = PARTY_BY_ID[s.rival?.party ?? (s.playerParty === 'fpt' ? 'pol' : 'fpt')]
  return {
    id: 'impeach-presidente', area: 'politica', name: `Impeachment: ${s.presidentName}`, summary: 'Crime de responsabilidade', instrument: 'complementar',
    econ: rp.econ * 0.6, costumes: rp.costumes * 0.6, pros: '', cons: '', effects: {}, keywords: [],
  }
}

/** Viés contra o presidente: a pressão empurra todos; a fidelidade da base protege; cobrar a base reforça. */
function boostContra(s: GameState, reforco: number): Partial<Record<PartyId, number>> {
  const st = impeachPresOf(s)
  const V = K.votacao
  const base = new Set(baseMembers(s).map((m) => m.party))
  const b: Partial<Record<PartyId, number>> = {}
  for (const p of PARTIES) {
    let v = (st.pressao - 50) * V.biasPorPressao - reforco
    if (base.has(p.id)) v -= (fidelityOf(s, p.id) / 100) * V.protecaoBase
    b[p.id] = round1(v * 1000) / 1000
  }
  return b
}

/** Previsão do voto da fase atual (Câmara ou Senado), ou null fora delas. */
export function previsaoImpeach(s: GameState, acao?: AcaoImpeach): Forecast | null {
  const st = impeachPresOf(s)
  const reforco = acao === 'base' ? K.acoes.base.reforco : 0
  if (st.fase === 'camara') return forecastChamberAgainst(s, impeachBill(s), boostContra(s, reforco), K.votacao.camaraNecessarios, K.votacao.orientFactor)
  if (st.fase === 'senado') return forecastSenateAgainst(s, impeachBill(s), boostContra(s, reforco), K.votacao.senadoNecessarios, K.votacao.orientFactor)
  return null
}

/** Chance de o presidente da Câmara abrir o processo (0 a 1). */
export function chanceDeAbrir(s: GameState, negociou = false): number {
  const M = K.mesa
  const st = impeachPresOf(s)
  const sp = s.congress.speaker
  const naBase = baseMembers(s).some((m) => m.party === sp.party) || sp.party === s.playerParty
  let p = M.base + (st.pressao / 100) * M.porPressao - ((sp.relation - 50) / 100) * M.porRelacao - (naBase ? M.naBase : 0)
  if (negociou || st.mesaNegociou) p -= M.negociar
  return clamp(p, 0.03, 0.97)
}

// ─── Decisão do mês ───────────────────────────────────────────────────────────

/** Motivo pelo qual a ação não vale agora, ou null. */
export function impeachBlockedReason(s: GameState, acao: AcaoImpeach): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const st = impeachPresOf(s)
  if (st.fase === 'nenhum') return 'Não há processo em andamento.'
  if (acao === 'mesa') {
    if (st.fase !== 'pedido') return 'O presidente da Câmara só decide na fase do pedido.'
    if (st.mesaNegociou) return 'Você já negociou com o presidente da Câmara.'
  }
  if (acao === 'base' && st.fase === 'pedido') return 'A base só vota quando o processo chega ao plenário.'
  if (acao === 'rua' && st.ruaUsada) return 'O ato de rua já foi feito neste processo.'
  return null
}

/** Efeito de cada ação em palavras, para a tela e para o custo à vista. */
export function opcoesImpeach(): { acao: AcaoImpeach; nome: string; efeito: string; custo: string[] }[] {
  const A = K.acoes
  return [
    { acao: 'mesa', nome: 'Negociar com o presidente da Câmara', efeito: 'Diminui a chance de ele abrir o processo.', custo: ['ele não vende se a relação com o governo está muito ruim', 'a imprensa chama de acordão'] },
    { acao: 'base', nome: 'Cobrar a base', efeito: 'Reforça os votos contra o afastamento na votação do mês.', custo: [`${Math.round(A.base.escandaloChance * 100)}% de chance de virar escândalo de compra de votos`, 'a opinião pública estranha'] },
    { acao: 'defesa', nome: 'Defesa jurídica', efeito: 'O advogado enfraquece a acusação (a eficiência dele conta).', custo: ['chama atenção para o caso'] },
    { acao: 'rua', nome: 'Ato de rua', efeito: 'Com aprovação decente, a rua pesa a favor.', custo: [`com aprovação abaixo de ${A.rua.aprovacaoMin}% vira fiasco e a pressão sobe`, 'só uma vez por processo'] },
  ]
}

function aplicarAcao(s: GameState, acao: AcaoImpeach, impulses: Record<GroupId, Impulse[]>, headlines: Headline[], rivalExtra: Cause[], taken: string[], rng: Rng): { reforco: number } {
  const st = impeachPresOf(s)
  const A = K.acoes
  let reforco = 0
  if (acao === 'mesa') {
    const sp = s.congress.speaker
    if (sp.relation < K.mesa.relacaoMin) {
      taken.push(`Procurou ${sp.name}, que não quis conversar`)
      headlines.push({ text: `${sp.name} recusa conversar com o governo sobre o pedido de impeachment`, tone: 'bad' })
      rivalExtra.push({ label: 'Presidente da Câmara fecha a porta ao governo', value: A.mesa.rival })
    } else {
      st.mesaNegociou = true
      taken.push(`Negociou o pedido de impeachment com ${sp.name}`)
      hitTodos(impulses, 'Acordão para segurar o impeachment', A.mesa.grupos)
      rivalExtra.push({ label: 'Governo negocia o impeachment com a presidência da Câmara', value: A.mesa.rival })
    }
  } else if (acao === 'base') {
    reforco = A.base.reforco
    taken.push('Cobrou a base contra o afastamento do presidente')
    hitTodos(impulses, 'Governo corre atrás de votos contra o impeachment', A.base.grupos)
    if (rng.next() < A.base.escandaloChance) {
      bumpScandal(s, A.base.escandalo, 'Cobrança da base contra o impeachment vira denúncia de compra de votos', 'outro')
      headlines.push({ text: 'Governo é acusado de comprar votos contra o impeachment', tone: 'bad' })
    }
  } else if (acao === 'defesa') {
    const adv = advogadoAtual(s)
    st.pressao = clamp(round1(st.pressao + A.defesa.pressao * (0.5 + adv.eficiencia)), 0, K.pressao.teto)
    taken.push(`Montou a defesa jurídica com ${adv.name}`)
    bumpScandal(s, A.defesa.escandalo, 'A defesa jurídica no impeachment chama atenção para o caso', 'outro')
    hitTodos(impulses, 'Defesa jurídica no impeachment', A.defesa.grupos)
  } else if (acao === 'rua') {
    st.ruaUsada = true
    const appr = overallApproval(s.groups)
    if (appr >= A.rua.aprovacaoMin) {
      st.pressao = clamp(round1(st.pressao + A.rua.pressaoBom), 0, K.pressao.teto)
      hitTodos(impulses, 'Ato de rua em defesa do mandato', A.rua.gruposBom)
      headlines.push({ text: 'Apoiadores lotam as ruas em defesa do mandato', tone: 'good' })
    } else {
      st.pressao = clamp(round1(st.pressao + A.rua.pressaoFiasco), 0, K.pressao.teto)
      hitTodos(impulses, 'Ato de rua esvaziado', A.rua.gruposFiasco)
      headlines.push({ text: 'Ato em defesa do governo sai esvaziado e a oposição comemora', tone: 'bad' })
    }
    taken.push('Convocou um ato de rua em defesa do mandato')
  }
  return { reforco }
}

// ─── Fechamento do mês ────────────────────────────────────────────────────────

function fechar(s: GameState, desfecho: DesfechoImpeach): void {
  const st = impeachPresOf(s)
  const agora = absMonth(s)
  st.historico.push({ abertoEm: st.desde, fim: agora, desfecho })
  st.fase = 'nenhum'
  st.desde = agora
  st.ultimoFim = agora
  st.mesaNegociou = false
  st.ruaUsada = false
  st.afastado = false
}

function abrirPedido(s: GameState, headlines: Headline[]): void {
  const st = impeachPresOf(s)
  st.fase = 'pedido'
  st.desde = absMonth(s)
  st.motivos = motivosAtuais(s)
  st.mesaNegociou = false
  st.ruaUsada = false
  const sp = s.congress.speaker
  headlines.push({ text: `Oposição protocola pedido de impeachment contra ${s.presidentName}. A decisão é de ${sp.name}, presidente da Câmara`, tone: 'bad' })
  noteRecord(s, { text: 'A oposição protocolou um pedido de impeachment contra o presidente', tone: 'bad', kind: 'crise' })
  addBio(s, s.presidentName, `Foi alvo de um pedido de impeachment protocolado pela oposição (${st.motivos.slice(0, 3).join('; ') || 'sem motivo claro'}).`)
  addChronicle(s, `Pedido de impeachment contra ${s.presidentName}`, 'bad')
}

/**
 * Fecha o mês do impeachment do presidente: pressão, pedido, decisão da Câmara, votos e desfecho.
 * Só mexe no estado quando ligado. A condenação marca `s.finished` (o fechamento do mês encerra o mandato).
 */
export function stepImpeachPres(s: GameState, acao: AcaoImpeach | undefined, impulses: Record<GroupId, Impulse[]>, headlines: Headline[], rivalExtra: Cause[], taken: string[], rng: Rng): void {
  if (!impeachPresLigado()) return
  const st = impeachPresOf(s)
  const agora = absMonth(s)
  atualizarPressao(s)
  let reforco = 0
  if (acao && !impeachBlockedReason(s, acao)) reforco = aplicarAcao(s, acao, impulses, headlines, rivalExtra, taken, rng).reforco

  if (st.fase === 'nenhum') {
    if (agora < K.inicioMes) return
    if (agora - st.ultimoFim < K.intervalo) return
    if (st.historico.length >= K.maxMandato) return
    if (st.pressao >= K.pedido.pressaoMin && rng.next() < K.pedido.chance) abrirPedido(s, headlines)
    return
  }

  if (st.fase === 'pedido') {
    if (agora - st.desde < K.mesa.meses) return
    const sp = s.congress.speaker
    if (rng.next() < chanceDeAbrir(s)) {
      st.fase = 'camara'
      st.desde = agora
      headlines.push({ text: `${sp.name} aceita o pedido e leva o impeachment de ${s.presidentName} ao plenário da Câmara`, tone: 'bad' })
      addChronicle(s, `Câmara abre o processo de impeachment de ${s.presidentName}`, 'bad')
      noteRecord(s, { text: 'O presidente da Câmara aceitou o pedido de impeachment', tone: 'bad', kind: 'crise' })
    } else {
      st.pressao = clamp(st.pressao + K.mesa.engavetadoPressao, 0, K.pressao.teto)
      rivalExtra.push({ label: 'Pedido de impeachment engavetado', value: K.mesa.engavetadoRival })
      headlines.push({ text: `${sp.name} engaveta o pedido de impeachment contra ${s.presidentName}`, tone: 'good' })
      addBio(s, s.presidentName, 'Viu um pedido de impeachment engavetado pela presidência da Câmara.')
      noteRecord(s, { text: 'Um pedido de impeachment foi engavetado na Câmara', tone: 'good', kind: 'outro' })
      fechar(s, 'engavetado')
    }
    return
  }

  if (st.fase === 'camara') {
    if (agora - st.desde < 1) return
    const v = runChamberAgainst(s, impeachBill(s), boostContra(s, reforco), K.votacao.camaraNecessarios, K.votacao.orientFactor, rng, `Impeachment: ${s.presidentName}`)
    s.congress.votes.push(v)
    if (v.approved) {
      st.fase = 'senado'
      st.desde = agora
      st.afastado = true
      const vice = s.governo ? viceDef(s)?.name : undefined
      headlines.push({ text: `Câmara autoriza o processo de impeachment de ${s.presidentName}: ${v.yes} votos. ${vice ? `${vice} assume como interino` : 'O vice assume como interino'} enquanto o Senado julga`, tone: 'bad' })
      addBio(s, s.presidentName, `Teve o processo de impeachment autorizado pela Câmara (${v.yes} votos, eram precisos ${K.votacao.camaraNecessarios}).`)
      addChronicle(s, `Câmara autoriza o impeachment de ${s.presidentName}`, 'bad')
      noteRecord(s, { text: `A Câmara autorizou o impeachment (${v.yes} de ${K.votacao.camaraNecessarios} votos)`, tone: 'bad', kind: 'derrota' })
    } else {
      st.pressao = K.desfecho.barradoPressao
      rivalExtra.push({ label: 'Governo vence o impeachment na Câmara', value: K.desfecho.barradoRival })
      headlines.push({ text: `Câmara rejeita o impeachment de ${s.presidentName}: ${v.yes} votos, eram precisos ${K.votacao.camaraNecessarios}`, tone: 'good' })
      addBio(s, s.presidentName, `Barrou na Câmara um pedido de impeachment (${v.yes} votos, eram precisos ${K.votacao.camaraNecessarios}).`)
      noteRecord(s, { text: `Barrou o impeachment na Câmara (${v.yes} de ${K.votacao.camaraNecessarios} votos)`, tone: 'good', kind: 'outro' })
      fechar(s, 'barrado')
    }
    return
  }

  // Senado.
  if (agora - st.desde < K.votacao.mesesSenado) return
  const v = runSenateAgainst(s, impeachBill(s), boostContra(s, reforco), K.votacao.senadoNecessarios, K.votacao.orientFactor, rng, `Impeachment: ${s.presidentName}`)
  s.congress.votes.push(v)
  if (v.approved) {
    headlines.push({ text: `Senado condena ${s.presidentName} por crime de responsabilidade: ${v.yes} votos. O mandato termina`, tone: 'bad' })
    addBio(s, s.presidentName, `Foi condenado pelo Senado em processo de impeachment (${v.yes} votos, eram precisos ${K.votacao.senadoNecessarios}) e perdeu o mandato.`)
    addChronicle(s, `Senado condena ${s.presidentName} e encerra o mandato`, 'bad')
    noteRecord(s, { text: `O Senado condenou o presidente (${v.yes} de ${K.votacao.senadoNecessarios} votos)`, tone: 'bad', kind: 'derrota' })
    rivalExtra.push({ label: 'Presidente condenado no impeachment', value: K.desfecho.condenadoRival })
    fechar(s, 'condenado')
    s.finished = true
  } else {
    st.pressao = K.desfecho.absolvidoPressao
    rivalExtra.push({ label: 'Governo vence o impeachment no Senado', value: K.desfecho.absolvidoRival })
    hitTodos(impulses, 'Presidente absolvido no Senado', K.desfecho.absolvidoGrupos)
    headlines.push({ text: `Senado absolve ${s.presidentName}: ${v.yes} votos, eram precisos ${K.votacao.senadoNecessarios}. O presidente volta ao cargo`, tone: 'good' })
    addBio(s, s.presidentName, `Foi absolvido pelo Senado em processo de impeachment (${v.yes} votos para condenar, eram precisos ${K.votacao.senadoNecessarios}).`)
    addChronicle(s, `Senado absolve ${s.presidentName} e o mandato continua`, 'good')
    noteRecord(s, { text: `Foi absolvido no impeachment do Senado (${v.yes} de ${K.votacao.senadoNecessarios} votos)`, tone: 'good', kind: 'outro' })
    fechar(s, 'absolvido')
  }
}

/** A pista em palavras e a fase, para a tela (nunca o número). */
export function situacaoImpeach(s: GameState): { fase: FaseImpeach; pista: string; motivos: string[] } {
  const st = impeachPresOf(s)
  return { fase: st.fase, pista: st.fase === 'nenhum' ? pistaPressao(st.pressao) : '', motivos: st.fase === 'nenhum' ? motivosAtuais(s) : st.motivos }
}
