/**
 * Etapa 6, bloco 6E, parte 4 (v0.40): o círculo de confiança.
 *
 * Quem o presidente escuta além do ministro da pasta: o líder do governo (o placar), o advogado (o risco jurídico),
 * o vice (a leitura política) e o ministro da Fazenda (as contas e o mercado). Uma consulta ao círculo por mês, sobre a
 * medida que você prepara. Cada um avalia pelas regras, do jeito que é: o incompetente erra, o desleal puxa para o lado
 * dele, o vice ambicioso e desleal empurra para o erro. O viés não aparece; a tela mostra o Elo e a pista de risco.
 * Ouvir quem tem risco oculto alto sobe o rastro do presidente. A consulta vive em rodada.ts (`consultarCirculo`).
 * Números em data/conselho.ts (`CIRCULO`); desenho em DESIGN.md 27.38.
 */
import { ministerOf } from './camara'
import { custoAno } from './conselho'
import { forecastVote } from './congress'
import { advogadoAtual } from './caso'
import { BILL_BY_ID } from './data/bills'
import { CIRCULO } from './data/conselho'
import { LIDER_BY_ID, VICE_BY_ID } from './data/governo'
import { PARTY_BY_ID } from './data/parties'
import { contratoDe, pessoaDe, type ContextoPessoa } from './risco'
import type { Rng } from './rng'
import { legalRiskIn } from './supremo'
import type { BillId, GameState, GroupId } from './types'

export type MembroCirculo = 'lider' | 'advogado' | 'vice' | 'fazenda'
export type Posicao = 'apoia' | 'ressalva' | 'contra'

export interface Membro {
  quem: MembroCirculo
  name: string
  feminine: boolean
  /** O que ele avalia, em palavras. */
  papel: string
  ctx: ContextoPessoa
}

export interface ParecerCirculo {
  quem: MembroCirculo
  bill: BillId
  posicao: Posicao
  /** A leitura dele, em palavras (texto das regras; a IA narra na tela). */
  leitura: string
}

/** Quem está no círculo agora (o vice só se houver; sem governo vivo, só advogado e Fazenda). */
export function membrosCirculo(s: GameState): Membro[] {
  const out: Membro[] = []
  if (s.governo) {
    const l = LIDER_BY_ID[s.governo.lider.id]
    out.push({ quem: 'lider', name: l.name, feminine: l.feminine, papel: 'o placar no Congresso', ctx: { papel: 'lider', party: s.playerParty } })
  }
  const adv = advogadoAtual(s)
  out.push({ quem: 'advogado', name: adv.name, feminine: adv.feminine, papel: 'o risco jurídico', ctx: { papel: 'advogado' } })
  if (s.governo) {
    const v = VICE_BY_ID[s.governo.vice.id]
    out.push({ quem: 'vice', name: v.name, feminine: v.feminine, papel: 'a leitura política', ctx: { papel: 'lider', party: v.party } })
  }
  const f = ministerOf(s, 'economia')
  out.push({ quem: 'fazenda', name: f.name, feminine: f.feminine, papel: 'as contas e o mercado', ctx: { papel: 'ministro', party: f.party, area: 'economia' } })
  return out
}

export const membroDe = (s: GameState, quem: MembroCirculo): Membro | undefined => membrosCirculo(s).find((m) => m.quem === quem)

/** Risco oculto de quem o presidente vai ouvir (para o rastro). */
export const riscoDe = (s: GameState, m: Membro): number => pessoaDe(s, m.name, m.ctx).risco

const fmtBi = (v: number) => `R$ ${Math.round(Math.abs(v)).toLocaleString('pt-BR')} bi`

