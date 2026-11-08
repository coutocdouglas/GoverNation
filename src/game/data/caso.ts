import type { GroupId } from '../types'

/**
 * Etapa 5B (v0.28): vazamento, investigação da PF, advogado do presidente, delação e núcleo mínimo da agenda.
 * Todos os números de balanceamento da etapa moram aqui. Plano: docs/projeto/plano-etapa-5.pdf; DESIGN.md 27.22.
 *
 * Só vaza o que existe: um esquema escondido nascido de uma semente da 5A (com origem na Ficha).
 */

// ─── Vazamento ────────────────────────────────────────────────────────────────

export const VAZAMENTO = {
  /**
   * Ligado na v0.28.1, junto com as telas (cartão do caso, pendência, agenda): o jogador sempre pode agir sobre o
   * caso (Teste do beco sem saída). Testes e simulador podem desligar com `ligarVazamento(false)`.
   */
  ativo: true,
  /**
   * Chance de cada esquema vazar no mês: (base + gravidade/100 × porGravidade) × fator do Controle do Estado
   * × (1 + exposição e oposição). A chance do mês é a de pelo menos um vazar, até `teto`.
   */
  base: 0.02,
  porGravidade: 0.2,
  /** Vigia forte acha mais rápido o que existe: fator = min + controle/100 × (max − min). */
  controle: { min: 0.6, max: 1.4 },
  /** Exposição a escândalo (0 a 100, dos acordos e favores) e força da oposição (0 a 100) somam ao multiplicador. */
  porExposicao: 0.012,
  porOposicao: 0.005,
  teto: 0.85,
  /** O esquema precisa de alguns meses de vida antes de aparecer. */
  idadeMin: 2,
  /** Parcimônia: no máximo 2 casos abertos e pelo menos 4 meses entre um vazamento e outro. */
  maxAtivos: 2,
  intervalo: 4,
  /** Faixas em palavras da chance do mês (do menor para o maior). */
  faixas: [
    { ate: 0.05, texto: 'Tudo quieto' },
    { ate: 0.2, texto: 'Baixa' },
    { ate: 0.45, texto: 'Média' },
    { ate: 0.7, texto: 'Alta' },
    { ate: 1.01, texto: 'Muito alta' },
  ],
} as const

// ─── Gravidade e estrago ──────────────────────────────────────────────────────

/** Faixas de gravidade do caso (0 a 100). */
export const GRAVIDADE = { medio: 30, grave: 50 } as const

export const ESTRAGO = {
  /** No vazamento: todos os grupos perdem gravidade/100 × isto (× fator de quem é o caso). */
  vazaGrupos: 2.5,
  vazaConfianca: 2,
  /** Todo mês com o caso aberto na imprensa (sangria): gravidade/100 × isto em todos os grupos. */
  sangria: 0.6,
  /** Fator pelo envolvimento: caso que envolve o presidente pesa mais; o "de vizinhança" pesa menos. */
  presidente: 1.5,
  vizinhanca: 0.6,
  /** Denúncia: o alvo cai e o golpe se repete, mais forte. */
  denunciaGrupos: 3,
  denunciaConfianca: 2.5,
  /** O caso arquivado devolve um pouco (alívio). */
  arquivadoAlivio: 0.6,
  /** Relação com o partido do alvo quando o alvo cai ou é solto. */
  partidoDenuncia: -6,
} as const

// ─── Investigação da PF ───────────────────────────────────────────────────────

export const PF = {
  /** Provas iniciais (o que vazou já é alguma coisa) e quanto sobem por mês: base + gravidade/100 × porGravidade. */
  inicio: 10,
  base: 2,
  porGravidade: 10,
  /** Solidez das provas de cada caso (sorteada no vazamento): multiplica o ritmo. Caso frágil tende ao arquivo. */
  solidez: [0.35, 1.35] as [number, number],
  /** A PF com mais Controle do Estado (autonomia, Controladoria) anda mais rápido: fator = min + controle/100 × (max − min). */
  controle: { min: 0.7, max: 1.3 },
  /** Desfechos. */
  denunciaEm: 75,
  /** Arquivada: depois deste tempo com provas abaixo do piso. */
  arquivaMeses: 10,
  arquivaAbaixo: 40,
  /** Tempo máximo da investigação: depois disso, ou denúncia ou arquivo. */
  maxMeses: 18,
} as const

