import { ACOES_CPI, CPI, type AcaoCpi, type TomCpi } from '../game/data/cpi'
import { advogadoAtual } from '../game/caso'
import type { Cpi } from '../game/cpi'
import { grupos } from './casoTexto'
import { signed } from './format'
import type { GameState } from '../game/types'

/** Etapa 5C (v0.29.1): textos do cartão da CPI (custo de cada saída à vista). O rastro oculto aparece só em palavras. */

const n = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const pct = (v: number) => `${Math.round(v * 100)}%`

/** Nome curto de cada saída, para o resumo de "Encerrar o mês". */
export const ACAO_CPI_CURTO: Record<AcaoCpi, string> = {
  trabalhar: 'trabalhar as assinaturas', cooperar: 'cooperar', trocarMembros: 'trocar os membros da base',
  negociarRelator: 'negociar com o relator', prepararOitiva: 'preparar o depoimento',
}

export function custoDaAcaoCpi(s: GameState, c: Cpi, a: AcaoCpi): { bom: string[]; ruim: string[] } {
  switch (a) {
    case 'trabalhar': {
      const A = ACOES_CPI.trabalhar
      const segunda = c.trabalhou > 0
      const f = segunda ? A.segundaRetira : 1
      return {
        bom: [`retira de ${Math.round(A.retira[0] * f)} a ${Math.round(A.retira[1] * f)} assinaturas`, 'as assinaturas não crescem neste mês'],
        ruim: [`emendas de ${n(A.pctPib * (segunda ? A.segundaCusto : 1))}% do PIB por ${A.meses} meses`, `exposição a escândalo +${A.exposicao}`, 'deixa rastro em você e marca a Ficha', segunda ? 'é a última vez que dá para fazer' : `na segunda vez, retira ${Math.round((1 - A.segundaRetira) * 100)}% menos e custa ${Math.round((A.segundaCusto - 1) * 100)}% mais`],
      }
    }
    case 'cooperar': {
      const A = ACOES_CPI.cooperar
      const instalada = c.fase === 'instalada'
      return {
        bom: [`com a CPI instalada, o desgaste do mês cai ${Math.round((1 - CPI.sangriaCooperando) * 100)}%`, c.trabalhou ? 'sem ganho de imagem, porque você já trabalhou as assinaturas' : `se você estiver limpo${instalada ? '' : ', quando a CPI instalar'}: ${grupos(A.imagem, instalada ? A.tardia : 1)}`],
        ruim: [`as oitivas rendem ${Math.round((CPI.oitiva.cooperar - 1) * 100)}% mais provas`, instalada ? 'não tem volta' : 'não tem volta: não dá mais para retirar assinaturas'],
      }
    }
    case 'trocarMembros': {
      const A = ACOES_CPI.trocarMembros
      const novo = Math.max(0, (c.tom ?? 1) - 1) as TomCpi
      return {
        bom: [`a comissão fica ${CPI.tons[novo].rotulo}: menos provas e menos desgaste`],
        ruim: [`exposição a escândalo +${A.exposicao}`, 'deixa rastro em você e marca a Ficha', 'só dá para fazer uma vez'],
      }
    }
    case 'negociarRelator': {
      const A = ACOES_CPI.negociarRelator
      return {
        bom: [`${Math.round(-A.aprovar * 100)} pontos a menos na chance de aprovar o relatório`],
        ruim: [`custa ${n(A.pctPib)}% do PIB por ${A.meses} meses`, `exposição a escândalo +${A.exposicao}`, 'deixa rastro em você e marca a Ficha', `${pct(A.vaza)} de chance de vazar: o acerto se perde, provas +${A.vazaProvas}, ${signed(A.vazaGrupos, 1)} em todos os grupos, sem nova conversa`],
      }
    }
    case 'prepararOitiva': {
      const adv = advogadoAtual(s)
      return {
        bom: [`a oitiva deste mês rende ${Math.round(adv.eficiencia * ACOES_CPI.prepararOitiva.porEficiencia * 100)}% menos provas (${adv.name})`],
        ruim: ['vale só para este mês', 'fica registrado na Ficha'],
      }
    }
  }
}
