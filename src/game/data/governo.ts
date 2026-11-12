import type { PartyId } from '../types'

/**
 * Etapa 6, bloco 6E (v0.37): governo com vida. Parte 1: o vice-presidente (por proposta) e o líder do governo.
 * Todos os números de balanceamento do bloco moram aqui. Plano: docs/projeto/plano-etapa-6.md; DESIGN.md 27.35.
 *
 * O vice nasce de uma proposta: na posse, o jogador escolhe 3 entre os 27 nomes (3 por partido); um só aceita,
 * sorteado com peso (mais fácil quem é do partido do presidente ou de partido próximo). Quem aceita traz o partido
 * para votar parcialmente com o governo enquanto a lealdade segurar.
 */
export const GOVERNO = {
  /** Desligado até as telas (v0.37.1). Testes e simulador usam `ligarGoverno`. */
  ativo: false,
  vice: {
    /** Quantos nomes o jogador propõe na posse. */
    propostas: 3,
    /** Chance relativa de aceitar: base + afinidade ideológica do partido; o mesmo partido do presidente pesa mais. */
    aceita: { base: 0.25, afinidade: 0.75, mesmoPartido: 0.6 },
    /** Fração do reforço de um ministério que o partido do vice dá ao governo (vezes uma curva da lealdade). */
    parcial: 0.5,
    /** Curva da lealdade no reforço: 0,5 + lealdade/100 (de 0,5 a 1,5). */
    lealdadeMin: 0.5,
    /** Meses de intervalo entre ações no vice (uma por mês) e custo em conversas da rodada. */
    conversas: 1,
    /** Quanto cada ação mexe nas trilhas do vice (lealdade, ambição, popularidade, 0 a 100). */
    acoes: {
      espaco: { lealdade: 8, ambicao: 6, popularidade: 6 },
      isolar: { lealdade: -5, ambicao: -6, popularidade: -3 },
      confrontar: { lealdade: -6, ambicao: -3, popularidade: -10, credibilidade: -1 },
      vigiar: { revelaMeses: 3, vazaChance: 0.2, vazaEscandalo: 3, vazaLealdade: -10 },
    },
    /** A ambição sobe quando o governo vai mal e cai quando vai bem (por mês). */
    ambicao: { aprovacaoBaixa: 40, aprovacaoAlta: 60, porPonto: 0.08, caso: 0.8, calma: -0.5, teto: 100 },
    /** A lealdade corrói por mês quando a ambição passa de `acima`. */
    corroi: { acima: 60, taxa: 0.05 },
    /** Articulação: com ambição alta o vice trabalha contra, e o partido dele racha. */
    articula: { ambicaoDesde: 65, chance: 0.2, lealdadeAlivia: 1.25, rival: 0.5, fidelidade: -4 },
    /** Ruptura: ambição e aprovação ruins, lealdade baixa. O benefício da base some e a oposição cresce. */
    rompe: { ambicaoDesde: 75, aprovacaoAbaixo: 40, lealdadeAbaixo: 35, alternativa: { popularidade: 75, ambicao: 90 }, rival: 2, fidelidade: -10 },
  },
  lider: {
    /** Reforço máximo (por partido da base) quando competência e lealdade são 100. */
    bonus: 0.045,
    /** Meses em que o líder novo rende só metade (está aprendendo a bancada). */
    novoMeses: 2,
    /** Lealdade oculta: sobe com a base fiel e a aprovação, cai quando o governo vai mal. */
    lealdade: { aprovacaoRef: 50, porPonto: 0.04, fidelRef: 50, porFidel: 0.04 },
    /** Se a lealdade cai abaixo de `abaixo`, há chance mensal de traição (vaza uma negociação, a oposição ganha força). */
    trai: { abaixo: 30, chance: 0.08, rival: 1, escandalo: 2, lealdade: -10 },
    /** Trocar o líder: custo em conversas da rodada; o vice-líder assume. */
    troca: { conversas: 1, lealdadeNovo: 55 },
  },
} as const

let ligado: boolean = GOVERNO.ativo
/** Liga ou desliga o bloco 6E (parte 1) inteiro (testes e simulador, até as telas da v0.37.1). */
export const ligarGoverno = (v: boolean) => { ligado = v }
export const governoLigado = () => ligado

export type AcaoVice = 'espaco' | 'isolar' | 'confrontar' | 'vigiar'

