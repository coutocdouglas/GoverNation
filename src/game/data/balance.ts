// Números de balanceamento. Ajuste aqui para mudar o comportamento do jogo
// sem mexer na lógica. Comentários explicam o que cada número significa.

export const START = {
  year: 2027,
  gap: 0.6, // economia ligeiramente aquecida
  potential: 2.0, // % ao ano
  inflation: 4.6, // % em 12 meses
  expectations: 4.4,
  selic: 14.25,
  unemployment: 6.2,
  naturalUnemployment: 6.6,
  fx: 5.4,
  confidence: 48,
  revenue: 18.6, // % do PIB
  spending: 19.0, // % do PIB
  debt: 79, // % do PIB
} as const

export const MACRO = {
  inflationTarget: 3.0,
  inflationTolerance: 1.5,
  neutralRealRate: 5.5, // juro real que não acelera nem freia a economia

  // Hiato do produto (economia acima/abaixo do potencial)
  gapPersistence: 0.9, // quanto do hiato do mês passado continua
  monetaryEffect: -0.025, // por ponto de juro real acima do neutro, por mês (age com 7 a 12 meses de atraso)
  fiscalEffect: 0.07, // por ponto do PIB de estímulo fiscal, por mês
  investmentEffect: 0.1, // obras rendem o dobro do gasto corrente
  confidenceEffect: 0.004, // por ponto de confiança acima de 50, por mês

  // Inflação (ritmo anualizado)
  inflationInertia: 0.55,
  inflationExpectationsWeight: 0.3,
  inflationTargetWeight: 0.15,
  inflationGapEffect: 0.3, // economia aquecida pressiona preços
  fxPassThrough: 0.4, // por 1% de alta do dólar no mês
  fiscalInflation: 0.05,

  // Expectativas
  expectationsPersistence: 0.85,
  credibilityEffect: 0.003, // por ponto de confiança abaixo de 50

  // Banco Central (regra de Taylor simplificada)
  copomMonths: [0, 2, 4, 5, 6, 8, 10, 11], // jan, mar, mai, jun, jul, set, nov, dez
  taylorExpectations: 1.5,
  taylorInflation: 0.5,
  taylorGap: 0.3,
  maxMovePerMeeting: 0.75,
  pressureCut: 0.5, // quanto a pressão do presidente consegue tirar da decisão
  selicMin: 2,
  selicMax: 25,

  // Desemprego (lei de Okun)
  okun: 0.45, // pontos de desemprego por ponto de hiato
  unemploymentSpeed: 0.06,

  // Câmbio
  fxBase: 5.4,
  fxConfidenceEffect: 0.008,
  fxCarryEffect: 0.015, // juro real alto atrai dólares
  fxCarryNeutral: 7,
  fxSpeed: 0.15,
  fxNoise: 0.008,

  // Confiança do mercado
  confidenceSpeed: 0.12,
  confidencePrimary: 6, // por ponto de resultado primário acima de -0,5% do PIB
  confidenceDebt: -0.25, // por ponto de dívida acima de 78%
  confidenceExpectations: -3, // por ponto de expectativa acima da meta
  confidenceTargetMin: 10, // mesmo no pior cenário o mercado não vai a zero sozinho
  confidenceTargetMax: 90,

  // Contas públicas
  revenueCyclical: 0.25, // receita sobe com a economia aquecida
  termPremium: 4.0, // prêmio dos títulos longos sobre a inflação esperada
  shareIndexedToSelic: 0.5,
} as const

/** Fatores de esquecimento por mês. Ganhos somem em ~9 meses, perdas em ~24. */
export const MEMORY = {
  positiveDecay: 0.774,
  negativeDecay: 0.909,
  econSpeed: 0.15,
  honeymoon: 10,
  honeymoonDecay: 0.85,
} as const

export const DIFFICULTY = {
  facil: { shockChance: 0.03, approvalBonus: 4 },
  normal: { shockChance: 0.05, approvalBonus: 0 },
  dificil: { shockChance: 0.08, approvalBonus: -4 },
} as const
