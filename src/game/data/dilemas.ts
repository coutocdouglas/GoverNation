import type { GameState } from '../types'
import type { EventDef } from './events'
import { MINISTER_BY_AREA, type AreaId } from './ministers'

/**
 * Etapa 6, bloco 6F (v0.41): dilemas. Fatos do mês em que dois bens colidem, com 2 ou 3 saídas de custo à vista
 * e nenhuma "certa". Entram NO LUGAR de parte do sorteio comum (os quatro fatos que já eram quase dilemas saem do
 * sorteio quando os dilemas estão ligados), no máximo um a cada `intervalo` meses.
 *
 * Regras de desenho (conferidas em teste): cada saída ganha de um lado e perde do outro; nenhuma saída é melhor que
 * outra em tudo; "Deixar passar" (a indecisão) só cobra, dos dois lados; pelo menos uma saída por dilema deixa um
 * custo que volta depois (semente), mostrado antes em `depois.aviso`.
 *
 * `{aliado}` no texto vira a sigla do partido aliado (o do vice, ou o maior da base, ou o seu); `aliado` na opção é a
 * mudança na relação com ele.
 */
export const DILEMA = {
  /** Ligado desde as telas (v0.41.1). Testes podem usar `ligarDilemas`. */
  ativo: true,
  /** Meses mínimos entre dois dilemas sorteados (os que voltam por semente não contam). */
  intervalo: 3,
  /** Chance de o fato do mês ser um dilema, quando o intervalo já passou. */
  chance: 0.5,
  /** Primeiro mês do mandato em que pode haver dilema (o começo já tem posse e vice). */
  desdeMes: 3,
  /** Meses até o mesmo dilema poder voltar no sorteio. */
  repete: 24,
  /** Fatos do sorteio comum que saem quando os dilemas estão ligados (viraram dilemas). */
  substitui: ['centrao', 'escandalo', 'terra', 'queimadas'],
  /** Marca de omissão por deixar um dilema passar, por ponto de importância (fração do `crisePer`). */
  omissoFator: 0.6,
  /** Chance de o custo adiado (semente) de fato voltar. O aviso diz "pode". */
  chanceVolta: 0.75,
  /** Teto de dilemas por mandato (Teste da sobrecarga). */
  maxMandato: 12,
}

const quem = (area: AreaId) => {
  const m = MINISTER_BY_AREA[area]
  return { name: m.name, role: m.role, feminine: m.feminine, color: m.color }
}
const last = (s: GameState) => s.history[s.history.length - 1]