/** As saídas do presidente diante de um caso (uma por caso por mês). Ignorar é não escolher nada. */
export type AcaoCaso = 'trocarPF' | 'soltar' | 'tudo' | 'escopo' | 'limpar' | 'exonerar'

export const ACOES_CASO = {
  /** Trocar a diretoria da PF: as provas andam devagar por um tempo, mas custa imprensa, Elo e rastro, e a manobra pode vazar. */
  trocarPF: {
    agenda: 1,
    provasFator: 0.4,
    meses: 6,
    grupos: { classeMedia: -1.5, jovens: -1, servidores: -0.5 } as Partial<Record<GroupId, number>>,
    rastro: 6,
    controle: -6,
    vaza: 0.4,
    vazaGrupos: -1.5,
    /** No máximo uma troca a cada 12 meses (no mandato todo). */
    intervalo: 12,
  },
  /** Soltar a mão do alvo: o caso pesa menos em você, as provas andam um pouco mais devagar, mas o alvo pode delatar. */
  soltar: {
    agenda: 0,
    provasFator: 0.75,
    sangriaFator: 0.5,
    denunciaFator: 0.5,
    partido: -8,
  },
  /** Entregar toda a documentação: provas sobem, a investigação acaba antes; se você está limpo, ganha imagem. */
  tudo: { agenda: 1, provas: 20, imagem: { classeMedia: 1.2, jovens: 0.8, servidores: 0.4 } as Partial<Record<GroupId, number>> },
  /** Com o advogado, delimitar o escopo: ganho menor, risco baixo (o que ficou de fora pode voltar). */
  escopo: { agenda: 1, provas: 10, imagemFator: 0.5, esquece: 0.35, voltaEm: [3, 6] as [number, number], voltaProvas: 15, voltaGrupos: -1 },
  /** Com o advogado, "limpar": esconde a sua parte; se descobrirem, vira obstrução. */
  limpar: {
    agenda: 1,
    provas: 10,
    imagemFator: 1,
    /** Chance de ser descoberto: base + (1 − eficiência do advogado) × porIneficiencia + controle/100 × porControle. */
    descobre: { base: 0.2, porIneficiencia: 0.35, porControle: 0.2 },
    descobreEm: [2, 5] as [number, number],
    obstrucao: { grupos: -3, confianca: -3, rastro: 10, provas: 25 },
  },
  /** Exonerar o ministro investigado: sai do governo; o caso segue contra ele, já sem cargo, e pesa menos em você. */
  exonerar: { agenda: 1, sangriaFator: 0.3, partido: -10, imagem: { classeMedia: 0.5 } as Partial<Record<GroupId, number>> },
} as const

// ─── Delação e Supremo ────────────────────────────────────────────────────────

export const DELACAO = {
  /** O alvo só delata se souber de algo seu: o caso envolve você ou o seu rastro passa disto. */
  rastroMin: 30,
  /** Chance por mês, com provas acima do piso: com a mão solta, mais. */
  provasMin: 40,
  chance: 0.04,
  chanceSolto: 0.14,
  provas: 15,
} as const

export const SUPREMO_CASO = {
  /** O caso sobe ao Supremo quando envolve o presidente, o rastro passa disto e as provas chegam à denúncia. */
  rastroMin: 35,
  /** O Supremo decide depois de alguns meses (sorteio na faixa). */
  meses: [2, 4] as [number, number],
  /** Chance de denúncia = provas/100 × fator do índice "A seu favor" (0,5 a 1,5), entre min e max. */
  min: 0.05,
  max: 0.9,
  denuncia: { grupos: -4, confianca: -4 },
  arquivado: { grupos: 1 },
} as const