/** O parecer de um membro do círculo sobre a medida, pelas regras (com o erro e o viés de cada um). */
export function parecerCirculo(s: GameState, quem: MembroCirculo, bill: BillId, rng: Rng): ParecerCirculo {
  const b = BILL_BY_ID[bill]
  const C = CIRCULO
  switch (quem) {
    case 'lider': {
      if (b.instrument === 'decreto') return { quem, bill, posicao: 'apoia', leitura: 'Decreto não passa pelo Congresso: daqui não tenho o que contar.' }
      const g = s.governo!
      const real = forecastVote(s, bill).chance
      // Competência baixa erra mais (para os dois lados); desleal pinta o placar mais bonito do que é.
      const erro = (rng.next() * 2 - 1) * C.lider.erroMax * (1 - g.lider.competencia / 100)
      const otimismo = g.lider.lealdade < C.lider.lealdadeAbaixo ? C.lider.otimismoDesleal : 0
      const est = Math.max(0, Math.min(1, real + erro + otimismo))
      const faixa = est >= C.lider.folga ? 'passa com folga' : est >= C.lider.apertado ? 'é apertado, mas dá para passar' : 'hoje não passa'
      return { quem, bill, posicao: est >= C.lider.folga ? 'apoia' : est >= C.lider.apertado ? 'ressalva' : 'contra', leitura: `Contei os votos: ${faixa}.` }
    }
    case 'advogado': {
      const adv = advogadoAtual(s)
      const risco = legalRiskIn(s, bill)
      let nivel = risco === 'alto' ? 2 : risco === 'medio' ? 1 : 0
      if (contratoDe(b) && (b.controle ?? 0) < 0) nivel = Math.min(2, nivel + 1)
      // Advogado fraco às vezes subestima o perigo.
      if (rng.next() < (1 - adv.eficiencia) * C.advogado.subestima) nivel = Math.max(0, nivel - 1)
      const leitura = ['Risco jurídico baixo: dificilmente cai no Supremo.', 'Risco jurídico médio: pode ir ao Supremo, mas há defesa.', 'Risco jurídico alto: é forte candidata a cair no Supremo.'][nivel]
      return { quem, bill, posicao: (['apoia', 'ressalva', 'contra'] as const)[nivel], leitura: `${leitura}${contratoDe(b) ? ' Tem contratação: cuidado com a licitação.' : ''}` }
    }
    case 'vice': {
      const g = s.governo!
      const grupos = Object.entries(b.effects.groups ?? {}) as [GroupId, number][]
      const saldo = grupos.reduce((a, [, v]) => a + v, 0)
      const boa = saldo > 0
      const perdem = grupos.filter(([, v]) => v < 0).length
      // O vice ambicioso e desleal empurra para o erro: elogia o que te prejudica e põe dúvida no que te ajuda.
      const sabota = g.vice.ambicao >= C.vice.ambicaoDesde && g.vice.lealdade < C.vice.lealdadeAbaixo
      const apoia = sabota ? !boa : boa
      return {
        quem, bill, posicao: apoia ? 'apoia' : boa ? 'ressalva' : 'contra',
        leitura: apoia ? 'Politicamente, é boa: o país vai receber bem.' : boa ? 'Não sei se é a hora: pode passar a impressão errada.' : `Politicamente, é ruim: ${perdem} ${perdem === 1 ? 'grupo perde' : 'grupos perdem'} com ela.`,
      }
    }
    case 'fazenda': {
      const real = custoAno(b)
      // Desgastado, o ministro da Fazenda já não confere as contas direito: o custo parece menor.
      const custo = (s.ministries?.economia?.wear ?? 0) >= C.fazenda.desgasteDesde ? real * (1 - C.fazenda.subestimaCusto) : real
      const conf = b.effects.confidence ?? 0
      const pos: Posicao = custo > C.fazenda.caro || conf <= C.fazenda.mercadoRuim ? 'contra' : custo > C.fazenda.medio ? 'ressalva' : 'apoia'
      const contas = custo > 0.5 ? `custa cerca de ${fmtBi(custo)} por ano` : custo < -0.5 ? `rende cerca de ${fmtBi(custo)} por ano` : 'quase não mexe nas contas'
      const mercado = conf <= C.fazenda.mercadoRuim ? '; o mercado não vai gostar' : conf >= 2 ? '; o mercado gosta' : ''
      return { quem, bill, posicao: pos, leitura: `Pelas contas: ${contas}${mercado}.` }
    }
  }
}

/** O texto do parecer pelas regras (reserva da fala da IA). */
export function textoParecer(p: ParecerCirculo): string {
  const abre = p.posicao === 'apoia' ? 'Pode mandar.' : p.posicao === 'ressalva' ? 'Mandaria com cuidado.' : 'Eu não mandaria agora.'
  return `${abre} ${p.leitura}`
}

/** Linha curta de quem é cada um (partido), para a janela. */
export function rotuloMembro(m: Membro): string {
  const p = m.ctx.party ? PARTY_BY_ID[m.ctx.party]?.sigla : null
  return `${m.name}${p ? ` (${p})` : ''}: ${m.papel}`
}