export const DILEMAS: EventDef[] = [
  {
    id: 'dilVacina', area: 'saude', tag: 'Dilema · saúde', icon: '💉', weight: 1, importance: 4, kind: 'crise', choiceOnly: true,
    dilema: { lados: ['Contas públicas', 'Saúde'] },
    title: 'A vacina ou a meta fiscal',
    text: 'Um vírus novo chega pelos portos. Comprar vacina agora estoura a meta do ano; esperar o orçamento de janeiro é apostar que o surto demora.',
    presenter: quem('saude'),
    pauta: { text: 'Um vírus novo chega pelos portos. A regra fiscal que está no Congresso ainda nem passou e o Tesouro já avisa: comprar vacina agora estoura o limite que ela vai criar.' },
    barrada: { text: 'Um vírus novo chega pelos portos. Com a regra fiscal barrada pelo Congresso, o mercado vigia cada gasto; comprar vacina agora estoura a meta do ano.' },
    options: [
      { icon: '💉', label: 'Comprar já, fora da meta', text: 'Protege a população; o mercado lê como gasto sem freio.', lado: 1, effects: { spending: 0.06, confidence: -3, groups: { baixaRenda: 3, classeMedia: 2, empresarios: -2 } }, outcome: 'Governo compra vacinas e estoura a meta fiscal', tone: 'neutral' },
      { icon: '📅', label: 'Cumprir a meta e comprar em janeiro', text: 'As contas fecham; o vírus não espera.', lado: 0, effects: { confidence: 3, groups: { empresarios: 2, baixaRenda: -2, classeMedia: -1 } }, depois: { evento: 'dilVacinaSurto', meses: [3, 6], rotulo: 'o adiamento da compra de vacinas', aviso: 'em uns 3 a 6 meses, o surto pode voltar mais forte' }, outcome: 'Governo adia compra de vacinas para cumprir a meta', tone: 'neutral' },
      { icon: '✂️', label: 'Cortar bolsas de estudo para pagar', text: 'A meta e a vacina ficam de pé; quem estuda paga.', lado: 'meio', effects: { confidence: 1, groups: { baixaRenda: 2, jovens: -3, servidores: -1 } }, outcome: 'Corte em bolsas de estudo paga as vacinas', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'Nem compra, nem explica. Os dois lados cobram.', default: true, effects: { confidence: -1, groups: { baixaRenda: -2, classeMedia: -2 } }, outcome: 'Governo hesita e a vacina não chega', tone: 'bad' },
    ],
  },
  {
    id: 'dilAnistia', area: 'politica', tag: 'Dilema · aliado', icon: '🤝', weight: 1, importance: 3, kind: 'crise', choiceOnly: true,
    dilema: { lados: ['O aliado', 'A opinião pública'] },
    title: 'O {aliado} quer anistiar multas de prefeitos',
    text: 'O {aliado} pede o apoio do governo a uma anistia de multas eleitorais de prefeitos aliados. Nas redes, a palavra do dia é “impunidade”.',
    presenter: quem('politica'),
    options: [
      { icon: '🤝', label: 'Apoiar a anistia', text: 'O aliado fica devendo; a rua não perdoa.', lado: 0, aliado: 10, effects: { groups: { classeMedia: -3, jovens: -3 } }, outcome: 'Governo apoia anistia de multas pedida pelo {aliado}', tone: 'bad' },
      { icon: '✋', label: 'Recusar em público', text: 'A opinião pública aplaude; o {aliado} cobra na próxima votação.', lado: 1, aliado: -8, effects: { groups: { classeMedia: 2, jovens: 2 } }, outcome: 'Presidente recusa anistia e irrita o {aliado}', tone: 'good' },
      { icon: '⚖️', label: 'Só para cidades pequenas', text: 'Meio-termo que ninguém defende com gosto.', lado: 'meio', aliado: 3, effects: { groups: { classeMedia: -1, jovens: -1 } }, depois: { evento: 'dilAnistia', meses: [6, 9], rotulo: 'a anistia parcial a prefeitos', aviso: 'em uns 6 a 9 meses, o aliado pode voltar pedindo a anistia completa' }, outcome: 'Anistia parcial para prefeitos sai do Planalto', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'Sem resposta, o {aliado} se sente traído e a imprensa diz que o governo foi conivente.', default: true, aliado: -4, effects: { groups: { classeMedia: -1, jovens: -1 } }, outcome: 'Governo se cala sobre anistia e desagrada todo mundo', tone: 'bad' },
    ],
  },
  {
    id: 'dilLicenca', area: 'ambiente', tag: 'Dilema · obra', icon: '⛏️', weight: 1, importance: 3, kind: 'crise', choiceOnly: true,
    dilema: { lados: ['Emprego', 'Meio ambiente'] },
    title: 'Mina promete 15 mil empregos dentro da floresta',
    text: 'Uma mineradora quer licença para abrir uma mina em área de floresta. Prefeitos da região fazem fila no Planalto; ambientalistas preparam a denúncia.',
    presenter: quem('ambiente'),
    options: [
      { icon: '🏗️', label: 'Dar a licença', text: 'Emprego e investimento; a barragem fica lá para sempre.', lado: 0, effects: { potential: 0.02, groups: { trabalhadores: 3, empresarios: 3, jovens: -4 } }, depois: { evento: 'dilBarragem', meses: [8, 14], rotulo: 'a licença da mina na floresta', aviso: 'em uns 8 a 14 meses, a barragem da mina pode dar problema' }, outcome: 'Governo libera mina em área de floresta', tone: 'neutral' },
      { icon: '🌳', label: 'Negar a licença', text: 'A floresta fica de pé; a região perde os empregos.', lado: 1, effects: { confidence: -1, groups: { trabalhadores: -3, empresarios: -3, jovens: 3 } }, outcome: 'Licença da mina é negada e a região protesta', tone: 'neutral' },
      { icon: '📋', label: 'Exigir um estudo de dois anos', text: 'Adia a briga; os dois lados ficam desconfiados.', lado: 'meio', effects: { groups: { trabalhadores: -1, empresarios: -1, jovens: 1 } }, outcome: 'Governo exige estudo e adia a decisão da mina', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'O processo fica parado e ninguém sabe quem decide.', default: true, effects: { groups: { trabalhadores: -2, empresarios: -2, jovens: -1 } }, outcome: 'Licença da mina fica sem resposta do governo', tone: 'bad' },
    ],
  },
  {
    id: 'dilReajuste', area: 'economia', tag: 'Dilema · contas', icon: '🧾', weight: 1, importance: 3, kind: 'crise', choiceOnly: true,
    when: (s) => last(s).indicators.primary < 0,
    dilema: { lados: ['Contas públicas', 'Servidores'] },
    title: 'O reajuste dos servidores chega com o caixa vazio',
    text: 'O reajuste prometido aos servidores vence este mês. O Tesouro avisa que o caixa está no vermelho; os sindicatos avisam que a paciência também.',
    presenter: quem('economia'),
    options: [
      { icon: '💰', label: 'Pagar tudo agora', text: 'Palavra cumprida; o rombo cresce.', lado: 1, effects: { spending: 0.05, confidence: -2, groups: { servidores: 4 } }, outcome: 'Governo paga reajuste integral dos servidores', tone: 'neutral' },
      { icon: '📆', label: 'Parcelar em dois anos', text: 'Alivia o caixa hoje; a conta e a raiva voltam depois.', lado: 'meio', effects: { confidence: 1, groups: { servidores: -2 } }, depois: { evento: 'dilGreveServidores', meses: [5, 8], rotulo: 'o parcelamento do reajuste', aviso: 'em uns 5 a 8 meses, os servidores podem parar' }, outcome: 'Reajuste dos servidores é parcelado', tone: 'neutral' },
      { icon: '🧊', label: 'Congelar o reajuste', text: 'O mercado aplaude; o funcionalismo vai à guerra.', lado: 0, effects: { confidence: 3, groups: { servidores: -5, empresarios: 2 } }, parties: { fpt: -3 }, outcome: 'Governo congela reajuste e sindicatos prometem greve', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'O prazo vence sem resposta. Servidores e mercado ficam com a pior leitura.', default: true, effects: { confidence: -1, groups: { servidores: -3 } }, outcome: 'Prazo do reajuste vence sem palavra do governo', tone: 'bad' },
    ],
  },
  {
    id: 'dilOperacao', area: 'seguranca', tag: 'Dilema · segurança', icon: '🚔', weight: 1, importance: 4, kind: 'crise', choiceOnly: true,
    dilema: { lados: ['Segurança', 'Direitos'] },
    title: 'Operação contra o tráfico deixa 14 mortos numa favela',
    text: 'A polícia diz que só reagiu; moradores falam em execução. Metade do país quer que o governo aplauda, a outra metade quer punição.',
    presenter: quem('seguranca'),
    options: [
      { icon: '🛡️', label: 'Defender a polícia', text: 'Quem tem medo do crime aplaude; quem mora lá não esquece.', lado: 0, effects: { groups: { classeMedia: 3, agro: 2, jovens: -4, baixaRenda: -2 } }, parties: { pol: 3, pvs: -3, fpt: -3 }, outcome: 'Presidente defende a polícia depois de operação com mortes', tone: 'neutral' },
      { icon: '🚫', label: 'Afastar o comandante', text: 'Sinal de que a lei vale para todos; a tropa se ressente.', lado: 1, effects: { groups: { jovens: 3, baixaRenda: 2, classeMedia: -3, agro: -2 } }, parties: { pol: -3 }, outcome: 'Comandante da operação é afastado pelo governo', tone: 'neutral' },
      { icon: '🔎', label: 'Investigação independente', text: 'Responde depois do laudo; até lá, todos esperam.', lado: 'meio', effects: { groups: { jovens: 1, classeMedia: -1 } }, depois: { evento: 'dilOperacaoLaudo', meses: [4, 6], rotulo: 'a investigação da operação policial', aviso: 'em uns 4 a 6 meses, o laudo sai e a polêmica volta' }, outcome: 'Governo manda investigar operação policial', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'O silêncio vira manchete dos dois lados.', default: true, effects: { groups: { jovens: -2, baixaRenda: -2, classeMedia: -1 } }, outcome: 'Governo se cala sobre os 14 mortos', tone: 'bad' },
    ],
  },
  {
    id: 'dilConta', area: 'energia', tag: 'Dilema · preços', icon: '🔌', weight: 1, importance: 3, kind: 'crise', choiceOnly: true,
    dilema: { lados: ['Bolso do consumidor', 'Mercado'] },
    title: 'A estatal de energia quer subir a conta de luz em 18%',
    text: 'A estatal diz que sem o reajuste não tem como investir na rede. O consumidor já paga a conta mais cara da década.',
    presenter: quem('energia'),
    options: [
      { icon: '✋', label: 'Segurar o preço', text: 'Alivia o bolso; a rede fica sem investimento.', lado: 0, effects: { expectations: -0.1, confidence: -4, groups: { classeMedia: 2, baixaRenda: 2, empresarios: -1 } }, depois: { evento: 'apagao', meses: [8, 12], rotulo: 'o preço da luz segurado', aviso: 'em uns 8 a 12 meses, a rede sem investimento pode ter um apagão' }, outcome: 'Governo segura a conta de luz e a estatal reclama', tone: 'neutral' },
      { icon: '📈', label: 'Liberar o aumento', text: 'O mercado confia; a inflação e o bolso sentem.', lado: 1, effects: { expectations: 0.2, confidence: 3, groups: { classeMedia: -3, baixaRenda: -3, empresarios: 1 } }, outcome: 'Conta de luz sobe 18%', tone: 'neutral' },
      { icon: '🧮', label: 'Aumento menor com subsídio', text: 'Divide a conta: o Tesouro paga a diferença.', lado: 'meio', effects: { spending: 0.04, confidence: -1, groups: { classeMedia: 1, baixaRenda: 1 } }, outcome: 'Tesouro banca parte do aumento da luz', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'A estatal decide sozinha e o governo leva a culpa.', default: true, effects: { confidence: -2, groups: { classeMedia: -1, baixaRenda: -1 } }, outcome: 'Estatal sobe a luz e o governo assiste', tone: 'bad' },
    ],
  },
  // Os quatro que já eram quase dilemas, reescritos (saem do sorteio comum quando os dilemas estão ligados).
  {
    id: 'dilCentrao', area: 'politica', tag: 'Dilema · Congresso', icon: '🎩', weight: 1, importance: 3, kind: 'crise', choiceOnly: true,
    when: (s) => s.playerParty !== 'ucd',
    dilema: { lados: ['Votos no Congresso', 'Imagem do governo'] },
    title: 'Centrão exige um ministério',
    text: 'O líder do UCD avisa: sem a pasta das Cidades, nenhum projeto do governo anda neste semestre.',
    presenter: { name: 'Baltazar Moura', role: 'Líder do UCD na Câmara', feminine: false, color: '#e98a15' },
    options: [
      { icon: '🔑', label: 'Entregar o ministério', text: 'Votos garantidos, imagem de “toma lá, dá cá”.', lado: 0, effects: { groups: { classeMedia: -2, jovens: -1 } }, parties: { ucd: 16, pra: 4 }, outcome: 'UCD ganha o Ministério das Cidades e entra na base', tone: 'neutral' },
      { icon: '💼', label: 'Cargos de segundo escalão', text: 'Acalma por um tempo; o UCD volta a pedir.', lado: 'meio', effects: { groups: { classeMedia: -1 } }, parties: { ucd: 6 }, depois: { evento: 'dilCentrao', meses: [4, 7], rotulo: 'os cargos dados ao UCD', aviso: 'em uns 4 a 7 meses, o UCD volta a exigir a pasta' }, outcome: 'UCD aceita cargos de segundo escalão, por ora', tone: 'neutral' },
      { icon: '✋', label: 'Recusar', text: 'Coerência tem preço no plenário.', lado: 1, effects: { groups: { classeMedia: 1, jovens: 1 } }, parties: { ucd: -10, pra: -3 }, outcome: 'Governo recusa ministério e UCD ameaça obstruir', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'Enrolar o UCD irrita o UCD e não convence ninguém.', default: true, effects: { groups: { classeMedia: -1 } }, parties: { ucd: -6 }, outcome: 'Governo enrola o UCD e a pauta trava', tone: 'bad' },
    ],
  },
  {
    id: 'dilEscandalo', area: 'politica', tag: 'Dilema · escândalo', icon: '🕵️', weight: 1, importance: 3, kind: 'crise', choiceOnly: true,
    dilema: { lados: ['O aliado', 'A integridade'] },
    title: 'Ministro indicado pelo {aliado} é flagrado em esquema',
    text: 'A Polícia Federal encontrou planilhas de propina numa pasta entregue ao {aliado}. O partido diz que é perseguição e ameaça deixar a base.',
    presenter: { name: 'Vera Toledo', role: 'Chefe da Controladoria', feminine: true, color: '#8b6fd6' },
    options: [
      { icon: '🚪', label: 'Demitir o ministro hoje', text: 'Mostra firmeza; o {aliado} se ressente.', lado: 1, aliado: -10, effects: { groups: { classeMedia: 3, jovens: 2, empresarios: 1 } }, outcome: 'Presidente demite ministro acusado de corrupção', tone: 'good' },
      { icon: '🛡️', label: 'Blindar o ministro', text: 'Segura a base e queima a imagem.', lado: 0, aliado: 6, effects: { groups: { classeMedia: -5, jovens: -3, trabalhadores: -1 } }, outcome: 'Governo blinda ministro investigado', tone: 'bad' },
      { icon: '⚖️', label: 'Deixar a PF investigar', text: 'Sem demitir nem defender; a investigação anda sozinha.', lado: 'meio', aliado: -1, effects: { groups: { jovens: 1, classeMedia: -1 } }, depois: { evento: 'dilEscandaloVolta', meses: [5, 9], rotulo: 'o ministro investigado', aviso: 'em uns 5 a 9 meses, a investigação pode chegar a novos nomes' }, outcome: 'Investigação sobre ministro segue sem desfecho', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'Nem uma palavra: o {aliado} acha que foi abandonado e a imprensa acha que foi acobertado.', default: true, aliado: -3, effects: { groups: { classeMedia: -3, jovens: -1 } }, outcome: 'Governo se cala sobre ministro flagrado', tone: 'bad' },
    ],
  },
  {
    id: 'dilTerra', area: 'agro', tag: 'Dilema · campo', icon: '🌾', weight: 1, importance: 3, kind: 'crise', choiceOnly: true,
    dilema: { lados: ['O agro', 'Os sem-terra'] },
    title: 'Conflito por terra deixa feridos no Pará',
    text: 'Sem-terra ocuparam uma fazenda; seguranças reagiram. Os dois lados pedem a intervenção do governo.',
    presenter: { name: 'Firmino Lages', role: 'Ministro do Desenvolvimento Agrário', feminine: false, color: '#d62d2d' },
    options: [
      { icon: '🏡', label: 'Desapropriar e assentar', text: 'Resolve o conflito, irrita o agro.', lado: 1, effects: { temp: { amount: 0.02, months: 6 }, groups: { baixaRenda: 2, agro: -6 } }, parties: { fpt: 3, pvs: 3, pol: -5, mrb: -2 }, outcome: 'Governo desapropria fazenda e assenta famílias', tone: 'neutral' },
      { icon: '👮', label: 'Reintegração de posse', text: 'Ordem na fazenda, revolta na esquerda.', lado: 0, effects: { groups: { agro: 5, baixaRenda: -2, jovens: -2 } }, parties: { pol: 3, fpt: -4, pvs: -5 }, outcome: 'Polícia cumpre reintegração de posse no Pará', tone: 'neutral' },
      { icon: '🗂️', label: 'Mandar uma comissão', text: 'Esfria hoje; a ocupação pode voltar.', lado: 'meio', effects: { groups: { agro: -1, baixaRenda: 1 } }, depois: { evento: 'dilTerra', meses: [4, 7], rotulo: 'a comissão mandada ao Pará', aviso: 'em uns 4 a 7 meses, o conflito pode voltar' }, outcome: 'Comissão do governo chega ao Pará', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'O conflito continua e cada lado culpa o governo.', default: true, effects: { groups: { agro: -3, baixaRenda: -2 } }, outcome: 'Tensão no campo continua no Pará', tone: 'bad' },
    ],
  },
  {
    id: 'dilQueimadas', area: 'ambiente', tag: 'Dilema · imagem', icon: '🔥', weight: 1, importance: 3, kind: 'crise', choiceOnly: true,
    dilema: { lados: ['O agro', 'A floresta e o comércio exterior'] },
    title: 'Queimadas na Amazônia batem recorde',
    text: 'Fotos de satélite rodam o mundo. Europeus ameaçam travar o acordo comercial; produtores culpam a seca.',
    presenter: quem('ambiente'),
    options: [
      { icon: '🚒', label: 'Operação federal e multas', text: 'Brigadistas, Exército e multas pesadas.', lado: 1, effects: { temp: { amount: 0.04, months: 3 }, confidence: 1, groups: { jovens: 4, agro: -3 } }, parties: { pvs: 4, pol: -3 }, outcome: 'Operação federal reduz focos de incêndio', tone: 'good' },
      { icon: '🤠', label: 'Pacto com os produtores', text: 'Sem multas, com compromisso voluntário.', lado: 0, effects: { confidence: -1, groups: { agro: 3, jovens: -3 } }, parties: { pol: 2, pvs: -4 }, depois: { evento: 'dilQueimadas', meses: [10, 14], rotulo: 'o pacto voluntário com os produtores', aviso: 'em uns 10 a 14 meses, sem multa, as queimadas podem voltar' }, outcome: 'Pacto voluntário com produtores divide opiniões', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'Culpar a seca: lá fora ninguém acredita.', default: true, effects: { confidence: -3, groups: { jovens: -4, agro: -1 } }, parties: { pvs: -3 }, outcome: 'Europa suspende negociação comercial por queimadas', tone: 'bad' },
    ],
  },
]

