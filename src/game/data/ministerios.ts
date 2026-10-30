import type { GroupId } from '../types'
import type { AreaId } from './ministers'
import type { PromiseDef } from './promises'

/**
 * Etapa 4C3: desgaste dos ministros e meta de cada pasta. Todo número de balanceamento mora aqui.
 * Regras em src/game/ministerios.ts; desenho em docs/DESIGN.md, seção 26.6.
 */
export const MINISTERIOS = {
  /** Desgaste de quem acaba de assumir. */
  start: 20,
  /** A partir daqui o ministro está desgastado: custa aprovação no grupo da área todo mês. */
  worn: 70,
  wornHit: -0.2,
  /** Fato do mês da área: resolvido com medida, escolha feita, ignorado (opção padrão) ou resposta que travou. */
  event: { resolvido: -10, escolha: -2, ignorado: 6, falhou: 8 },
  /** Cada medida da área que entra em vigor. */
  enacted: -4,
  /** Supremo: medida da área derrubada, suspensa por liminar, ou projeto barrado (CCJ ou Supremo). */
  struck: 20,
  liminar: 10,
  barred: 8,
  /** Meta da pasta, todo mês. */
  goal: { rumo: -1.5, cumprida: -1.5, risco: 0.3, longe: 0.8, quase: 0, quebrada: 0 } as Record<string, number>,
}

/** Grupo que mais sente cada pasta (quem cobra quando o ministro está desgastado). */
export const AREA_GROUP: Record<AreaId, GroupId> = {
  economia: 'classeMedia',
  saude: 'baixaRenda',
  educacao: 'jovens',
  seguranca: 'classeMedia',
  trabalho: 'trabalhadores',
  social: 'baixaRenda',
  agro: 'agro',
  ambiente: 'jovens',
  energia: 'empresarios',
  transportes: 'trabalhadores',
  cidades: 'baixaRenda',
  ciencia: 'jovens',
  politica: 'servidores',
}

const goal = (area: AreaId, g: Omit<PromiseDef, 'id' | 'side' | 'group'>): PromiseDef => ({ id: `meta-${area}`, side: 'qualquer', group: AREA_GROUP[area], ...g })

/** Meta de cada pasta, medida pelo motor como as promessas de posse. */
export const MINISTRY_GOALS: Record<AreaId, PromiseDef> = {
  economia: goal('economia', { name: 'Inflação na meta', desc: 'Inflação em 12 meses de 4,5% ou menos.', metric: { type: 'indicador', key: 'inflation' }, dir: 'max', target: 4.5, slack: 0.7, unit: '%' }),
  trabalho: goal('trabalho', { name: 'Desemprego baixo', desc: 'Desemprego de 6,5% ou menos.', metric: { type: 'indicador', key: 'unemployment' }, dir: 'max', target: 6.5, slack: 0.7, unit: '%' }),
  social: goal('social', { name: 'Os mais pobres satisfeitos', desc: 'Aprovação de 50 ou mais entre a baixa renda.', metric: { type: 'grupo', group: 'baixaRenda' }, dir: 'min', target: 50, slack: 8, unit: '' }),
  agro: goal('agro', { name: 'Campo satisfeito', desc: 'Aprovação de 50 ou mais no agro.', metric: { type: 'grupo', group: 'agro' }, dir: 'min', target: 50, slack: 8, unit: '' }),
  educacao: goal('educacao', { name: 'Jovens satisfeitos', desc: 'Aprovação de 50 ou mais entre os jovens.', metric: { type: 'grupo', group: 'jovens' }, dir: 'min', target: 50, slack: 8, unit: '' }),
  seguranca: goal('seguranca', { name: 'Sensação de segurança', desc: 'Aprovação de 45 ou mais na classe média.', metric: { type: 'grupo', group: 'classeMedia' }, dir: 'min', target: 45, slack: 8, unit: '' }),
  saude: goal('saude', { name: 'Duas entregas na saúde', desc: 'Duas medidas de saúde em vigor no mandato.', metric: { type: 'leisArea', area: 'saude' }, dir: 'min', target: 2, slack: 1, unit: ' medidas' }),
  cidades: goal('cidades', { name: 'Duas entregas nas cidades', desc: 'Duas medidas de cidades em vigor no mandato.', metric: { type: 'leisArea', area: 'cidades' }, dir: 'min', target: 2, slack: 1, unit: ' medidas' }),
  transportes: goal('transportes', { name: 'Duas entregas em transportes', desc: 'Duas medidas de transportes em vigor no mandato.', metric: { type: 'leisArea', area: 'transportes' }, dir: 'min', target: 2, slack: 1, unit: ' medidas' }),
  energia: goal('energia', { name: 'Mercado confiante', desc: 'Confiança do mercado de 50 ou mais.', metric: { type: 'indicador', key: 'confidence' }, dir: 'min', target: 50, slack: 5, unit: '' }),
  ambiente: goal('ambiente', { name: 'Uma entrega ambiental', desc: 'Uma medida de meio ambiente em vigor no mandato.', metric: { type: 'leisArea', area: 'ambiente' }, dir: 'min', target: 1, slack: 1, unit: ' medida' }),
  ciencia: goal('ciencia', { name: 'Uma entrega em ciência', desc: 'Uma medida de ciência e tecnologia em vigor no mandato.', metric: { type: 'leisArea', area: 'ciencia' }, dir: 'min', target: 1, slack: 1, unit: ' medida' }),
  politica: goal('politica', { name: 'Governo aprovado', desc: 'Aprovação geral de 45 ou mais.', metric: { type: 'aprovacao' }, dir: 'min', target: 45, slack: 6, unit: '' }),
}
