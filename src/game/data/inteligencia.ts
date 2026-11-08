/**
 * Etapa 5C (v0.30): serviço de inteligência e dossiês. Todos os números da parte moram aqui.
 * Plano: docs/projeto/plano-etapa-5.pdf; DESIGN.md 27.26.
 */

export type AcaoIntel = 'montar' | 'fechar' | 'revelar' | 'abafar' | 'investigar' | 'queimar'

/** A ordem do mês ao serviço. `alvo`: o nome da pessoa (revelar) ou a sigla interna do partido (investigar). */
export interface OrdemIntel {
  acao: AcaoIntel
  alvo?: string
}

export const INTELIGENCIA = {
  /** Ligado desde que ganhou tela (v0.32.0). Testes e simulador usam `ligarInteligencia`. */
  ativo: true,
  /** Rótulo do gasto contínuo: é por ele que o gasto sai das contas quando o serviço fecha. */
  rotuloGasto: 'Serviço de inteligência',
  /** Gasto em % do PIB ao ano, enquanto o serviço estiver aberto. */
  pctPib: 0.02,
  mesesGasto: 600,
  montar: { exposicao: 3, controle: -2 },
  /** Depois de fechar, só reabre depois disto (meses). */
  reabrirEm: 6,
} as const

/** Espaços da agenda de cada ordem. Fechar e queimar não gastam: são saídas (Teste do beco sem saída). */
export const AGENDA_INTEL: Record<AcaoIntel, number> = { montar: 1, fechar: 0, revelar: 1, abafar: 1, investigar: 1, queimar: 0 }

/** Aviso antecipado de vazamentos e de pedidos de CPI. */
export const ANTECIPAR = {
  /** Chance de o serviço descobrir antes. */
  detecta: 0.7,
  meses: 2,
  /** O vazamento avisado pega o governo preparado: o golpe da hora é multiplicado por isto. */
  preparado: 0.75,
  /** O pedido de CPI avisado começa com menos assinaturas. */
  assinaturas: 0.85,
} as const

export const REVELAR = { rastro: 1 } as const

/** Abafar um vazamento já avisado. Não vale para caso aberto: a PF é independente. */
export const ABAFAR = {
  rastro: 8,
  exposicao: 4,
  controle: -3,
  pedidos: 2,
  /** Chance de dar errado: base + controle/100 × porControle + pedidos × porPedido, até `teto`. */
  falha: { base: 0.25, porControle: 0.3, porPedido: 0.015, teto: 0.8 },
  /** Deu certo: o esquema some da imprensa por este tempo e encolhe. */
  adia: 6,
  reduz: 0.7,
  /** Deu errado: vaza neste fechamento, mais grave, e o caso passa a envolver o presidente. */
  agrava: 10,
  /** Só uma tentativa a cada tanto (meses). */
  intervalo: 12,
} as const

export const DOSSIE = {
  /** Material que cada investigação junta. */
  junta: [18, 30] as [number, number],
  rastro: 2,
  exposicao: 1,
  controle: -1,
  /** Material mínimo para usar numa votação. */
  usarDesde: 40,
  /** Reforço na votação: material/100 × isto × rendimento^(usos anteriores no mandato). */
  reforco: 1.2,
  rendimento: 0.75,
  /** Ao usar: quem foi coagido não esquece. */
  relacao: -12,
  rastroUso: 4,
  /** Mesmo partido só de novo depois disto (meses). */
  intervaloPartido: 12,
  /** O uso vale até a votação acontecer, por no máximo isto (meses, se a pauta travar). */
  validade: 3,
  /** O esquema escondido que nasce no primeiro pedido: quanto mais pedidos, mais grave (e mais chance de vazar). */
  esquema: { quem: 'Dossiês do Planalto', peso: 40, inicio: 22, porPedido: 7, teto: 90 },
  /** Queimar os dossiês: perde todo o material, o esquema encolhe e os pedidos contam menos. */
  queimar: { gravidade: 0.5, pedidos: 0.5, exposicao: 2, intervalo: 12 },
  /** Vazou: relação com cada partido que teve dossiê. */
  vazaRelacao: -8,
} as const
