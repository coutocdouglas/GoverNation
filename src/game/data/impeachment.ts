import type { EventDef } from './events'

/**
 * Etapa 3 (v0.21): pedido de impeachment de ministro no Senado (crime de responsabilidade, 54 votos, voto secreto).
 * Nasce quando um ministro está muito desgastado e a exposição a escândalo está alta (números em data/senado.ts).
 * {autor} = o ministro; {lei} = a pasta. Só escolhas prontas.
 */
export const IMPEACH_EVENT: EventDef = {
  id: 'impeachMinistro', area: 'politica', tag: 'Senado · impeachment', icon: '⚖️', weight: 0, importance: 4, kind: 'consequencia', random: false, choiceOnly: true,
  title: 'Oposição pede no Senado o impeachment de {autor}',
  text: 'O pedido acusa {autor} ({lei}) de crime de responsabilidade. A presidente do Senado aceitou e o plenário vota no fechamento do mês, em voto secreto: com 54 votos, o ministro é afastado.',
  presenter: { name: 'Hermínia Valença', role: 'Presidente do Senado Federal', feminine: true, color: '#2bb3a3' },
  options: [
    { icon: '🛡️', label: 'Defender no plenário', text: 'O governo vai para a briga. Ganhando, sai mais forte; perdendo, o custo é maior que deixar passar. Atender bancadas estaduais antes ajuda.', effects: {}, outcome: 'Governo decide defender o ministro no plenário do Senado', tone: 'neutral', impeach: 'defender' },
    { icon: '✂️', label: 'Demitir antes da votação', text: 'Trocar o ministro e esvaziar o pedido. Custo pequeno nos grupos, mas a Ficha anota.', effects: {}, outcome: 'Presidente demite o ministro antes da votação no Senado', tone: 'neutral', impeach: 'demitir' },
    { icon: '🙈', label: 'Deixar o Senado decidir', text: 'Não mexer. Sem o governo na briga, o ministro quase certamente cai.', effects: {}, outcome: 'Sem defesa do governo, o Senado afasta o ministro', tone: 'bad', default: true, impeach: 'deixar' },
  ],
}
