import type { GroupId } from '../types'

/**
 * Como cada setor da sociedade reage a uma lei nova (etapa 4B): a página que abre depois da aprovação.
 * As falas são de personagens genéricos (sem nome). {lei} vira o nome da medida.
 */
export type Mood = 'festa' | 'apoio' | 'indiferente' | 'critica' | 'revolta'

export const MOODS: Record<Mood, { label: string; icon: string; min: number }> = {
  festa: { label: 'Comemora', icon: '🎉', min: 4 },
  apoio: { label: 'Aprova', icon: '👍', min: 1.5 },
  indiferente: { label: 'Indiferente', icon: '😐', min: -1.5 },
  critica: { label: 'Critica', icon: '👎', min: -4 },
  revolta: { label: 'Revoltado', icon: '😡', min: -Infinity },
}

export const moodOf = (v: number): Mood =>
  v >= MOODS.festa.min ? 'festa' : v >= MOODS.apoio.min ? 'apoio' : v > MOODS.indiferente.min ? 'indiferente' : v > MOODS.critica.min ? 'critica' : 'revolta'

/** Quem fala por cada grupo. */
export const VOICES: Record<GroupId, string> = {
  trabalhadores: 'Metalúrgica do ABC',
  baixaRenda: 'Mãe de três filhos na periferia',
  classeMedia: 'Professor universitário de classe média',
  empresarios: 'Presidente de uma federação de indústrias',
  agro: 'Produtor de soja do Centro-Oeste',
  servidores: 'Dirigente de sindicato de servidores',
  jovens: 'Estudante de 19 anos',
}

export const QUOTES: Record<GroupId, Record<Mood, string>> = {
  trabalhadores: {
    festa: 'Finalmente uma lei que chega no bolso de quem trabalha. A fábrica inteira comemorou.',
    apoio: 'Ajuda, não resolve tudo. Mas é um passo na direção certa.',
    indiferente: 'Isso aí não muda nada no meu turno. Quero ver emprego.',
    critica: 'Mais uma vez quem paga a conta é o trabalhador.',
    revolta: 'É um ataque direto a quem acorda às cinco da manhã. Vai ter greve.',
  },
  baixaRenda: {
    festa: 'Vai dar para encher a geladeira. Pela primeira vez em muito tempo, tenho esperança.',
    apoio: 'Qualquer ajuda faz diferença aqui em casa.',
    indiferente: 'Coisa de Brasília. Aqui o que importa é o preço do arroz.',
    critica: 'Lembram da gente na eleição e esquecem depois.',
    revolta: 'Quem já não tinha quase nada vai ficar com menos ainda.',
  },
  classeMedia: {
    festa: 'Era o que o país precisava. Ponto para o governo.',
    apoio: 'Faz sentido, desde que não venha com mais imposto depois.',
    indiferente: 'Não muda muita coisa para mim. Vou esperar para ver.',
    critica: 'Quem banca tudo de novo é a classe média.',
    revolta: 'Absurdo. Imposto alto, serviço ruim e agora isso.',
  },
  empresarios: {
    festa: 'Sinal claro de segurança jurídica. Vamos destravar investimentos.',
    apoio: 'Positivo para o ambiente de negócios, apesar de ressalvas no texto.',
    indiferente: 'Impacto neutro para o setor produtivo, segundo nossos economistas.',
    critica: 'Aumenta o custo de produzir no Brasil. Vamos rever o plano de investimento.',
    revolta: 'É um tiro no pé da economia. A indústria vai demitir.',
  },
  agro: {
    festa: 'O campo agradece. Quem alimenta o país foi ouvido.',
    apoio: 'Ajuda na próxima safra. Esperamos que venha mais.',
    indiferente: 'Na fazenda a gente continua plantando, com ou sem essa lei.',
    critica: 'Brasília não entende como funciona o campo.',
    revolta: 'É uma afronta ao produtor rural. A bancada vai reagir.',
  },
  servidores: {
    festa: 'Reconhecimento depois de anos de desvalorização. A categoria está em festa.',
    apoio: 'Vemos com bons olhos, mas seguimos mobilizados.',
    indiferente: 'Não afeta a carreira. Seguimos acompanhando.',
    critica: 'Mais uma medida que trata o servidor como vilão.',
    revolta: 'É desmonte do serviço público. Assembleia geral já convocada.',
  },
  jovens: {
    festa: 'Muito bom ver o governo pensando no futuro da minha geração.',
    apoio: 'Gostei. Bombou nas redes, pelo menos.',
    indiferente: 'Nem sabia que estava em votação, para ser sincero.',
    critica: 'De novo decidiram por nós sem perguntar nada.',
    revolta: 'Estão vendendo o nosso futuro. Vamos para a rua.',
  },
}

/** Veredito geral pela nota de popularidade (0 a 10). */
export function verdictOf(score: number): { text: string; tone: 'good' | 'bad' | 'neutral' } {
  if (score >= 8) return { text: 'Aclamada nas ruas', tone: 'good' }
  if (score >= 6.5) return { text: 'Bem recebida', tone: 'good' }
  if (score >= 4.5) return { text: 'Divide opiniões', tone: 'neutral' }
  if (score >= 3) return { text: 'Mal recebida', tone: 'bad' }
  return { text: 'Rejeitada pela população', tone: 'bad' }
}

/** Reação do mercado pela mudança de confiança e pelo custo fiscal. */
export function marketText(confidence: number, cost: number): { text: string; tone: 'good' | 'bad' | 'neutral' } {
  const k = confidence - Math.max(0, cost) / 30
  if (k >= 2) return { text: 'Bolsa sobe e dólar recua: o mercado gostou.', tone: 'good' }
  if (k >= 0.5) return { text: 'Mercado recebe bem, sem euforia.', tone: 'good' }
  if (k > -0.5) return { text: 'Mercado não se mexe.', tone: 'neutral' }
  if (k > -2) return { text: 'Analistas torcem o nariz para o custo da medida.', tone: 'bad' }
  return { text: 'Dólar sobe e juros futuros disparam: o mercado não gostou.', tone: 'bad' }
}
