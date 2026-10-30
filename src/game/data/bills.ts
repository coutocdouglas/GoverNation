import type { ActionEffects } from '../actions'
import type { BillId, Instrument } from '../types'
import { CATALOG } from './measures'
import { BOMBS } from './camara'
import type { AreaId } from './ministers'

/**
 * Projetos que o governo pode enviar ao Congresso.
 * A estrutura é a mesma que a IA vai preencher no futuro (docs/DESIGN.md, seção 5).
 *
 * econ / costumes: posição do projeto nos dois eixos (-100 a +100);
 * costumes ausente = o tema não mexe com costumes.
 * Efeitos são aplicados no mês da aprovação (MP: no mês do envio).
 */
export interface BillDef {
  id: BillId
  /** Área de governo (ministro responsável e fatos do mês que a medida resolve). */
  area: AreaId
  name: string
  summary: string
  instrument: Instrument
  econ: number
  costumes?: number
  pros: string
  cons: string
  effects: ActionEffects
  keywords: string[]
  /** Medida montada pela IA a pedido do presidente (etapa 3C). Ausente nas medidas do catálogo fixo. */
  custom?: CustomInfo
}

export type LegalRisk = 'baixo' | 'medio' | 'alto'

export interface CustomInfo {
  /** Mês absoluto (desde jan/2027) em que o gabinete redigiu a medida. */
  createdAt: number
  term: number
  legalRisk: LegalRisk
  /** O que o presidente escreveu, cortado. */
  request: string
}

export const INSTRUMENTS: Record<Instrument, { label: string; rule: string }> = {
  decreto: { label: 'Decreto', rule: 'Vale na hora, sem votação. Fica em vigor até o fim do jogo.' },
  mp: { label: 'Medida provisória', rule: 'Vale na hora. A Câmara vota no mês seguinte; se rejeitar, cai e o efeito é desfeito.' },
  lei: { label: 'Lei ordinária', rule: 'Maioria dos presentes, com pelo menos 257 deputados na sessão.' },
  complementar: { label: 'Lei complementar', rule: 'Precisa de 257 votos a favor.' },
  pec: { label: 'Emenda constitucional', rule: 'Precisa de 308 votos a favor, em dois turnos.' },
}

