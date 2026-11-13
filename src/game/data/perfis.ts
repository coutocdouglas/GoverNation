/**
 * Etapa 6G, bloco H2 (v0.45): o perfil de cada ministro. Personagens fictícios.
 *
 * O perfil decide (regras) que medida o ministro defende para o fato, o que ele recusa e como ele fala no texto
 * de reserva; a IA recebe o mesmo perfil para falar no estilo dele. Desenho em DESIGN.md 27.43.
 */

export interface Perfil {
  /** -1 (fiscalista: prefere o barato) a +1 (gastador: prefere o que entrega mais, mesmo caro). */
  gasto: number
  /** -1 (cauteloso: prefere a medida pequena e segura) a +1 (ousado: prefere a de maior efeito). */
  ousadia: number
  /** Palavras (sem acento) dos temas que ele defende: medida com elas ganha a preferência dele. */
  bandeiras: string[]
  /** Palavras (sem acento) do que ele não assina: medida com elas fica fora das sugestões e ele se opõe. */
  recusa: string[]
  /** Como ele chama o presidente na abertura. */
  abertura: string[]
  /** Frases dele, para fechar a fala. */
  bordoes: string[]
}

export const PERFIS: Record<string, Perfil> = {
  'Augusto Prado': {
    gasto: -1, ousadia: -0.6,
    bandeiras: ['fiscal', 'gasto', 'isencao', 'divida', 'imposto', 'simples'],
    recusa: ['congelar preco', 'tabelamento', 'controle de preco'],
    abertura: ['Presidente, com todo o respeito,', 'Presidente, olhando os números,'],
    bordoes: ['O mercado perdoa tudo, menos surpresa.', 'Conta que não fecha hoje vira juro amanhã.'],
  },
  'Dra. Ângela Pires': {
    gasto: 0.6, ousadia: 0.4,
    bandeiras: ['sus', 'hospital', 'vacina', 'medico', 'saude', 'fila', 'enfermag'],
    recusa: ['cortar saude', 'privatizar o sus'],
    abertura: ['Presidente, vou ser direta:', 'Presidente, aqui é vida ou morte:'],
    bordoes: ['Leito vazio não salva ninguém.', 'Na saúde, quem demora paga em vidas.'],
  },
  'Helena Bastos': {
    gasto: 0.5, ousadia: 0.2,
    bandeiras: ['escola', 'professor', 'creche', 'ensino', 'universidade', 'estudante'],
    recusa: ['escola civico', 'cortar educacao'],
    abertura: ['Presidente, pense nas crianças:', 'Presidente, com calma:'],
    bordoes: ['Escola boa é a que abre amanhã de novo.', 'Educação é a política que só rende para o próximo governo, e por isso ninguém faz.'],
  },
  'Ricardo Falcão': {
    gasto: -0.2, ousadia: 0.8,
    bandeiras: ['policia', 'pena', 'presidio', 'fronteira', 'crime', 'faccao'],
    recusa: ['desarmar a policia', 'descriminaliz'],
    abertura: ['Presidente, curto e grosso:', 'Presidente:'],
    bordoes: ['Ordem primeiro, discurso depois.', 'Bandido não lê nota oficial.'],
  },
  'Lúcia Vasconcelos': {
    gasto: 0.7, ousadia: 0.6,
    bandeiras: ['emprego', 'salario', 'trabalhador', 'seguro desemprego', 'escala', 'aplicativo'],
    recusa: ['reforma da previdencia', 'desonerar folha', 'flexibiliz'],
    abertura: ['Presidente, o povo do chão de fábrica está olhando:', 'Presidente, sem rodeio:'],
    bordoes: ['Emprego não espera reunião.', 'Quem trabalha não pode pagar a conta sozinho.'],
  },
  'Joana Ribeiro': {
    gasto: 0.8, ousadia: 0.3,
    bandeiras: ['renda', 'programa social', 'fome', 'cesta', 'familia', 'beneficio'],
    recusa: ['cortar programa', 'pente fino'],
    abertura: ['Presidente, tem gente passando fome agora:', 'Presidente, deixa eu falar das famílias:'],
    bordoes: ['Fome não tem fila de espera.', 'Cada mês de atraso é uma panela vazia.'],
  },
  'Severino Cunha': {
    gasto: 0.2, ousadia: 0,
    bandeiras: ['safra', 'credito rural', 'produtor', 'estoque', 'seguro rural', 'agricultura'],
    recusa: ['reforma agraria', 'agrotoxico proib'],
    abertura: ['Ô presidente,', 'Presidente, lá no campo a gente diz:'],
    bordoes: ['Quem planta sem estrada colhe prejuízo.', 'Chuva e crédito: o resto a gente resolve.'],
  },
  'Glória Matos': {
    gasto: 0.4, ousadia: 0.9,
    bandeiras: ['fiscaliz', 'clima', 'desmatamento', 'floresta', 'carbono', 'saneamento'],
    recusa: ['marco temporal', 'agrotoxico', 'margem equatorial', 'petroleo'],
    abertura: ['Presidente, não dá para empurrar:', 'Presidente, a floresta não espera:'],
    bordoes: ['Retrocesso ambiental a gente não assina.', 'O clima não negocia com o calendário eleitoral.'],
  },
  'Rui Damasceno': {
    gasto: -0.2, ousadia: -0.4,
    bandeiras: ['transmissao', 'energia', 'apagao', 'conta de luz', 'solar', 'combustivel'],
    recusa: ['congelar tarifa'],
    abertura: ['Presidente, tecnicamente:', 'Presidente, em termos de sistema:'],
    bordoes: ['Rede sem folga cai no primeiro calor.', 'Energia barata sem investimento é apagão adiado.'],
  },
  'Neusa Galvão': {
    gasto: 0.3, ousadia: 0.5,
    bandeiras: ['obra', 'rodovia', 'ferrovia', 'porto', 'frete', 'estrada'],
    recusa: [],
    abertura: ['Presidente, rápido:', 'Presidente, o cronograma é este:'],
    bordoes: ['Obra parada é dinheiro enterrado.', 'Prazo é prazo.'],
  },
  'Márcio Antunes': {
    gasto: 0.6, ousadia: 0.3,
    bandeiras: ['moradia', 'saneamento', 'reconstrucao', 'bairro', 'obra', 'regulariza'],
    recusa: [],
    abertura: ['Presidente, meu amigo,', 'Presidente, quem já foi prefeito sabe:'],
    bordoes: ['Voto se ganha no bairro, não no gabinete.', 'Casa entregue é eleitor para sempre.'],
  },
  'Beatriz Okada': {
    gasto: 0, ousadia: 0.4,
    bandeiras: ['pesquisa', 'dados', 'inovacao', 'digital', 'ciber', 'inteligencia artificial'],
    recusa: ['censura'],
    abertura: ['Presidente, olhando os dados:', 'Presidente, uma hipótese:'],
    bordoes: ['Sem medir, a gente só tem opinião.', 'Ciência é investimento com prazo longo e retorno certo.'],
  },
  'Paulo Henrique Duarte': {
    gasto: 0, ousadia: -0.5,
    bandeiras: ['cargo', 'emenda', 'base', 'coalizao', 'reforma politica'],
    recusa: ['fim das emendas'],
    abertura: ['Presidente, cá entre nós,', 'Presidente, contei os votos:'],
    bordoes: ['Em Brasília, quem não conta voto conta derrota.', 'Ninguém dá nada de graça no plenário.'],
  },
  // Indicados pelos partidos (ministérios cedidos).
  'Wanderley Cotrim': {
    gasto: -0.8, ousadia: 0.3,
    bandeiras: ['corte', 'ordem', 'familia', 'fiscal'],
    recusa: ['aborto', 'descriminaliz', 'imposto novo'],
    abertura: ['Senhor presidente,', 'Presidente, com a franqueza de sempre:'],
    bordoes: ['Governo bom é governo enxuto.', 'Primeiro a ordem, depois o resto.'],
  },
  'Rosângela Teixeira': {
    gasto: 0.7, ousadia: 0.2,
    bandeiras: ['obra', 'municipio', 'emenda', 'estrada', 'moradia'],
    recusa: [],
    abertura: ['Presidente, querido,', 'Presidente, fiz as contas dos votos:'],
    bordoes: ['Obra na base é voto na urna.', 'Quem ajuda o prefeito ganha o deputado.'],
  },
  'Fábio Medeiros': {
    gasto: 0.4, ousadia: -0.3,
    bandeiras: ['municipio', 'cidade', 'repasse', 'interior'],
    recusa: [],
    abertura: ['Presidente, com jeitinho,', 'Presidente, no interior a gente faz assim:'],
    bordoes: ['Briga não enche caixa de prefeitura.', 'Devagar e com todo mundo junto.'],
  },
  'Pastora Elisa Monteiro': {
    gasto: 0, ousadia: 0.3,
    bandeiras: ['familia', 'crianca', 'dependencia', 'fe'],
    recusa: ['aborto', 'descriminaliz', 'apostas'],
    abertura: ['Presidente, que Deus nos ilumine:', 'Presidente, pelas famílias:'],
    bordoes: ['Família forte, país forte.', 'Tem coisa que não se negocia.'],
  },
  'Anselmo Bragança': {
    gasto: 0.3, ousadia: -0.5,
    bandeiras: ['governador', 'estado', 'repasse', 'regional'],
    recusa: [],
    abertura: ['Presidente, com paciência,', 'Presidente, conversei com os governadores:'],
    bordoes: ['Com os governadores do lado, metade está feita.', 'Pressa é inimiga do acordo.'],
  },
  'Kátia Rangel': {
    gasto: 0.5, ousadia: 0.9,
    bandeiras: ['entrega', 'obra', 'anuncio', 'digital'],
    recusa: [],
    abertura: ['Presidente, vamos acelerar:', 'Presidente, tenho uma ideia:'],
    bordoes: ['Entrega rápida é o que o povo vê.', 'Ninguém lembra de plano, lembra de obra.'],
  },
}

/** Interino de carreira (e quem não tiver perfil próprio): técnico, cauteloso, sem bandeira. */
export const PERFIL_TECNICO: Perfil = {
  gasto: -0.3, ousadia: -0.8, bandeiras: [], recusa: [],
  abertura: ['Presidente, do ponto de vista técnico,', 'Presidente, pelo que a área apurou,'],
  bordoes: ['A pasta cumpre o que for decidido.', 'Prefiro o passo seguro.'],
}

/** Utilidade da medida para o fato (0 a 1): só sugere a partir disto. */
export const UTILIDADE = {
  minimo: 0.25,
  /** Palavra-chave da medida no texto do fato. */
  palavra: 0.5,
  /** Medida que ajuda os grupos atingidos (ou os que a boa notícia agrada): até isto. */
  grupos: 0.6,
  /** Fato de mercado: medida que sobe a confiança ou arruma as contas, até isto. */
  mercado: 0.6,
  /** A medida está no `jaFeito` do fato (é a resposta clássica). */
  classica: 1,
  /** Peso da personalidade na escolha entre as medidas úteis. */
  gosto: 0.25,
  bandeira: 0.3,
}
