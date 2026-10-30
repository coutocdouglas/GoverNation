import type { EventDef, EventOption } from './events'

/**
 * Memória do mundo: o que cada lei, decreto ou decisão pode provocar no futuro.
 * Quando algo é aprovado, o jogo planta uma "semente" com data para brotar.
 * Ao brotar, a semente vira um fato do mês (bom ou ruim), mesmo mandatos depois.
 *
 * Nos textos, {lei} é o nome da medida, {autor} quem a aprovou e {ano} o ano.
 */
export interface SeedRule {
  /** Fato do mês que nasce (id em CONSEQUENCE_EVENTS). */
  event: string
  /** Meses até brotar: sorteado entre min e max. */
  delay: [number, number]
  /** Chance de a semente existir. */
  chance: number
}

/** Fonte (id de lei, decreto ou herança) → o que pode brotar dela. */
export const SEED_RULES: Record<string, SeedRule[]> = {
  reformaTributaria: [
    { event: 'transicaoTributaria', delay: [5, 9], chance: 0.8 },
    { event: 'tributariaFrutos', delay: [18, 30], chance: 0.85 },
  ],
  privatizar: [
    { event: 'investimentoEnergia', delay: [12, 20], chance: 0.55 },
    { event: 'tarifaLuz', delay: [8, 16], chance: 0.5 },
  ],
  salarioMinimo: [{ event: 'romboPrevidencia', delay: [18, 30], chance: 0.7 }],
  programaSocial: [{ event: 'quedaPobreza', delay: [10, 18], chance: 0.8 }],
  regraFiscal: [
    { event: 'grauInvestimento', delay: [14, 26], chance: 0.6 },
    { event: 'universidadesSemVerba', delay: [8, 14], chance: 0.6 },
  ],
  licenciamento: [{ event: 'barragem', delay: [10, 30], chance: 0.45 }],
  reformaAdministrativa: [{ event: 'servicoDigital', delay: [18, 30], chance: 0.7 }],
  isencaoIR: [{ event: 'estadosSemArrecadacao', delay: [6, 12], chance: 0.6 }],
  taxarDividendos: [{ event: 'empresasMudamSede', delay: [6, 12], chance: 0.5 }],
  penasDuras: [{ event: 'rebeliao', delay: [12, 24], chance: 0.6 }],
  anteciparObras: [{ event: 'obraInaugurada', delay: [8, 14], chance: 0.6 }],
  // Heranças do governo anterior, plantadas no início do primeiro mandato.
  herancaObra: [{ event: 'obraInaugurada', delay: [5, 12], chance: 1 }],
  herancaPensoes: [{ event: 'romboPrevidencia', delay: [16, 28], chance: 1 }],
  herancaAcordo: [{ event: 'acordoComercial', delay: [14, 26], chance: 1 }],
}

/** Heranças que o primeiro mandato recebe do governo anterior (fictício). */
export const INHERITANCE = [
  { source: 'herancaObra', label: 'Ferrovia Transnordestina Norte', author: 'Governo anterior' },
  { source: 'herancaPensoes', label: 'Reajuste de pensões sem fonte de receita', author: 'Governo anterior' },
  { source: 'herancaAcordo', label: 'Acordo comercial com a Ásia', author: 'Governo anterior' },
]

/**
 * Opções de um fato bom: se promover, dar o crédito a quem fez ou ignorar.
 * Promover algo que outro governo fez tem risco de a oposição desmentir.
 */
export const GOOD_OPTIONS: EventOption[] = [
  { icon: '📣', label: 'Promover o governo', text: 'Cerimônia, discurso e propaganda. Se a obra não for sua, a oposição pode desmentir.', effects: { groups: { trabalhadores: 2, baixaRenda: 2, classeMedia: 2, jovens: 1 } }, outcome: 'Governo faz festa e chama o feito de seu', tone: 'good', promote: true },
  { icon: '🤝', label: 'Dar o crédito a quem fez', text: 'Gesto de grandeza: rende menos voto, mas aproxima o partido do autor.', effects: { groups: { classeMedia: 1, jovens: 1 } }, outcome: 'Presidente divide o crédito com quem começou o projeto', tone: 'good', credit: true },
  { icon: '🙈', label: 'Deixar passar', text: 'Ninguém fica sabendo direito.', effects: {}, outcome: 'Boa notícia passa quase despercebida', tone: 'neutral', default: true },
]

const good = (o: Partial<EventDef> & Pick<EventDef, 'id' | 'icon' | 'title' | 'text' | 'presenter' | 'importance'>): EventDef => ({
  tag: 'Boa notícia', weight: 0, random: false, kind: 'bom', options: GOOD_OPTIONS, ...o,
})

