import type { PartyId } from '../types'

/**
 * Etapa 5A: o líder da oposição (o rival na próxima eleição).
 * Personagens fictícios, com nomes e falas nossos.
 */
export interface RivalDef {
  name: string
  feminine: boolean
  party: PartyId
  /** Partidos que acompanham o rival na obstrução. */
  allies: PartyId[]
  blurb: string
  /** Falas fixas do rival, por postura. {pres} = nome do presidente. */
  lines: Record<RivalStance, string[]>
}

export type RivalStance = 'observa' | 'desgaste' | 'obstrucao'

export const RIVALS: RivalDef[] = [
  {
    name: 'Leopoldo Rezende',
    feminine: false,
    party: 'pol',
    allies: ['mrb', 'nrm'],
    blurb: 'Ex-governador de dois mandatos, fala em ordem nas contas e nas ruas. Lidera a oposição pela direita.',
    lines: {
      observa: ['Vamos dar tempo ao governo. Tempo, não cheque em branco.', 'Estou rodando o país e ouvindo. A conta vai chegar.'],
      desgaste: ['O governo {pres} promete muito e entrega pouco.', 'Quem paga a conta desse governo é quem acorda cedo.'],
      obstrucao: ['Nenhum projeto deste governo passa sem resistência.', 'A oposição vai usar todo o regimento. O país precisa de freio.'],
    },
  },
  {
    name: 'Clarice Siqueira',
    feminine: true,
    party: 'fpt',
    allies: ['pvs'],
    blurb: 'Ex-prefeita de capital, vinda do movimento sindical. Lidera a oposição pela esquerda.',
    lines: {
      observa: ['A gente acompanha de perto. O povo não esquece promessa.', 'Oposição responsável fiscaliza, não sabota. Por enquanto.'],
      desgaste: ['O governo {pres} governa para poucos.', 'Enquanto o Planalto comemora, a feira ficou mais cara.'],
      obstrucao: ['Vamos obstruir tudo que tira direito do trabalhador.', 'Este governo perdeu a rua. Agora vai perder o plenário.'],
    },
  },
]

export const RIVAL_BY_PARTY = Object.fromEntries(RIVALS.map((r) => [r.party, r])) as Partial<Record<PartyId, RivalDef>>

/** O rival vem do maior partido do lado oposto: presidente da FPT enfrenta o POL; os outros enfrentam a FPT ou o POL, o mais distante. */
export const RIVAL_PARTY_FOR: Record<PartyId, PartyId> = {
  fpt: 'pol', pvs: 'pol', pol: 'fpt', mrb: 'fpt', nrm: 'fpt', ucd: 'fpt', mdn: 'pol', psn: 'pol', pra: 'fpt',
}

/** Números do rival. */
export const RIVAL = {
  start: 35,
  min: 5,
  max: 95,
  /** Força ganha por ponto de aprovação abaixo de `low`, e perde por ponto acima de `high`. */
  low: 50,
  high: 55,
  perPointBelow: 0.06,
  perPointAbove: 0.05,
  /** A oposição se organiza: um pouco por mês, mais no último ano. */
  time: 0.15,
  timeLastYear: 0.4,
  /** A força volta aos poucos para `start` (a oposição também se cansa): fração por mês. */
  reversion: 0.03,
  scandal: 5,
  defeat: 2,
  vetoOverride: 3,
  /** Mudança de postura. */
  desgasteAt: 40,
  obstrucaoAt: 65,
  /** Ataque mensal (desgaste e obstrução): de `attackMin` a `attackMax` pontos num grupo. */
  attackMin: 0.3,
  attackMax: 0.8,
  /** Chance de o ataque mirar uma promessa fora do rumo, se houver. */
  attackPromise: 0.5,
  /** Obstrução: reforço contra o governo na orientação do partido do rival e dos aliados. */
  obstructionOwn: -0.25,
  obstructionAllies: -0.1,
  /** Força de partida de saves antigos: start + (50 − aprovação) × migrateSlope. */
  migrateSlope: 0.5,
} as const

/** Pesquisa de intenção de voto ("se a eleição fosse hoje"). */
export const POLL = {
  govBase: 5,
  govPerApproval: 0.7,
  /** Desemprego acima de `unempPivot` e inflação acima de `inflPivot` tiram votos do governo. */
  unempPivot: 7,
  unempWeight: 0.8,
  inflPivot: 4.5,
  inflWeight: 0.5,
  rivalBase: 12,
  rivalPerStrength: 0.45,
  /** Desgaste do governo: (pivot − aprovação) × weight a mais para o rival. */
  rivalApprovalPivot: 55,
  rivalApprovalWeight: 0.25,
  /** Brancos, nulos e indecisos ficam entre min e max. */
  otherMin: 8,
  otherMax: 25,
} as const
