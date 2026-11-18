import type { PartyId } from '../types'

/**
 * v0.48.0: dossiê de cada partido, mostrado na escolha do partido do presidente (Novo mandato).
 * Tudo fictício. As forças e fraquezas são descrição; a mecânica vem dos números de `parties.ts`
 * (bancada, disciplina, fisiologismo) e dos grupos que são base do partido (`groups.ts`).
 */
export type Lado = 'esquerda' | 'centro' | 'direita'

export interface DossieDef {
  lado: Lado
  /** Uma linha para o cartão. */
  lema: string
  historia: string
  alinhamento: string[]
  forcas: string[]
  fraquezas: string[]
  aliados: PartyId[]
  rivais: PartyId[]
}

export const LADOS: { id: Lado; nome: string }[] = [
  { id: 'esquerda', nome: 'Esquerda' },
  { id: 'centro', nome: 'Centro' },
  { id: 'direita', nome: 'Direita' },
]

export const DOSSIE: Record<PartyId, DossieDef> = {
  fpt: {
    lado: 'esquerda',
    lema: 'A máquina sindical do país. Fiel, disciplinada e desconfiada do mercado.',
    historia: 'Nasceu em 1983 da fusão de comitês de greve, pastorais operárias e associações de bairro. Governou quatro mandatos e carrega o orgulho e o desgaste de quem já foi poder. Quando perde vai para a rua; quando ganha, a rua a cobra.',
    alinhamento: ['Estatal e redistributiva: defende gasto social, piso e crédito público', 'Progressista em direitos, com ala sindical mais cautelosa nos costumes', 'Voto fechado: a direção manda e a bancada segue'],
    forcas: ['Sindicatos e periferia', 'Bancada fechada'],
    fraquezas: ['Mercado hostil', 'Marca desgastada por casos antigos'],
    aliados: ['pvs', 'mdn'],
    rivais: ['pol', 'nrm'],
  },
  pvs: {
    lado: 'esquerda',
    lema: 'Ecologia e direitos. Poucos votos, muita voz.',
    historia: 'Surgiu de ONGs, ecologistas e coletivos de direitos que não cabiam em partido grande. Vive entre o purismo e a necessidade de fazer acordo: cada concessão custa caro dentro de casa e rende crítica fora.',
    alinhamento: ['Ambientalismo como programa de governo, não como enfeite', 'Os costumes mais progressistas da Câmara', 'Desconfia de bancos e do agro grande'],
    forcas: ['Pauta de direitos e clima', 'Voz na imprensa'],
    fraquezas: ['Bancada pequena', 'Pouco alcance no interior'],
    aliados: ['fpt'],
    rivais: ['mrb', 'pol', 'ucd'],
  },
  mdn: {
    lado: 'centro',
    lema: 'O centro histórico: conversa com todo mundo.',
    historia: 'Herdeiro do centro que costurou a redemocratização. Hoje é um arquipélago de caciques estaduais: nenhum fala pelo partido inteiro. Governou com todos, por isso é aceito por todos e controlado por ninguém.',
    alinhamento: ['Equilíbrio fiscal moderado e política social sem alarde', 'Evita guerra de costumes: prefere "o que dá para aprovar"', 'Nunca rompe: negocia até o último voto'],
    forcas: ['Aceito por todos os lados', 'Quadros experientes'],
    fraquezas: ['Bancada pequena e indisciplinada', 'Sem identidade forte'],
    aliados: ['psn', 'pra', 'ucd'],
    rivais: [],
  },
  psn: {
    lado: 'centro',
    lema: 'Forte nas prefeituras. Apoia quem estiver bem.',
    historia: 'Cresceu das prefeituras: quem controla o município controla o voto. Pragmático, apoia quem entrega obra e esfria quando a pesquisa cai. Seus prefeitos são sua moeda.',
    alinhamento: ['Pragmatismo municipalista: ideologia vem depois da obra', 'Posição de centro, mas gira com o humor do eleitor', 'Fisiológico moderado: troca apoio por convênio'],
    forcas: ['Capilaridade municipal', 'Flexibilidade'],
    fraquezas: ['Lealdade condicional', 'Sem projeto nacional'],
    aliados: ['mdn', 'ucd'],
    rivais: [],
  },
  pra: {
    lado: 'centro',
    lema: 'Siglas fundidas para sobreviver. Cada deputado por si.',
    historia: 'Costura de oito siglas moribundas para passar na cláusula de barreira. Sem ideologia comum: cada deputado negocia sozinho, e o líder administra o caos. Vota onde o dia pede.',
    alinhamento: ['Centro por falta de opção, não por convicção', 'Aceita qualquer pauta que renda cargo', 'Discurso de "renovação" vazio, mas popular entre jovens'],
    forcas: ['Negocia rápido', 'Aceita quase tudo'],
    fraquezas: ['Pouca coesão', 'Troca de lado sem aviso'],
    aliados: ['mdn', 'ucd'],
    rivais: [],
  },
  ucd: {
    lado: 'direita',
    lema: 'O centrão: comissões, cargos e aritmética.',
    historia: 'O centrão profissional, nascido de ex-governistas de todos os regimes. Não faz ideologia, faz aritmética: comissões, relatorias, cargos. Já esteve em todos os governos e quer estar no próximo.',
    alinhamento: ['Centro-direita pelo voto da base empresarial do interior', 'Liberal na economia quando a pauta paga', 'Troca tudo por poder: o preço é o programa'],
    forcas: ['Controla comissões', 'Sabe contar votos'],
    fraquezas: ['Cobra caro', 'Some quando o governo cai'],
    aliados: ['psn', 'mdn', 'pol'],
    rivais: ['pvs'],
  },
  pol: {
    lado: 'direita',
    lema: 'A maior bancada: ordem nos costumes, liberal na economia.',
    historia: 'Partido de empresários, oficiais da reserva e classe média indignada, que virou a maior bancada ao canalizar o medo da desordem. Tem uma base ideológica barulhenta e uma cúpula que negocia sem alarde.',
    alinhamento: ['Liberal na economia, conservador nos costumes', 'Segurança pública como bandeira central', 'Base barulhenta, cúpula pragmática'],
    forcas: ['Maior bancada', 'Disciplina alta'],
    fraquezas: ['A esquerda vai para a rua', 'Rejeição entre jovens'],
    aliados: ['ucd', 'mrb', 'nrm'],
    rivais: ['fpt', 'pvs'],
  },
  mrb: {
    lado: 'direita',
    lema: 'A direita religiosa. Inflexível em costumes.',
    historia: 'Braço político de igrejas evangélicas. A disciplina vem do púlpito, não do estatuto. Inflexível em família e costumes; flexível na economia, desde que a igreja saia bem.',
    alinhamento: ['Costumes conservadores como inegociável', 'Economia liberal moderada, com assistência via igreja', 'Voto de rebanho: o pastor decide'],
    forcas: ['Base religiosa fiel', 'Capilaridade nas periferias'],
    fraquezas: ['Bancada pequena', 'Veto automático em pauta de costumes'],
    aliados: ['pol', 'ucd'],
    rivais: ['pvs', 'fpt'],
  },
  nrm: {
    lado: 'direita',
    lema: 'Liberais puros. Não trocam voto por cargo.',
    historia: 'Criado por economistas, fundos e jovens empreendedores cansados do Estado grande. Não troca voto por cargo, o que o torna incorruptível e quase isolado: ganha elogio na imprensa e perde votação no plenário.',
    alinhamento: ['Liberalismo econômico radical: privatizar, cortar, desregular', 'Costumes liberais: "o Estado fora do quarto"', 'Nenhuma tolerância com fisiologismo'],
    forcas: ['Credibilidade fiscal', 'Disciplina total'],
    fraquezas: ['Bancada minúscula', 'Rejeitado por sindicatos e servidores'],
    aliados: ['pol'],
    rivais: ['fpt', 'pvs'],
  },
}
