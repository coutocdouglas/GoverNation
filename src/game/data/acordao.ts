import type { Doctrine } from './supremo'

/**
 * Etapa 4 (v0.22): a frase de cada ministro no acórdão, pela doutrina e pelo voto. Textos nossos.
 * {f} = o fundamento em minúsculas ("reserva de lei"); {m} = a medida em minúsculas.
 * Com a IA ligada, a tela pode pedir o acórdão reescrito no estilo de cada ministro (src/game/ai.ts).
 */
export const FRASES: Record<Doctrine, { derrubar: string[]; manter: string[] }> = {
  garantista: {
    derrubar: [
      'Direito fundamental não se negocia por conveniência de governo. Voto pela inconstitucionalidade.',
      'Quando o Estado aperta, quem sente primeiro é quem tem menos voz. Aqui, {f} pesa mais que a pressa.',
      'A Constituição existe justamente para dias como este. Não há como manter {m}.',
    ],
    manter: [
      'Não vejo direito atingido de forma que justifique a intervenção da Corte. Acompanho pela validade.',
      'A medida protege mais do que restringe. Divirjo de quem quer derrubá-la.',
      'Deferência ao legislador, desde que as garantias fiquem de pé, e aqui ficam.',
    ],
  },
  conservador: {
    derrubar: [
      'O Estado não pode tudo. Ordem e livre iniciativa não se suspendem por decreto de ocasião.',
      'Previsibilidade é um bem jurídico. {m} a destrói, e por isso voto por derrubar.',
      'Já vimos este filme: intervenção que promete muito e entrega insegurança. Pela procedência.',
    ],
    manter: [
      'Não cabe à Corte governar no lugar de quem foi eleito. Voto por manter.',
      'A medida respeita a ordem e os contratos. Não encontro vício que a derrube.',
      'Discordar do mérito não autoriza o juiz a apagar a escolha política. Pela improcedência.',
    ],
  },
  fiscalista: {
    derrubar: [
      'A pergunta é sempre a mesma: quem paga a conta? O texto não responde. Pela inconstitucionalidade.',
      'Responsabilidade fiscal não é detalhe técnico, é cláusula de sobrevivência do Estado. Derrubo.',
      'Sem fonte, sem estimativa, sem compensação. Não há como validar {m}.',
    ],
    manter: [
      'As contas fecham e o impacto foi estimado. Não há motivo para a Corte intervir.',
      'O governo mostrou de onde vem o dinheiro. Isso basta para manter a medida.',
      'Custo existe, mas está dentro da lei. Acompanho pela validade.',
    ],
  },
  formalista: {
    derrubar: [
      'Antes do mérito, a forma: o instrumento escolhido não comporta esta matéria. Vício insanável.',
      'Pode até ser boa política, mas foi feita pela porta errada: {f} não admite atalho.',
      'Não discuto se a medida é justa; discuto se é válida. Não é. Pela procedência.',
    ],
    manter: [
      'O rito foi seguido e o instrumento é o adequado. Forma correta, medida válida.',
      'Não há vício de forma a apontar. O resto é debate político, não jurídico.',
      'Competência respeitada, procedimento cumprido. Voto por manter.',
    ],
  },
  federalista: {
    derrubar: [
      'A União não pode decidir sozinha o que cabe a estados e municípios pagar e executar. Derrubo.',
      'Federação não é enfeite constitucional. {m} atropela quem está na ponta.',
      'Quem executa a política precisa ter sido ouvido. Não foi. Pela inconstitucionalidade.',
    ],
    manter: [
      'A medida respeita a divisão de competências entre União, estados e municípios. Mantenho.',
      'Não vejo invasão da autonomia local que justifique a intervenção. Voto pela validade.',
      'O pacto federativo foi preservado. Acompanho para manter a medida.',
    ],
  },
}

/** Abertura do voto do relator, antes da frase. */
export const RELATOR_ABRE = { derrubar: 'Relator: voto pela procedência da ação.', manter: 'Relator: voto pela improcedência da ação.' }