/** As 10 leis originais. */
const CORE_BILLS: BillDef[] = [
  {
    id: 'salarioMinimo', area: 'trabalho', name: 'Reajuste real do salário mínimo', instrument: 'lei', econ: -40,
    summary: 'Aumento acima da inflação, com reflexo em aposentadorias e benefícios.',
    pros: 'Renda maior para trabalhadores e aposentados.', cons: 'Pesa na Previdência e nas contas públicas.',
    effects: { spending: 0.25, confidence: -2, groups: { trabalhadores: 6, baixaRenda: 5, servidores: 1, empresarios: -4 } },
    keywords: ['salario minimo', 'minimo', 'piso nacional', 'valorizacao do salario'],
  },
  {
    id: 'programaSocial', area: 'social', name: 'Ampliar o programa de renda', instrument: 'mp', econ: -55, costumes: -10,
    summary: 'Aumenta o benefício por família e inclui mais famílias no programa.',
    pros: 'Alívio imediato para os mais pobres; aquece o consumo.', cons: 'Custo permanente alto; o mercado reclama.',
    effects: { spending: 0.35, confidence: -3, groups: { baixaRenda: 8, jovens: 1, classeMedia: -1, empresarios: -3 } },
    keywords: ['programa social', 'programa de renda', 'transferencia de renda', 'renda basica', 'bolsa', 'auxilio', 'beneficio por familia'],
  },
  {
    id: 'isencaoIR', area: 'economia', name: 'Isenção do IR até R$ 5 mil', instrument: 'lei', econ: -10,
    summary: 'Quem ganha até R$ 5 mil por mês deixa de pagar imposto de renda.',
    pros: 'Popular na classe média e entre os trabalhadores.', cons: 'Perde arrecadação sem compensação.',
    effects: { revenue: -0.3, confidence: -2, groups: { classeMedia: 6, trabalhadores: 4, servidores: 3, empresarios: -2 } },
    keywords: ['imposto de renda', 'isencao', 'isentar', 'ir', 'tabela do ir'],
  },
  {
    id: 'taxarDividendos', area: 'economia', name: 'Tributar lucros e dividendos', instrument: 'lei', econ: -45,
    summary: 'Cobra imposto de renda sobre dividendos de quem ganha mais.',
    pros: 'Arrecada e reduz desigualdade.', cons: 'Empresários e investidores reagem mal.',
    effects: { revenue: 0.3, confidence: -2, groups: { empresarios: -8, classeMedia: -1, baixaRenda: 2, trabalhadores: 1 } },
    keywords: ['dividendo', 'lucros', 'super ricos', 'super-ricos', 'grandes fortunas', 'taxar os ricos', 'taxar ricos'],
  },
  {
    id: 'regraFiscal', area: 'economia', name: 'Regra fiscal mais dura', instrument: 'complementar', econ: 60,
    summary: 'Limite de crescimento de gastos com gatilhos automáticos de corte.',
    pros: 'O mercado ganha confiança; juros e dólar tendem a cair.', cons: 'Aperta saúde, educação e programas sociais.',
    effects: { spending: -0.4, confidence: 8, expectations: -0.3, groups: { servidores: -5, baixaRenda: -3, trabalhadores: -1, empresarios: 6 } },
    keywords: ['regra fiscal', 'teto de gasto', 'arcabouco', 'meta fiscal', 'responsabilidade fiscal', 'limite de gasto', 'equilibrio fiscal'],
  },
  {
    id: 'reformaTributaria', area: 'economia', name: 'Reforma tributária do consumo', instrument: 'pec', econ: 30,
    summary: 'Troca cinco impostos sobre consumo por um imposto sobre valor agregado.',
    pros: 'Simplifica a vida das empresas e eleva o crescimento de longo prazo.', cons: 'Difícil de aprovar; setores perdem benefícios.',
    effects: { potential: 0.15, confidence: 5, groups: { empresarios: 6, classeMedia: 1, agro: -2 } },
    keywords: ['reforma tributaria', 'simplificar imposto', 'simplificacao tributaria', 'iva', 'imposto unico'],
  },
  {
    id: 'reformaAdministrativa', area: 'politica', name: 'Reforma administrativa', instrument: 'pec', econ: 55, costumes: 10,
    summary: 'Muda carreiras, avaliação e estabilidade dos novos servidores.',
    pros: 'Reduz o gasto com pessoal no longo prazo.', cons: 'Servidores vão à greve.',
    effects: { spending: -0.2, potential: 0.05, confidence: 5, groups: { servidores: -12, empresarios: 5, classeMedia: 2 } },
    keywords: ['reforma administrativa', 'estabilidade', 'servidor publico', 'servidores', 'funcionalismo', 'carreiras'],
  },
  {
    id: 'licenciamento', area: 'ambiente', name: 'Flexibilizar o licenciamento ambiental', instrument: 'lei', econ: 40, costumes: 40,
    summary: 'Prazos curtos e autolicenciamento para obras e atividades rurais.',
    pros: 'Destrava obras e agrada o agronegócio.', cons: 'Ambientalistas e jovens reagem; imagem lá fora piora.',
    effects: { potential: 0.05, groups: { agro: 8, empresarios: 3, jovens: -6 } },
    keywords: ['licenciamento', 'licenca ambiental', 'flexibilizar regras ambientais', 'destravar obras'],
  },
  {
    id: 'penasDuras', area: 'seguranca', name: 'Endurecer penas para crimes violentos', instrument: 'lei', econ: 0, costumes: 65,
    summary: 'Penas maiores e menos progressão de regime para crimes violentos.',
    pros: 'Popular entre quem tem medo da violência.', cons: 'Superlota presídios; juristas criticam.',
    effects: { spending: 0.05, groups: { classeMedia: 4, baixaRenda: 1, jovens: -2 } },
    keywords: ['pena', 'penas', 'crime', 'seguranca publica', 'violencia', 'bandido', 'codigo penal'],
  },
  {
    id: 'privatizar', area: 'energia', name: 'Privatizar a estatal de energia', instrument: 'lei', econ: 70,
    summary: 'Vende o controle da estatal de energia e usa o dinheiro para abater dívida.',
    pros: 'Reduz a dívida e anima o mercado.', cons: 'Funcionários e sindicatos protestam; risco de conta de luz mais cara.',
    effects: { debt: -1.2, confidence: 6, groups: { servidores: -6, trabalhadores: -2, empresarios: 6 } },
    keywords: ['privatiz', 'vender estatal', 'vender a estatal', 'desestatiz', 'estatal de energia'],
  },
]

/** Todas as medidas que o governo conhece: as 10 originais e o catálogo por área (data/measures.ts). */
export const BILLS: BillDef[] = [...CORE_BILLS, ...CATALOG]

/** Medida por decreto: vale na hora, sem votação. */
export const isDecree = (id: BillId) => BILL_BY_ID[id]?.instrument === 'decreto'
/** Medida que vale já no mês em que é assinada (decreto ou MP). */
export const actsNow = (id: BillId) => { const i = BILL_BY_ID[id]?.instrument; return i === 'decreto' || i === 'mp' }

export const BILL_BY_ID = Object.fromEntries(BILLS.map((b) => [b.id, b])) as Record<BillId, BillDef>
// Pautas-bomba (etapa 4B) são projetos da própria Câmara: têm ficha, mas não entram no catálogo do governo.
for (const b of BOMBS) BILL_BY_ID[b.id] = b

/** Meses até poder reenviar um projeto rejeitado. */
export const RESUBMIT_COOLDOWN = 6

/** O PIB anual, em bilhões de reais, para converter % do PIB em dinheiro na tela. */
export const GDP_BILLIONS = 12500
