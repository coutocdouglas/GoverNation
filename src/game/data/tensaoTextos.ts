import type { GroupId } from '../types'

/**
 * Etapa 6G, bloco H3, parte 3 (v0.46.2): texto próprio dos fatos de tensão dos 12 grupos maiores.
 * Só as palavras: os efeitos e a tensão das quatro saídas continuam os do molde (data/tensao.ts).
 * A frase "A pauta: …" é acrescentada pelo molde, com o que o grupo cobra (`cares`).
 * Ordem das saídas: 0 abrir mesa e atender, 1 receber as lideranças, 2 endurecer, 3 deixar passar.
 */
export interface SaidaTexto { label: string; text: string; outcome: string }
export interface TextoTensao { titulo: string; texto: string; saidas: [SaidaTexto, SaidaTexto, SaidaTexto, SaidaTexto] }

export const TEXTO_TENSAO: Partial<Record<GroupId, TextoTensao>> = {
  baixaRenda: {
    titulo: 'Periferias fecham avenidas: “A comida acabou antes do mês”',
    texto: 'Moradores de bairros populares ocupam avenidas em cinco capitais. Dizem que o benefício não cobre a feira e que o trabalho informal secou.',
    saidas: [
      { label: 'Reforçar renda e cesta nas periferias', text: 'Custa caixa agora, mas tira o pessoal da rua.', outcome: 'Governo reforça a renda nas periferias e desarma os protestos' },
      { label: 'Receber os movimentos de moradia e renda', text: 'Barato e rápido; ouve, mas não entrega.', outcome: 'Presidente recebe movimentos das periferias e os protestos esfriam' },
      { label: 'Mandar a polícia liberar as avenidas', text: 'Resolve o trânsito e piora a raiva.', outcome: 'Governo desobstrui avenidas nas periferias sob tensão' },
      { label: 'Deixar passar', text: 'Os protestos crescem e a imprensa mostra o abandono.', outcome: 'Protestos nas periferias ganham as manchetes e pesam sobre o governo' },
    ],
  },
  classeMedia: {
    titulo: 'Classe média vai às ruas: “Já pagamos demais”',
    texto: 'Panelaços e atos de profissionais urbanos tomam as avenidas centrais. Reclamam de imposto, inflação e de um serviço público que não entrega.',
    saidas: [
      { label: 'Anunciar alívio de impostos e crédito', text: 'Custa caixa, mas responde ao que reclamam.', outcome: 'Governo anuncia alívio para a classe média e os atos perdem força' },
      { label: 'Receber entidades e associações', text: 'Ouve e promete prazo; alivia pouco.', outcome: 'Presidente recebe entidades da classe média e os atos esfriam' },
      { label: 'Chamar os atos de “minoria barulhenta”', text: 'Agrada quem está de fora; irrita quem está na rua.', outcome: 'Governo minimiza os atos da classe média e mantém a posição' },
      { label: 'Deixar passar', text: 'Os panelaços viram rotina nas redes e nas janelas.', outcome: 'Atos da classe média tomam as redes e pesam sobre o governo' },
    ],
  },
  trabalhadores: {
    titulo: 'Centrais sindicais marcam greve geral',
    texto: 'Fábricas, bancos e serviços podem parar na próxima semana. As centrais dizem que o salário perdeu para a inflação e que direitos estão em risco.',
    saidas: [
      { label: 'Abrir mesa com as centrais e ceder no reajuste', text: 'Custa dinheiro e tempo, mas desarma a greve.', outcome: 'Governo fecha acordo com as centrais e a greve geral é desmarcada' },
      { label: 'Receber as centrais no Planalto', text: 'Barato e rápido; alivia, mas não resolve.', outcome: 'Presidente recebe as centrais e a greve geral esfria' },
      { label: 'Declarar a greve abusiva', text: 'Mostra firmeza; a categoria não esquece.', outcome: 'Governo declara a greve geral abusiva e mantém a posição' },
      { label: 'Deixar passar', text: 'A greve acontece e o país sente.', outcome: 'Greve geral para o país e pesa sobre o governo' },
    ],
  },
  aposentados: {
    titulo: 'Aposentados fazem vigília no Congresso: “O benefício não chega ao fim do mês”',
    texto: 'Idosos ocupam agências e a entrada do Congresso. Dizem que remédio e comida consomem todo o benefício e que a inflação come o resto.',
    saidas: [
      { label: 'Reajustar o benefício e ampliar o remédio gratuito', text: 'Custa caixa todo mês, mas é o que eles pedem.', outcome: 'Governo reajusta benefícios e a vigília dos aposentados termina' },
      { label: 'Receber as associações de aposentados', text: 'Ouve e promete; a fila continua.', outcome: 'Presidente recebe associações de aposentados e a vigília esfria' },
      { label: 'Dizer que o reajuste já foi o possível', text: 'Poupa o caixa e a imagem do governo sofre.', outcome: 'Governo diz que o reajuste dos aposentados já foi o possível' },
      { label: 'Deixar passar', text: 'As imagens de idosos nas filas rodam o país.', outcome: 'Vigília de aposentados ganha as manchetes e pesa sobre o governo' },
    ],
  },
  evangelicos: {
    titulo: 'Pastores convocam a “marcha pela família”',
    texto: 'Líderes evangélicos chamam os fiéis para atos nas capitais. Acusam o governo de desrespeitar a família e a liberdade de culto.',
    saidas: [
      { label: 'Abrir diálogo e assumir compromissos', text: 'Custa verba social e uma promessa, mas desarma a marcha.', outcome: 'Governo assume compromissos com lideranças evangélicas e a marcha é desmarcada' },
      { label: 'Receber os pastores no Planalto', text: 'Gesto barato; ouve, mas não resolve.', outcome: 'Presidente recebe pastores e a marcha esfria' },
      { label: 'Ignorar a marcha e manter a agenda', text: 'Segue o plano; o grupo se sente desprezado.', outcome: 'Governo ignora a marcha evangélica e mantém a agenda' },
      { label: 'Deixar passar', text: 'A marcha enche as ruas e as redes.', outcome: 'Marcha evangélica enche as capitais e pesa sobre o governo' },
    ],
  },
  catolicos: {
    titulo: 'Bispos e pastorais denunciam o governo em nota dura',
    texto: 'A Igreja Católica convoca vigílias e uma coleta de assinaturas. Critica o abandono dos mais pobres e a falta de paz nas cidades.',
    saidas: [
      { label: 'Fechar parceria com as pastorais', text: 'Custa verba social, mas leva a ajuda a quem precisa.', outcome: 'Governo fecha parceria com pastorais e as vigílias são desmarcadas' },
      { label: 'Receber os bispos', text: 'Gesto barato; ouve, mas não entrega.', outcome: 'Presidente recebe os bispos e a nota perde força' },
      { label: 'Rebater a nota publicamente', text: 'Defende o governo; abre uma briga que não rende.', outcome: 'Governo rebate a nota dos bispos e mantém a posição' },
      { label: 'Deixar passar', text: 'A nota é lida nas missas de domingo.', outcome: 'Nota da Igreja é lida em todo o país e pesa sobre o governo' },
    ],
  },
  empreendedores: {
    titulo: 'Pequenos empresários baixam as portas por um dia',
    texto: 'Donos de padarias, oficinas e lojas fecham os negócios em protesto. Reclamam de imposto, juro alto e uma papelada que nunca acaba.',
    saidas: [
      { label: 'Anunciar crédito e simplificar impostos', text: 'Custa caixa, mas responde ao que reclamam.', outcome: 'Governo anuncia crédito e simplificação e os lojistas reabrem as portas' },
      { label: 'Receber as associações comerciais', text: 'Ouve e promete; alivia pouco.', outcome: 'Presidente recebe associações comerciais e o protesto esfria' },
      { label: 'Dizer que a arrecadação não pode cair', text: 'Defende o caixa; os pequenos se sentem sozinhos.', outcome: 'Governo defende a arrecadação e mantém a posição diante dos lojistas' },
      { label: 'Deixar passar', text: 'Vitrines fechadas viram imagem do governo.', outcome: 'Lojas fechadas viram símbolo do protesto e pesam sobre o governo' },
    ],
  },
  servidores: {
    titulo: 'Servidores públicos cruzam os braços',
    texto: 'Categorias do funcionalismo entram em greve. Falta reposição de quadros, o salário está defasado e a reforma administrativa assusta.',
    saidas: [
      { label: 'Abrir mesa e antecipar concursos e reajuste', text: 'Custa caixa, mas encerra a greve.', outcome: 'Governo abre mesa com o funcionalismo e a greve é encerrada' },
      { label: 'Receber os sindicatos do serviço público', text: 'Barato e rápido; alivia, mas não resolve.', outcome: 'Presidente recebe os sindicatos do serviço público e a greve esfria' },
      { label: 'Cortar o ponto dos grevistas', text: 'Mostra firmeza; a categoria não esquece.', outcome: 'Governo corta o ponto dos grevistas e mantém a posição' },
      { label: 'Deixar passar', text: 'Repartições fechadas, filas e prazos perdidos.', outcome: 'Greve do funcionalismo trava repartições e pesa sobre o governo' },
    ],
  },
  agro: {
    titulo: 'Produtores bloqueiam rodovias com tratores',
    texto: 'O tratoraço fecha as estradas de grãos no Centro-Oeste. Reclamam de crédito caro, câmbio ruim e de regra ambiental que trava a safra.',
    saidas: [
      { label: 'Negociar crédito e prazo do Plano Safra', text: 'Custa caixa, mas abre as estradas.', outcome: 'Governo negocia crédito com os produtores e as estradas são liberadas' },
      { label: 'Receber as federações do campo', text: 'Barato e rápido; alivia, mas não resolve.', outcome: 'Presidente recebe as federações do campo e o bloqueio esfria' },
      { label: 'Mandar liberar as rodovias à força', text: 'Resolve o trânsito e cria inimigos no campo.', outcome: 'Governo desobstrui as rodovias dos produtores sob tensão' },
      { label: 'Deixar passar', text: 'A safra fica parada e a conta chega à mesa.', outcome: 'Bloqueio do agro trava a safra e pesa sobre o governo' },
    ],
  },
  caminhoneiros: {
    titulo: 'Caminhoneiros fecham as estradas',
    texto: 'Comboios param em pontos estratégicos e já falta combustível nos postos. Dizem que o diesel e o frete não fecham a conta.',
    saidas: [
      { label: 'Negociar diesel e frete mínimo', text: 'Custa caixa, mas abre as estradas.', outcome: 'Governo negocia diesel e frete com os caminhoneiros e as estradas são liberadas' },
      { label: 'Receber os líderes do movimento', text: 'Barato e rápido; alivia, mas não resolve.', outcome: 'Presidente recebe líderes dos caminhoneiros e o bloqueio esfria' },
      { label: 'Liberar as estradas à força', text: 'Resolve o trânsito e cria inimigos na boleia.', outcome: 'Governo desobstrui as estradas sob protestos dos caminhoneiros' },
      { label: 'Deixar passar', text: 'Prateleiras vazias e postos secos.', outcome: 'Bloqueio dos caminhoneiros esvazia prateleiras e pesa sobre o governo' },
    ],
  },
  professores: {
    titulo: 'Professores entram em greve nacional',
    texto: 'Escolas fechadas em vários estados. A categoria reivindica o piso e melhores condições; as famílias já sentem a falta de aula.',
    saidas: [
      { label: 'Abrir mesa e antecipar o reajuste do piso', text: 'Custa caixa, mas as aulas voltam.', outcome: 'Governo abre mesa com os professores e a greve é encerrada' },
      { label: 'Receber os sindicatos de professores', text: 'Barato e rápido; alivia, mas não resolve.', outcome: 'Presidente recebe sindicatos de professores e a greve esfria' },
      { label: 'Cortar o ponto dos grevistas', text: 'Mostra firmeza; a sala dos professores não esquece.', outcome: 'Governo corta o ponto dos professores e mantém a posição' },
      { label: 'Deixar passar', text: 'Meses sem aula e pais cobrando.', outcome: 'Greve dos professores deixa escolas fechadas e pesa sobre o governo' },
    ],
  },
  policiais: {
    titulo: 'Policiais fazem operação-padrão e ameaçam parar',
    texto: 'Categorias da segurança reduzem o serviço ao mínimo e falam em cruzar os braços. Cobram salário, equipamento e respaldo para agir.',
    saidas: [
      { label: 'Abrir mesa e atender equipamento e salário', text: 'Custa caixa, mas a polícia volta às ruas.', outcome: 'Governo abre mesa com as polícias e a greve é desarmada' },
      { label: 'Receber as associações de policiais', text: 'Barato e rápido; alivia, mas não resolve.', outcome: 'Presidente recebe associações de policiais e a greve esfria' },
      { label: 'Aplicar punições e manter a posição', text: 'Mostra firmeza; a tropa não esquece.', outcome: 'Governo pune a operação-padrão e mantém a posição' },
      { label: 'Deixar passar', text: 'O policiamento some e o crime aparece.', outcome: 'Operação-padrão da polícia deixa as ruas sem policiamento e pesa sobre o governo' },
    ],
  },
}
