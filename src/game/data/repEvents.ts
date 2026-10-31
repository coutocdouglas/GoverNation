import type { EventDef } from './events'

/**
 * Etapa 1 (v0.16): desdobramentos da reputação. Só aparecem quando uma marca fica forte
 * (data/marks.ts); {lei} é a decisão mais recente que puxou a marca.
 * Personagens fictícios (retratos provisórios a partir do 111).
 */
const P = {
  colunista: { name: 'Sílvia Mattoso', role: 'Colunista política', feminine: true, color: '#c0567a' },
  agencia: { name: 'Rogério Albuquerque', role: 'Economista-chefe da agência de risco Atlas', feminine: false, color: '#3a7bd5' },
  juristas: { name: 'Dr. Fausto Lemos', role: 'Presidente da Ordem dos Juristas', feminine: false, color: '#7a5c3a' },
  pesquisa: { name: 'Lúcia Arantes', role: 'Diretora do instituto de pesquisa Pulso', feminine: true, color: '#2bb3a3' },
  rua: { name: 'Joel Brandão', role: 'Coordenador do movimento Basta', feminine: false, color: '#d62d2d' },
  centrao: { name: 'Baltazar Moura', role: 'Líder do UCD', feminine: false, color: '#e98a15' },
}

export const REP_EVENTS: EventDef[] = [
  {
    id: 'repImpopular', area: 'politica', tag: 'Desdobramento · rua', icon: '📢', weight: 0, random: false, kind: 'consequencia', importance: 4,
    title: 'Protestos contra {lei} tomam as capitais',
    text: 'A medida mal saiu do Planalto e já virou símbolo: o movimento Basta convoca atos em 20 capitais e diz que o governo “não ouve ninguém”.',
    presenter: P.rua,
    options: [
      { icon: '🤝', label: 'Receber os organizadores', text: 'Ouvir não custa caro, e baixa a temperatura.', effects: { groups: { trabalhadores: 2, jovens: 2, classeMedia: 1 } }, outcome: 'Presidente recebe organizadores dos protestos e promete ouvir', tone: 'good' },
      { icon: '📺', label: 'Defender a medida em rede nacional', text: 'Explica o porquê. Convence uns, irrita outros.', effects: { groups: { empresarios: 1, classeMedia: -1, jovens: -2 } }, outcome: 'Em rede nacional, presidente defende a medida e panelaços respondem', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'Os atos crescem e a oposição sobe no palanque.', effects: { groups: { trabalhadores: -2, jovens: -3, classeMedia: -2, baixaRenda: -1 } }, outcome: 'Protestos crescem e oposição discursa nos carros de som', tone: 'bad', default: true },
    ],
  },
  {
    id: 'repGastador', area: 'economia', tag: 'Desdobramento · contas', icon: '📉', weight: 0, random: false, kind: 'consequencia', importance: 4,
    title: 'Agência de risco ameaça rebaixar o país depois de {lei}',
    text: 'A agência Atlas põe a nota do Brasil em observação: “gasto novo sem fonte, mês após mês”. O dólar abre em alta.',
    presenter: P.agencia,
    options: [
      { icon: '✂️', label: 'Anunciar um corte de gastos', text: 'Acalma o mercado; servidores e programas sentem.', effects: { spending: -0.1, confidence: 4, groups: { servidores: -2, baixaRenda: -1 } }, outcome: 'Governo anuncia corte e agência mantém a nota', tone: 'good' },
      { icon: '🗣️', label: 'Dizer que o gasto é investimento', text: 'Discurso não paga conta.', effects: { confidence: -2 }, outcome: 'Mercado não compra o discurso e o dólar sobe', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'A nota cai. Juros e dólar sobem.', effects: { confidence: -6, expectations: 0.2 }, outcome: 'Agência rebaixa a nota do Brasil', tone: 'bad', default: true },
    ],
  },
  {
    id: 'repFiscalista', area: 'economia', tag: 'Desdobramento · mercado', icon: '📈', weight: 0, random: false, kind: 'bom', importance: 3,
    title: 'Mercado elogia o ajuste e a agência melhora a perspectiva do país',
    text: 'Depois de {lei}, a agência Atlas fala em “compromisso fiscal crível”. Os juros futuros caem.',
    presenter: P.agencia,
    options: [
      { icon: '📣', label: 'Comemorar em público', text: 'O mercado aplaude; quem perdeu com o ajuste, não.', effects: { confidence: 2, groups: { empresarios: 2, baixaRenda: -1, servidores: -1 } }, outcome: 'Governo comemora melhora da nota', tone: 'good', promote: true },
      { icon: '🤫', label: 'Ficar quieto e seguir', text: 'Sem alarde. O efeito vem sozinho.', effects: { confidence: 1 }, outcome: 'Juros futuros caem com a melhora da perspectiva', tone: 'good', default: true },
    ],
  },
  {
    id: 'repDecreto', area: 'politica', tag: 'Desdobramento · instituições', icon: '🖊️', weight: 0, random: false, kind: 'consequencia', importance: 3,
    title: 'Juristas acusam o governo de “governar por decreto”',
    text: 'A Ordem dos Juristas publica nota depois de {lei}: “o Congresso virou espectador”. Partidos assinam embaixo.',
    presenter: P.juristas,
    options: [
      { icon: '📜', label: 'Prometer mandar mais leis ao Congresso', text: 'Agrada partidos e juristas; o governo fica mais lento.', effects: { groups: { classeMedia: 1 } }, parties: { ucd: 3, psn: 3, pol: 2 }, outcome: 'Presidente promete passar mais pelo Congresso', tone: 'good' },
      { icon: '⚔️', label: 'Rebater: “o povo tem pressa”', text: 'A base gosta. Juristas e Supremo anotam.', effects: { groups: { classeMedia: -1, trabalhadores: 1 } }, outcome: 'Presidente rebate juristas e acirra a crise com as instituições', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'A nota vira editorial.', effects: { groups: { classeMedia: -2 } }, parties: { ucd: -2, psn: -2 }, outcome: 'Editoriais criticam excesso de decretos', tone: 'bad', default: true },
    ],
  },
  {
    id: 'repPalavra', area: 'politica', tag: 'Desdobramento · base', icon: '🤝', weight: 0, random: false, kind: 'bom', importance: 2,
    title: 'Líderes elogiam: “com este governo, acordo é acordo”',
    text: 'Depois de {lei}, líderes do centro dizem que o governo cumpre o que promete. A conversa fica mais barata.',
    presenter: P.centrao,
    options: [
      { icon: '🍽️', label: 'Jantar com os líderes', text: 'Consolida a base.', effects: {}, parties: { ucd: 4, psn: 4, mdn: 3, pra: 3 }, outcome: 'Jantar no Alvorada consolida a base', tone: 'good' },
      { icon: '🤫', label: 'Agradecer e seguir', text: 'A boa fama trabalha sozinha.', effects: {}, parties: { ucd: 2, psn: 2 }, outcome: 'Base elogia a palavra do governo', tone: 'good', default: true },
    ],
  },
  {
    id: 'repFura', area: 'politica', tag: 'Desdobramento · base', icon: '🗡️', weight: 0, random: false, kind: 'consequencia', importance: 4,
    title: 'Centrão cobra a fatura: “promessa não cumprida”',
    text: '{lei} ficou no papel e o UCD avisa: sem pagamento, nada mais anda na Câmara. Outros partidos observam.',
    presenter: P.centrao,
    options: [
      { icon: '💰', label: 'Pagar com emendas agora', text: 'Resolve, custa dinheiro e cheiro de balcão.', effects: { temp: { amount: 0.05, months: 6 }, groups: { classeMedia: -1 } }, parties: { ucd: 8, psn: 3 }, outcome: 'Governo libera emendas e acalma o centrão', tone: 'neutral' },
      { icon: '🚪', label: 'Romper com quem cobra', text: 'Mostra força. A base encolhe.', effects: { groups: { classeMedia: 1, jovens: 1 } }, parties: { ucd: -10, psn: -3 }, outcome: 'Governo rompe com o UCD', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'A fama de quem fura acordo se espalha.', effects: {}, parties: { ucd: -6, psn: -4, mdn: -3, pra: -3 }, outcome: 'Partidos do centro passam a desconfiar do governo', tone: 'bad', default: true },
    ],
  },
  {
    id: 'repOmisso', area: 'politica', tag: 'Desdobramento · imagem', icon: '🙈', weight: 0, random: false, kind: 'consequencia', importance: 3,
    title: 'Editorial pergunta: “Onde está o presidente?”',
    text: 'Depois de {lei}, a colunista Sílvia Mattoso lista as crises que passaram sem resposta. A pergunta vira meme.',
    presenter: P.colunista,
    options: [
      { icon: '🚁', label: 'Agenda de rua: visitar o país', text: 'Presença conta. Custa um pouco.', effects: { temp: { amount: 0.02, months: 2 }, groups: { baixaRenda: 2, trabalhadores: 2, classeMedia: 1 } }, outcome: 'Presidente cai na estrada e muda a conversa', tone: 'good' },
      { icon: '🎙️', label: 'Dar uma entrevista longa', text: 'Explica as escolhas. Funciona pela metade.', effects: { groups: { classeMedia: 1 } }, outcome: 'Entrevista do presidente divide opiniões', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'O meme pega.', effects: { groups: { jovens: -2, classeMedia: -2, baixaRenda: -1 } }, outcome: '“Onde está o presidente?” vira bordão da oposição', tone: 'bad', default: true },
    ],
  },
  {
    id: 'repEnfrenta', area: 'politica', tag: 'Desdobramento · pesquisa', icon: '🛡️', weight: 0, random: false, kind: 'bom', importance: 3,
    title: 'Pesquisa: maioria aprova como o governo lida com as crises',
    text: 'O instituto Pulso cita {lei} como exemplo: “o governo responde rápido”. Até eleitores da oposição reconhecem.',
    presenter: P.pesquisa,
    options: [
      { icon: '📣', label: 'Usar na propaganda', text: 'Rende, se o mérito for seu.', effects: { groups: { classeMedia: 2, trabalhadores: 1, jovens: 1 } }, outcome: 'Governo usa a pesquisa na propaganda', tone: 'good', promote: true },
      { icon: '🤫', label: 'Agradecer e seguir', text: 'Sem alarde.', effects: { groups: { classeMedia: 1 } }, outcome: 'Pesquisa reforça imagem de governo que responde', tone: 'good', default: true },
    ],
  },
  {
    id: 'repDerrotado', area: 'politica', tag: 'Desdobramento · Congresso', icon: '🏳️', weight: 0, random: false, kind: 'consequencia', importance: 4,
    title: 'Depois de {lei}, imprensa fala em “governo sem base”',
    text: 'Mais uma derrota no plenário. Aliados pedem cargos e a oposição já fala em pautar o que quiser.',
    presenter: P.colunista,
    options: [
      { icon: '🏢', label: 'Prometer reforma ministerial', text: 'Abre espaço para aliados. O próprio partido torce o nariz.', effects: {}, parties: { ucd: 5, psn: 5, pra: 3 }, outcome: 'Presidente acena com reforma ministerial para recompor a base', tone: 'neutral' },
      { icon: '🎤', label: 'Ir às redes contra o Congresso', text: 'A base vibra. Os deputados lembram.', effects: { groups: { trabalhadores: 1, jovens: 1, empresarios: -1 } }, parties: { ucd: -4, psn: -3 }, outcome: 'Presidente ataca o Congresso nas redes', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'A fama de governo fraco cola.', effects: { confidence: -2, groups: { classeMedia: -1 } }, outcome: 'Governo é visto como fraco no Congresso', tone: 'bad', default: true },
    ],
  },
  {
    id: 'repConfronto', area: 'politica', tag: 'Desdobramento · Supremo', icon: '⚔️', weight: 0, random: false, kind: 'consequencia', importance: 4,
    title: 'Supremo reage aos ataques do governo',
    text: 'Depois de {lei}, ministros da corte falam em “ameaça à independência dos poderes”. Juristas engrossam o coro.',
    presenter: P.juristas,
    options: [
      { icon: '🕊️', label: 'Visitar o Supremo e baixar o tom', text: 'A base estranha; a corte agradece.', effects: { confidence: 2, groups: { trabalhadores: -1 } }, outcome: 'Presidente visita o Supremo e baixa a temperatura', tone: 'good' },
      { icon: '⚔️', label: 'Dobrar a aposta', text: 'A base adora. O resto do país se preocupa.', effects: { confidence: -3, groups: { classeMedia: -2, trabalhadores: 1 } }, outcome: 'Presidente dobra a aposta contra o Supremo', tone: 'bad' },
      { icon: '🙈', label: 'Deixar passar', text: 'A crise esfria sozinha, devagar.', effects: { confidence: -1 }, outcome: 'Crise entre governo e Supremo segue no ar', tone: 'neutral', default: true },
    ],
  },
]
