/**
 * Impeachment do presidente (v0.43). Desenho em DESIGN.md 27.41.
 *
 * Fluxo: pressão oculta sobe (aprovação baixa, escândalo, CPI e denúncia contra o presidente, decisão do Supremo
 * descumprida, vice rompido) → a oposição protocola o pedido → o presidente da Câmara decide abrir ou engavetar →
 * a Câmara autoriza com 342 votos (2/3) → o Senado julga com 54 votos (o vice assume como interino) →
 * absolvido (o mandato segue, com a marca) ou condenado (o mandato termina).
 * Muito raro: no máximo um processo por mandato. Em cada fase o jogador tem uma decisão por mês (Agir ou Deixar passar).
 */
export const IMPEACH_PRES = {
  /** Ligado desde as telas (v0.43.1). Testes e `sim7` usam `ligarImpeachPres`. */
  ativo: true,
  /** Nenhum pedido antes deste mês absoluto (o primeiro ano é de lua de mel). */
  inicioMes: 12,
  /** Processos por mandato (Teste da sobrecarga: é raro de propósito). */
  maxMandato: 1,
  /** Meses mínimos entre o fim de um processo e a pressão voltar a contar. */
  intervalo: 24,
  pressao: {
    teto: 100,
    /** Aprovação abaixo disto soma; acima de `aprovacaoCalma` alivia. */
    aprovacaoBaixa: 32,
    porPontoBaixa: 0.45,
    aprovacaoCalma: 48,
    porPontoCalma: 0.3,
    /** Exposição a escândalo (0 a 100) acima disto soma. */
    escandaloAcima: 45,
    porPontoEscandalo: 0.12,
    /** Força da oposição acima disto soma. */
    rivalAcima: 55,
    porPontoRival: 0.08,
    /** Por mês com o vice rompido. */
    viceRompido: 1.5,
    /** Por mês, por caso aberto que atinge o presidente. */
    casoPresidente: 2,
    /** Uma vez, quando aparece o registro novo. */
    cpiContra: 12,
    denuncia: 14,
    descumpriu: 7,
    /** O tempo apaga um pouco por mês (memória curta do plenário). */
    esquecimento: 1,
  },
  /** Pedido protocolado: pressão mínima e chance por mês. */
  pedido: { pressaoMin: 58, chance: 0.3 },
  /** O presidente da Câmara decide em até 2 meses. */
  mesa: {
    meses: 2,
    base: 0.3,
    porPressao: 0.5,
    /** Relação do partido do presidente da Câmara com o governo (0 a 100): quanto mais alta, menos abre. */
    porRelacao: 0.35,
    /** Se o partido dele está na base. */
    naBase: 0.12,
    /** Negociar com ele reduz a chance de abrir; ele não vende se a relação estiver abaixo disto. */
    negociar: 0.25,
    relacaoMin: 30,
    /** Engavetado: a pressão desce e a oposição reclama. */
    engavetadoPressao: -22,
    engavetadoRival: 1.2,
  },
  votacao: {
    camaraNecessarios: 342,
    senadoNecessarios: 54,
    /** Viés contra o presidente por ponto de pressão acima de 50 (como no impeachment de ministro). */
    biasPorPressao: 0.018,
    /** A fidelidade da base protege (por partido da base, 0 a 1 vezes isto). */
    protecaoBase: 0.22,
    orientFactor: 1.0,
    /** Meses entre a autorização da Câmara e o julgamento no Senado. */
    mesesSenado: 2,
  },
  /** Uma decisão por mês. */
  acoes: {
    base: { reforco: 0.1, escandaloChance: 0.18, escandalo: 8, grupos: -0.6 },
    defesa: { pressao: -8, escandalo: 2, grupos: -0.2 },
    rua: { aprovacaoMin: 40, pressaoBom: -6, pressaoFiasco: 4, gruposBom: 0.5, gruposFiasco: -0.6, uma: true },
    mesa: { grupos: -0.5, rival: 0.4 },
  },
  desfecho: {
    barradoPressao: 35,
    barradoRival: 1.5,
    absolvidoPressao: 28,
    absolvidoRival: 2,
    absolvidoGrupos: 0.5,
    condenadoRival: 4,
    /** Quem perde o mandato fica com esta fração da nota final (perder o cargo não pode sair de graça). */
    notaCondenado: 0.4,
  },
}

export type AcaoImpeach = 'mesa' | 'base' | 'defesa' | 'rua'

export type FaseImpeach = 'nenhum' | 'pedido' | 'camara' | 'senado'

export type DesfechoImpeach = 'engavetado' | 'barrado' | 'absolvido' | 'condenado'

let ligado: boolean = IMPEACH_PRES.ativo
/** Liga ou desliga o impeachment do presidente (testes e simulador, até as telas da v0.43.1). */
export const ligarImpeachPres = (v: boolean) => { ligado = v }
export const impeachPresLigado = () => ligado

/** A pressão em palavras: a tela nunca mostra o número. */
export const pistaPressao = (v: number): string =>
  v >= 80 ? 'Fala-se abertamente em afastamento.' : v >= 60 ? 'A oposição conta votos para um pedido.' : v >= 40 ? 'Cresce o ruído em Brasília.' : v >= 20 ? 'Há desconforto, nada além disso.' : 'O ambiente é calmo.'