export interface VicePerfil {
  id: string
  name: string
  feminine: boolean
  party: PartyId
  portrait: number
  /** O que a tela mostra: quem é, em palavras. */
  perfil: string
  /** Oculta: a lealdade verdadeira (a tela só dá pista), a ambição e a popularidade inicial. */
  lealdade: number
  ambicao: number
  popularidade: number
}

const v = (id: string, name: string, feminine: boolean, party: PartyId, portrait: number, perfil: string, lealdade: number, ambicao: number, popularidade: number): VicePerfil =>
  ({ id, name, feminine, party, portrait, perfil, lealdade, ambicao, popularidade })

/** Os 27 nomes que o jogador pode propor para vice (3 por partido). Todos fictícios. */
export const VICES: VicePerfil[] = [
  v('pol_hv', 'Hélio Brandão Vaz', false, 'pol', 28, 'Ex-ministro da Fazenda, técnico respeitado pelo mercado. Discreto e previsível.', 72, 40, 52),
  v('pol_mc', 'Marlene Cavalcanti Ribas', true, 'pol', 25, 'Senadora veterana, firme em segurança e ordem. Conhece cada corredor do Congresso.', 66, 55, 58),
  v('pol_fm', 'Fausto Mendonça Prado', false, 'pol', 30, 'Empresário e ex-governador. Rico, vaidoso e de olho na cadeira maior.', 45, 82, 61),
  v('fpt_ib', 'Ivone Barroso', true, 'fpt', 34, 'Sindicalista de décadas. Leal ao projeto, difícil de domar.', 78, 38, 60),
  v('fpt_dn', 'Davi Nogueira Teles', false, 'fpt', 39, 'Deputado jovem e carismático da esquerda. Fala bem, quer subir rápido.', 50, 78, 66),
  v('fpt_lm', 'Lúcia Marinho', true, 'fpt', 38, 'Educadora popular, querida nas periferias. Pouca vida de gabinete.', 70, 35, 56),
  v('ucd_wt', 'Wilson Tavares Pinho', false, 'ucd', 47, 'Cacique do centrão. Cobra caro por cada gesto e nunca fecha a porta para ninguém.', 40, 74, 50),
  v('ucd_de', 'Dagmar Esteves', true, 'ucd', 42, 'Operadora de bastidor, sabe onde está cada voto. Fala pouco, anota tudo.', 58, 60, 48),
  v('ucd_jb', 'Júlio Bastos Lima', false, 'ucd', 45, 'Presidente de comissão aos 40 anos. Pragmático e sempre bem informado.', 52, 66, 53),
  v('psn_ec', 'Elisa Cordeiro', true, 'psn', 80, 'Ex-prefeita de capital, boa de rua e de entrega. Apoia quem está bem.', 60, 58, 64),
  v('psn_na', 'Nilton Aguiar', false, 'psn', 43, 'Ex-prefeito do interior, conhece cada prefeitura do país. Simpático e flexível.', 62, 50, 55),
  v('psn_rs', 'Regina Sapucaí', true, 'psn', 50, 'Articuladora municipalista. Fiel até onde o município é atendido.', 64, 48, 51),
  v('mrb_es', 'Ezequiel Santana', false, 'mrb', 7, 'Pastor e deputado jovem, voz forte nos costumes. Dedicado, mas exige respeito.', 56, 62, 63),
  v('mrb_nd', 'Noêmia Duarte', true, 'mrb', 60, 'Bispa e comunicadora. Leal e inflexível em família e costumes.', 68, 44, 57),
  v('mrb_ma', 'Moisés Alcântara', false, 'mrb', 62, 'Advogado da bancada evangélica. Calmo, firme e muito organizado.', 70, 42, 49),
  v('mdn_hp', 'Heloísa Prates', true, 'mdn', 52, 'Cacique regional do centro histórico. Negocia tudo e não rompe com ninguém.', 66, 52, 54),
  v('mdn_ob', 'Osvaldo Benevides', false, 'mdn', 68, 'Ex-presidente da Câmara, conhece o regimento melhor que o regimento. Fiel ao que lhe convém.', 60, 56, 50),
  v('mdn_tc', 'Tereza Camargo Lins', true, 'mdn', 88, 'Política de carreira e boa de conciliação. Quer um governo estável.', 74, 36, 52),
  v('pra_gf', 'Gustavo Falcão', false, 'pra', 71, 'Líder de uma sigla pequena que vive de se encaixar. Vota onde o dia pede.', 42, 70, 46),
  v('pra_mt', 'Mirian Tolentino', true, 'pra', 74, 'Deputada de fusão de siglas, hábil em acordo. Muda de lado com elegância.', 48, 64, 47),
  v('pra_rp', 'Raul Pessoa Neto', false, 'pra', 85, 'Herdeiro político, sorridente e vazio de convicções. Fiel a quem tem a caneta.', 55, 58, 55),
  v('pvs_ag', 'Aline Guerra', true, 'pvs', 100, 'Ambientalista de renome internacional. Cobra coerência e fala sem filtro.', 62, 50, 62),
  v('pvs_ct', 'Caio Tupinambá', false, 'pvs', 89, 'Ativista de direitos. Faz barulho, vence debate e não aceita meio-termo.', 48, 68, 60),
  v('pvs_bs', 'Benedita Sá Fortes', true, 'pvs', 147, 'Jurista e defensora de direitos. Serena, estudiosa, muito respeitada.', 72, 40, 54),
  v('nrm_rh', 'Rodrigo Hasselmann', false, 'nrm', 97, 'Economista liberal puro. Honesto e rígido; briga por cada corte.', 68, 46, 45),
  v('nrm_pd', 'Priscila Dutra Vaz', true, 'nrm', 153, 'Empreendedora e deputada de primeiro mandato. Moderna, direta, impaciente.', 58, 62, 56),
  v('nrm_ib', 'Ícaro Bittencourt', false, 'nrm', 103, 'Gestor de fundo e crítico do Estado. Respeitado, mas sem bancada.', 52, 58, 44),
]