export const CONSEQUENCE_EVENTS: EventDef[] = [
  {
    id: 'transicaoTributaria', tag: 'Consequência · impostos', icon: '🧾', weight: 0, random: false, kind: 'consequencia', importance: 3,
    title: 'Transição de {lei} confunde empresas',
    text: 'Sistemas novos, regras duplicadas e notas fiscais travadas. Associações pedem adiar o cronograma aprovado em {ano}.',
    presenter: { name: 'Marta Quintela', role: 'Secretária do Tesouro', feminine: true, color: '#1e5bd8' },
    options: [
      { icon: '🛠️', label: 'Força-tarefa de suporte', text: 'Receita atende as empresas e corrige o sistema.', effects: { temp: { amount: 0.02, months: 4 }, groups: { empresarios: 3 } }, outcome: 'Força-tarefa reduz filas da transição tributária', tone: 'good' },
      { icon: '📆', label: 'Adiar parte da transição', text: 'Alivia agora, adia os ganhos.', effects: { potential: -0.03, groups: { empresarios: 2 } }, outcome: 'Governo adia etapa da reforma tributária', tone: 'neutral' },
      { icon: '🙈', label: 'Manter tudo como está', text: 'Uma hora se acostumam.', effects: { confidence: -2, groups: { empresarios: -3 } }, outcome: 'Empresas reclamam do caos na transição tributária', tone: 'bad', default: true },
    ],
  },
  good({
    id: 'tributariaFrutos', icon: '📈', importance: 3, tag: 'Boa notícia · economia',
    title: 'Indústria cresce graças a {lei}',
    text: 'Com menos impostos em cascata, a produção industrial tem o melhor ano em uma década. A reforma foi aprovada em {ano} por {autor}.',
    presenter: { name: 'Marta Quintela', role: 'Secretária do Tesouro', feminine: true, color: '#1e5bd8' },
  }),
  good({
    id: 'investimentoEnergia', icon: '⚡', importance: 2, tag: 'Boa notícia · energia',
    title: 'Nova dona da estatal anuncia R$ 40 bi em investimentos',
    text: 'A empresa privatizada em {ano} por {autor} vai ampliar usinas e linhas de transmissão.',
    presenter: { name: 'Rui Damasceno', role: 'Ministro de Minas e Energia', feminine: false, color: '#2bb3a3' },
  }),
  {
    id: 'tarifaLuz', tag: 'Consequência · energia', icon: '💡', weight: 0, random: false, kind: 'consequencia', importance: 3,
    title: 'Conta de luz sobe 18% após {lei}',
    text: 'A empresa privatizada em {ano} repassou custos. Consumidores e prefeitos reclamam.',
    presenter: { name: 'Rui Damasceno', role: 'Ministro de Minas e Energia', feminine: false, color: '#2bb3a3' },
    options: [
      { icon: '⚖️', label: 'Agência reguladora revê o reajuste', text: 'Segura a conta e assusta investidores.', effects: { confidence: -2, groups: { classeMedia: 2, baixaRenda: 2, empresarios: -2 } }, outcome: 'Reajuste da conta de luz é revisto', tone: 'neutral' },
      { icon: '💸', label: 'Subsidiar a tarifa social', text: 'Protege os mais pobres; custa caro.', effects: { temp: { amount: 0.05, months: 12 }, groups: { baixaRenda: 4 } }, outcome: 'Tarifa social de energia é ampliada', tone: 'good' },
      { icon: '🙈', label: 'Respeitar o contrato', text: 'O contrato é o contrato.', effects: { groups: { classeMedia: -3, baixaRenda: -3 } }, outcome: 'Conta de luz mais cara pesa no bolso', tone: 'bad', default: true },
    ],
  },
  {
    id: 'romboPrevidencia', tag: 'Consequência · contas públicas', icon: '👴', weight: 0, random: false, kind: 'consequencia', importance: 4,
    title: 'Rombo da Previdência cresce por causa de {lei}',
    text: 'Os reajustes acima da inflação aprovados em {ano} por {autor} aumentaram o gasto com benefícios mais que o previsto.',
    presenter: { name: 'Marta Quintela', role: 'Secretária do Tesouro', feminine: true, color: '#1e5bd8' },
    options: [
      { icon: '✂️', label: 'Limitar reajustes futuros', text: 'Resolve as contas; aposentados não gostam.', effects: { spending: -0.15, confidence: 3, groups: { trabalhadores: -3, baixaRenda: -2 } }, outcome: 'Governo limita reajustes de benefícios', tone: 'neutral' },
      { icon: '💰', label: 'Cobrir com mais dívida', text: 'Ninguém sente agora.', effects: { confidence: -3 }, outcome: 'Tesouro emite dívida para cobrir a Previdência', tone: 'bad' },
      { icon: '🙈', label: 'Empurrar o problema', text: 'O próximo governo resolve.', effects: { confidence: -4, expectations: 0.1 }, outcome: 'Rombo da Previdência assusta o mercado', tone: 'bad', default: true },
    ],
  },
  good({
    id: 'quedaPobreza', icon: '📉', importance: 3, tag: 'Boa notícia · social',
    title: 'Pobreza cai ao menor nível da série',
    text: 'O IBGE atribui parte da queda a {lei}, aprovada em {ano} por {autor}.',
    presenter: { name: 'Lúcia Vasconcelos', role: 'Ministra do Trabalho', feminine: true, color: '#d62d2d' },
  }),
  good({
    id: 'grauInvestimento', icon: '🏆', importance: 4, tag: 'Boa notícia · mercado',
    title: 'Agência devolve ao país o grau de investimento',
    text: 'A nota sobe citando {lei}, aprovada em {ano}. O dólar cai e os juros longos recuam.',
    presenter: { name: 'Marta Quintela', role: 'Secretária do Tesouro', feminine: true, color: '#1e5bd8' },
    effects: { confidence: 6 },
  }),
  {
    id: 'universidadesSemVerba', tag: 'Consequência · educação', icon: '🎓', weight: 0, random: false, kind: 'consequencia', importance: 2,
    title: 'Universidades cortam bolsas por causa de {lei}',
    text: 'Os limites de gasto aprovados em {ano} chegaram às federais. Reitores falam em fechar laboratórios.',
    presenter: { name: 'Iara Couto', role: 'Líder do sindicato docente', feminine: true, color: '#d62d2d' },
    options: [
      { icon: '🔓', label: 'Remanejar verba para as federais', text: 'Tira de outro lugar.', effects: { groups: { jovens: 3, servidores: 2 } }, outcome: 'Governo remaneja verba e salva bolsas', tone: 'good' },
      { icon: '🙈', label: 'Manter os cortes', text: 'A regra é a regra.', effects: { groups: { jovens: -2, servidores: -1 } }, outcome: 'Federais cortam bolsas de pesquisa', tone: 'bad', default: true },
    ],
  },
  {
    id: 'barragem', tag: 'Consequência · tragédia ambiental', icon: '🌊', weight: 0, random: false, kind: 'consequencia', importance: 5,
    title: 'Barragem licenciada pela regra nova se rompe',
    text: 'A obra recebeu licença rápida graças a {lei}, aprovada em {ano} por {autor}. Há mortos e uma cidade coberta de lama.',
    presenter: { name: 'Glória Matos', role: 'Ministra do Meio Ambiente', feminine: true, color: '#4f7a2a' },
    options: [
      { icon: '🚨', label: 'Resgate federal e endurecer a lei', text: 'Assume o erro e muda a regra.', effects: { temp: { amount: 0.08, months: 6 }, potential: -0.03, groups: { jovens: 3, baixaRenda: 2, agro: -3 } }, outcome: 'Governo endurece licenciamento após tragédia', tone: 'neutral' },
      { icon: '⚖️', label: 'Culpar a empresa', text: 'Multa recorde e silêncio sobre a lei.', effects: { groups: { classeMedia: -2, jovens: -3 } }, outcome: 'Governo culpa empresa e evita falar da lei', tone: 'bad' },
      { icon: '🙈', label: 'Deixar com o estado', text: 'Imperdoável numa tragédia.', effects: { groups: { trabalhadores: -4, baixaRenda: -5, classeMedia: -5, jovens: -5 } }, outcome: 'Ausência do governo na tragédia revolta o país', tone: 'bad', default: true },
    ],
  },
  good({
    id: 'servicoDigital', icon: '📱', importance: 2, tag: 'Boa notícia · serviços',
    title: 'Serviço público digital vira referência',
    text: 'Carreiras reorganizadas por {lei} ({ano}) cortaram filas: 90% dos serviços agora são pelo celular.',
    presenter: { name: 'Wagner Teles', role: 'Diretor de Segurança Digital', feminine: false, color: '#8b6fd6' },
  }),
  {
    id: 'estadosSemArrecadacao', tag: 'Consequência · federação', icon: '🏛️', weight: 0, random: false, kind: 'consequencia', importance: 2,
    title: 'Governadores cobram compensação por {lei}',
    text: 'A isenção aprovada em {ano} reduziu os repasses aos estados. Governadores ameaçam atrasar salários.',
    presenter: { name: 'Heitor Valadares', role: 'Governador do Sul', feminine: false, color: '#1e5bd8' },
    options: [
      { icon: '💵', label: 'Compensar os estados', text: 'Caro, mas evita a briga.', effects: { spending: 0.08 }, parties: { psn: 4, mdn: 4 }, outcome: 'União compensa estados pela isenção do IR', tone: 'neutral' },
      { icon: '🙈', label: 'Negar', text: 'Cada um com seu problema.', effects: { groups: { servidores: -2 } }, parties: { psn: -3, mdn: -3 }, outcome: 'Governadores e Planalto em guerra por repasses', tone: 'bad', default: true },
    ],
  },
  {
    id: 'empresasMudamSede', tag: 'Consequência · investimento', icon: '✈️', weight: 0, random: false, kind: 'consequencia', importance: 2,
    title: 'Grandes empresas mudam sede para o exterior',
    text: 'Três grupos citam {lei} ({ano}) ao transferir a holding para fora.',
    presenter: { name: 'Marta Quintela', role: 'Secretária do Tesouro', feminine: true, color: '#1e5bd8' },
    options: [
      { icon: '🤝', label: 'Negociar regra de transição', text: 'Suaviza a cobrança.', effects: { revenue: -0.05, groups: { empresarios: 3 } }, outcome: 'Governo suaviza tributação de dividendos', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar ir', text: 'Quem quer sair, sai.', effects: { confidence: -2, groups: { empresarios: -2 } }, outcome: 'Saída de empresas vira símbolo da oposição', tone: 'bad', default: true },
    ],
  },
  {
    id: 'rebeliao', tag: 'Consequência · presídios', icon: '🔒', weight: 0, random: false, kind: 'consequencia', importance: 3,
    title: 'Rebelião em presídio superlotado',
    text: 'Com penas mais longas por {lei} ({ano}), as cadeias estão com o dobro da capacidade.',
    presenter: { name: 'Vera Toledo', role: 'Chefe da Controladoria', feminine: true, color: '#8b6fd6' },
    options: [
      { icon: '🏗️', label: 'Construir vagas e mutirão judicial', text: 'Resolve aos poucos.', effects: { temp: { amount: 0.04, months: 8 }, groups: { classeMedia: 2 } }, outcome: 'Governo lança plano de vagas em presídios', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar com os estados', text: 'Segurança é dos estados.', effects: { groups: { classeMedia: -3, baixaRenda: -1 } }, outcome: 'Rebelião termina com mortos e crítica ao governo', tone: 'bad', default: true },
    ],
  },
  good({
    id: 'obraInaugurada', icon: '🚆', importance: 2, tag: 'Boa notícia · obra pronta',
    title: 'Obra fica pronta: {lei}',
    text: 'Iniciada por {autor} em {ano}, a obra entra em operação e gera empregos na região.',
    presenter: { name: 'Neusa Galvão', role: 'Ministra dos Transportes', feminine: true, color: '#e98a15' },
  }),
  good({
    id: 'acordoComercial', icon: '🌏', importance: 3, tag: 'Boa notícia · comércio',
    title: 'Entra em vigor: {lei}',
    text: 'Negociado por {autor} em {ano}, o acordo derruba tarifas e abre mercado para a carne e a soja.',
    presenter: { name: 'Severino Cunha', role: 'Ministro da Agricultura', feminine: false, color: '#c9a227' },
    effects: { confidence: 2 },
  }),
  // Boas notícias que não dependem de ninguém: o presidente pode surfar nelas.
  good({ id: 'safraRecorde', random: true, weight: 1, icon: '🌽', importance: 2, tag: 'Boa notícia · campo', title: 'Safra recorde de grãos', text: 'Chuva no tempo certo e preços altos lá fora. O campo vive um ano histórico.', presenter: { name: 'Severino Cunha', role: 'Ministro da Agricultura', feminine: false, color: '#c9a227' } }),
  good({ id: 'petroleo', random: true, weight: 1, icon: '🛢️', importance: 3, tag: 'Boa notícia · energia', title: 'Descoberta de petróleo na Margem Equatorial', text: 'Uma reserva gigante foi confirmada. Estados do Norte já fazem contas dos royalties.', presenter: { name: 'Rui Damasceno', role: 'Ministro de Minas e Energia', feminine: false, color: '#2bb3a3' } }),
  good({ id: 'investimentoEstrangeiro', random: true, weight: 1, icon: '🏭', importance: 2, tag: 'Boa notícia · indústria', title: 'Montadora anuncia fábrica de carros elétricos', text: 'Investimento de R$ 15 bilhões e 8 mil empregos no interior.', presenter: { name: 'Marta Quintela', role: 'Secretária do Tesouro', feminine: true, color: '#1e5bd8' } }),
]