/** A CPI é da 5C: o caso grave que envolve o presidente fica marcado como "pode virar CPI". */
export const CPI_MARCA = { gravidadeMin: 50 } as const

// ─── Advogado do presidente ───────────────────────────────────────────────────

export type EstiloAdvogado = 'cauteloso' | 'agressivo'

export interface AdvogadoDef {
  id: string
  name: string
  feminine: boolean
  /** 0 a 1: quanto acerta o parecer e quanto disfarça bem uma limpeza. */
  eficiencia: number
  estilo: EstiloAdvogado
  /** Honorários por mês, em R$ mil (o presidente paga do bolso; contratar um caro chama atenção). */
  custo: number
  /** 0 a 1: se for demitido sabendo demais, quanto segura a língua. */
  lealdade: number
  desc: string
}

export const ADVOGADOS: AdvogadoDef[] = [
  { id: 'montenegro', name: 'Dr. Álvaro Montenegro', feminine: false, eficiencia: 0.85, estilo: 'cauteloso', custo: 180, lealdade: 0.8, desc: 'Criminalista veterano, discreto, caro. Não promete o que não pode.' },
  { id: 'sanches', name: 'Dra. Mirela Sanches', feminine: true, eficiencia: 0.75, estilo: 'agressivo', custo: 140, lealdade: 0.55, desc: 'Brilhante no tribunal e na televisão. Gosta de atacar a investigação.' },
  { id: 'paiva', name: 'Dr. Osmar Paiva', feminine: false, eficiencia: 0.55, estilo: 'cauteloso', custo: 70, lealdade: 0.9, desc: 'Amigo antigo do presidente. Fiel, mas já não é o mais atualizado.' },
  { id: 'lacerda', name: 'Dra. Renata Lacerda', feminine: true, eficiencia: 0.45, estilo: 'agressivo', custo: 60, lealdade: 0.4, desc: 'Jovem, barulhenta e barata. Às vezes subestima o perigo.' },
]

export const ADVOGADO = {
  /** Trocar de advogado gasta espaço da agenda e só pode a cada 6 meses. */
  agenda: 1,
  intervalo: 6,
  /** Contratar um advogado caro (custo ≥ caroDesde) chama atenção: exposição a escândalo. */
  caroDesde: 150,
  caroExposicao: 2,
  /** Demitido sabendo demais (rastro ≥ rastroMin) e pouco leal: mágoa pública. */
  magoa: { rastroMin: 30, exposicao: 6 },
  /** Parecer sobre a proposta de setor: advogado fraco pode subestimar (desce uma faixa). */
  subestima: 0.5,
} as const

// ─── Núcleo mínimo da agenda ──────────────────────────────────────────────────

/** Espaços da agenda do presidente por mês (adiantado da Etapa 6). As ações da 5B gastam espaço. */
export const AGENDA = { espacos: 2 } as const

// ─── Interinos ────────────────────────────────────────────────────────────────

/** Técnicos de carreira que assumem a pasta quando o ministro é exonerado (ou cai na denúncia). */
export const INTERINOS: { name: string; feminine: boolean }[] = [
  { name: 'Otacílio Rangel', feminine: false },
  { name: 'Cláudia Seixas', feminine: true },
  { name: 'Teodoro Lins', feminine: false },
  { name: 'Patrícia Moraes Leal', feminine: true },
  { name: 'Valter Guimarães', feminine: false },
  { name: 'Débora Sarmento', feminine: true },
]

// ─── Nomes das empresas pela IA ───────────────────────────────────────────────

export const NOMES_EMPRESA = {
  /** Tamanho do nome e palavras proibidas (marcas e órgãos reais que a IA às vezes copia). */
  min: 4,
  max: 48,
  proibidas: ['odebrecht', 'petrobras', 'vale s.a', 'camargo', 'andrade gutierrez', 'oas', 'queiroz galvão', 'jbs', 'embraer', 'caixa', 'banco do brasil', 'bndes'],
} as const