export const VICE_BY_ID: Record<string, VicePerfil> = Object.fromEntries(VICES.map((x) => [x.id, x]))

export interface LiderPerfil {
  id: string
  name: string
  feminine: boolean
  portrait: number
  perfil: string
  /** Oculta: competência e lealdade verdadeiras. */
  competencia: number
  lealdade: number
}

const l = (id: string, name: string, feminine: boolean, portrait: number, perfil: string, competencia: number, lealdade: number): LiderPerfil =>
  ({ id, name, feminine, portrait, perfil, competencia, lealdade })

/** Quem pode ser líder do governo na Câmara (e vice-líder): deputados do partido do presidente. Todos fictícios. */
export const LIDERES: LiderPerfil[] = [
  l('lg_va', 'Vânia Cruz Arantes', true, 102, 'Articuladora de casa cheia: sabe contar votos e cobrar sem gritar.', 76, 70),
  l('lg_lb', 'Lorena Bittar', true, 104, 'Estrela de primeiro mandato, simpática e rápida. Falta calo de plenário.', 55, 60),
  l('lg_sm', 'Sheila Montalvão', true, 148, 'Veterana de comissões, dura e direta. Conhece o regimento de cor.', 72, 55),
  l('lg_rv', 'Rosana Veloso', true, 151, 'Leal e organizada. Presença constante, discurso comedido.', 62, 80),
  l('lg_aq', 'Anselmo Quirino', false, 106, 'Jovem líder de bancada, ambicioso e muito ativo nas redes.', 60, 52),
  l('lg_cm', 'Cássio Marcondes', false, 118, 'Negociador paciente, de poucos amigos e muitos favores guardados.', 70, 62),
  l('lg_nr', 'Ney Ramalho', false, 143, 'Companheiro de longa data do presidente. Leal, mas pouco brilhante.', 48, 85),
  l('lg_fl', 'Flávio Lacerda', false, 149, 'Ex-presidente de comissão. Competente, cobra um preço por tudo.', 74, 45),
]

export const LIDER_BY_ID: Record<string, LiderPerfil> = Object.fromEntries(LIDERES.map((x) => [x.id, x]))

export function propostaBlockedReason(ids: string[] | undefined): string | null {
  if (!ids || ids.length === 0) return null
  if (ids.length !== GOVERNO.vice.propostas) return `Proponha exatamente ${GOVERNO.vice.propostas} nomes para vice.`
  if (new Set(ids).size !== ids.length) return 'Nome repetido na proposta de vice.'
  if (ids.some((id) => !VICE_BY_ID[id])) return 'Candidato a vice desconhecido.'
  return null
}
