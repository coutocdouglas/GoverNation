import { ACOES_CASO, DELACAO, type AcaoCaso, type AdvogadoDef } from '../game/data/caso'
import { GROUP_BY_ID } from '../game/data/groups'
import { PARTY_BY_ID } from '../game/data/parties'
import { agendaDaAcao, areaDoAlvo, chanceDescobre, chanceEsquece, faixaChance, type Caso } from '../game/caso'
import { ministerOf } from '../game/camara'
import { signed } from './format'
import type { GameState, GroupId } from '../game/types'

/** Etapa 5B (v0.28.1): textos do cartão do caso (custo de cada saída à vista). */

const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`

const grupos = (g: Partial<Record<GroupId, number>>, fator = 1) =>
  (Object.entries(g) as [GroupId, number][]).map(([id, v]) => `${GROUP_BY_ID[id].name.toLowerCase()} ${signed(v * fator, 1)}`).join(', ')

/** Custo na relação com o partido do alvo (o motor não cobra do partido do presidente nem de alvo sem partido). */
const partidoTxt = (s: GameState, c: Caso, dv: number): string | null =>
  c.party && c.party !== s.playerParty && PARTY_BY_ID[c.party] ? `${PARTY_BY_ID[c.party].sigla} ${signed(dv, 0)} na relação com o governo` : null

export const agendaTxt = (a: AcaoCaso) => (agendaDaAcao(a) ? `gasta ${agendaDaAcao(a)} espaço da agenda` : 'não gasta agenda')

/** O custo de cada saída, em palavras e números públicos (o rastro oculto só aparece como "deixa rastro em você"). */
export function custoDaAcao(s: GameState, c: Caso, a: AcaoCaso, adv: AdvogadoDef): { bom: string[]; ruim: string[] } {
  switch (a) {
    case 'trocarPF': {
      const A = ACOES_CASO.trocarPF
      return {
        bom: [`as provas andam a ${Math.round(A.provasFator * 100)}% do ritmo por ${meses(A.meses)}`],
        ruim: [grupos(A.grupos), 'mercado −0,5', `Controle do Estado ${signed(A.controle, 0)}`, 'deixa rastro em você e mancha o seu Elo', `${Math.round(A.vaza * 100)}% de chance de a manobra vazar (${signed(A.vazaGrupos, 1)} em todos os grupos)`, `só uma troca a cada ${A.intervalo} meses`],
      }
    }
    case 'soltar': {
      const A = ACOES_CASO.soltar
      return {
        bom: [`o caso sangra a metade em você (e a denúncia também)`, `as provas andam a ${Math.round(A.provasFator * 100)}% do ritmo`],
        ruim: [partidoTxt(s, c, A.partido), `o alvo abandonado delata mais (${Math.round(DELACAO.chanceSolto * 100)}% ao mês contra ${Math.round(DELACAO.chance * 100)}%, se souber de algo seu)`].filter((x): x is string => !!x),
      }
    }
    case 'tudo': {
      const A = ACOES_CASO.tudo
      return { bom: [`provas +${A.provas}: a investigação termina antes`, `se você estiver limpo: ${grupos(A.imagem)}`], ruim: ['se houver algo seu no caso, aparece mais rápido'] }
    }
    case 'escopo': {
      const A = ACOES_CASO.escopo
      return {
        bom: [`provas +${A.provas}`, `se você estiver limpo: ${grupos(ACOES_CASO.tudo.imagem, A.imagemFator)}`],
        ruim: [`chance ${faixaChance(chanceEsquece(adv)).toLowerCase()} de ${adv.name} deixar algo de fora, que volta em ${A.voltaEm[0]} a ${A.voltaEm[1]} meses (provas +${A.voltaProvas}, ${signed(A.voltaGrupos, 0)} em todos os grupos)`],
      }
    }
    case 'limpar': {
      const A = ACOES_CASO.limpar
      return {
        bom: ['esconde a sua parte no caso', `imagem de quem coopera: ${grupos(ACOES_CASO.tudo.imagem, A.imagemFator)}`],
        ruim: [`chance ${faixaChance(chanceDescobre(s, adv)).toLowerCase()} de descobrirem em ${A.descobreEm[0]} a ${A.descobreEm[1]} meses: obstrução (${signed(A.obstrucao.grupos, 0)} em todos os grupos, mercado ${signed(A.obstrucao.confianca, 0)}, provas +${A.obstrucao.provas}, mancha no seu Elo e o caso reabre)`],
      }
    }
    case 'exonerar': {
      const A = ACOES_CASO.exonerar
      const area = areaDoAlvo(s, c)
      return {
        bom: [`${area ? ministerOf(s, area).name : 'o ministro'} sai; um técnico de carreira assume como interino`, `o caso sangra só ${Math.round(A.sangriaFator * 100)}% em você`, grupos(A.imagem)],
        ruim: [partidoTxt(s, c, A.partido), 'a investigação continua, agora contra quem saiu do cargo'].filter((x): x is string => !!x),
      }
    }
  }
}

/** Nome curto de cada saída, para o resumo de "Encerrar o mês". */
export const ACAO_NOME_CURTO: Record<AcaoCaso, string> = {
  trocarPF: 'trocar a diretoria da PF', soltar: 'soltar a mão do alvo', tudo: 'entregar toda a documentação',
  escopo: 'entregar com o escopo delimitado', limpar: '“limpar” os documentos', exonerar: 'exonerar o ministro',
}