/**
 * O que volta depois de uma saída de dilema (sementes). São fatos comuns de crise: o jogador responde com uma medida
 * ou deixa passar. `{lei}` vira a decisão de origem.
 */
export const DILEMA_VOLTAS: EventDef[] = [
  {
    id: 'dilVacinaSurto', area: 'saude', tag: 'Saúde · consequência', icon: '🦠', weight: 0, importance: 4, kind: 'consequencia', random: false,
    title: 'O surto voltou mais forte',
    text: 'Depois de {lei} ({ano}), o vírus se espalhou por três estados. Os hospitais pedem a vacina que ficou para depois.',
    presenter: quem('saude'),
    options: [
      { icon: '🚑', label: 'Campanha de emergência', text: 'Cara e atrasada, mas necessária.', effects: { temp: { amount: 0.08, months: 4 }, groups: { baixaRenda: 2, classeMedia: 1 } }, outcome: 'Campanha de emergência tenta conter o surto', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'O surto segue e a decisão de antes vira manchete.', default: true, effects: { groups: { baixaRenda: -4, classeMedia: -3, jovens: -1 } }, outcome: 'Surto avança e o governo é cobrado pela vacina adiada', tone: 'bad' },
    ],
  },
  {
    id: 'dilBarragem', area: 'cidades', tag: 'Tragédia · consequência', icon: '🌊', weight: 0, importance: 5, kind: 'consequencia', random: false,
    title: 'Barragem da mina rompe e soterra um povoado',
    text: 'A mina aberta com {lei} ({ano}) teve a barragem rompida. A lama desceu o rio por 80 quilômetros.',
    presenter: quem('cidades'),
    options: [
      { icon: '🚁', label: 'Ir ao local e punir a empresa', text: 'Presença e multa recorde.', effects: { temp: { amount: 0.06, months: 4 }, confidence: -1, groups: { trabalhadores: 1, baixaRenda: 2, jovens: 2, empresarios: -2 } }, outcome: 'Presidente vai ao local e multa a mineradora', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'A licença foi sua; o país lembra.', default: true, effects: { groups: { baixaRenda: -4, jovens: -5, classeMedia: -3, trabalhadores: -2 } }, outcome: 'Governo é cobrado pela licença da mina que rompeu', tone: 'bad' },
    ],
  },
  {
    id: 'dilGreveServidores', area: 'economia', tag: 'Servidores · consequência', icon: '✊', weight: 0, importance: 3, kind: 'consequencia', random: false,
    title: 'Servidores param: o parcelamento não convenceu',
    text: 'Depois de {lei} ({ano}), as federais, o INSS e as agências entram em greve juntas.',
    presenter: quem('trabalho'),
    options: [
      { icon: '💰', label: 'Antecipar as parcelas', text: 'Encerra a greve e pesa no caixa.', effects: { spending: 0.04, confidence: -1, groups: { servidores: 4 } }, outcome: 'Governo antecipa reajuste e encerra greve', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'Filas no INSS e aulas paradas.', default: true, effects: { groups: { servidores: -4, baixaRenda: -2, jovens: -1 } }, outcome: 'Greve dos servidores chega à segunda semana', tone: 'bad' },
    ],
  },
  {
    id: 'dilOperacaoLaudo', area: 'seguranca', tag: 'Segurança · consequência', icon: '📑', weight: 0, importance: 2, kind: 'consequencia', random: false,
    title: 'Sai o laudo da operação policial',
    text: 'O laudo pedido em {ano} aponta tiros a curta distância. A polêmica de {lei} volta às manchetes.',
    presenter: quem('seguranca'),
    options: [
      { icon: '⚖️', label: 'Mandar o caso à Justiça', text: 'Cumpre o que prometeu; a tropa reclama.', effects: { groups: { jovens: 2, baixaRenda: 1, classeMedia: -1 } }, outcome: 'Governo manda o laudo da operação à Justiça', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'O laudo fica na gaveta.', default: true, effects: { groups: { jovens: -2, baixaRenda: -1 } }, outcome: 'Laudo da operação policial fica sem resposta', tone: 'bad' },
    ],
  },
  {
    id: 'dilEscandaloVolta', area: 'politica', tag: 'Escândalo · consequência', icon: '🗃️', weight: 0, importance: 3, kind: 'consequencia', random: false,
    title: 'Investigação chega a novos nomes',
    text: 'A investigação sobre {lei}, aberta em {ano}, cita assessores do Planalto. A oposição fala em CPI.',
    presenter: { name: 'Vera Toledo', role: 'Chefe da Controladoria', feminine: true, color: '#8b6fd6' },
    options: [
      { icon: '🧹', label: 'Afastar os citados', text: 'Corta na própria carne.', effects: { groups: { classeMedia: 2, jovens: 1 } }, outcome: 'Presidente afasta assessores citados', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'A suspeita sobe a rampa.', default: true, effects: { groups: { classeMedia: -3, jovens: -2 } }, outcome: 'Investigação se aproxima do Planalto', tone: 'bad' },
    ],
  },
]
