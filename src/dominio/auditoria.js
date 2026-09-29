import {
  calcularTotaisGerais,
  calcularDistribuicaoPorCategoria,
  gerarRankingFornecedores,
  gerarInsightConcentracao,
} from './analise.js';
import {
  detectarOutliersZScore,
  analisarLeiBenford,
  detectarFracionamento,
  detectarMonopolioPorOrgao,
} from './analiseAvancada.js';

/**
 * Orquestrador dos motores de auditoria.
 *
 * Recebe despesas já normalizadas e devolve todos os resultados num único
 * objeto. É uma função pura: não faz I/O, então pode ser testada isoladamente.
 */

// Defaults quando um motor não tem dados suficientes para responder
const INSIGHTS_PADRAO = {
  concentracao: {
    alerta: false,
    mensagemPrincipal: 'Aguardando dados estruturados',
    insightEducativo: 'Quantidade insuficiente de notas para calcular concentração de mercado.',
  },
  zScore: {
    alerta: false,
    titulo: 'Gastos Fora do Padrão',
    insightEducativo: 'Base de dados reduzida. Impossível calcular curva normal.',
  },
  benford: {
    alerta: false,
    titulo: 'Teste de Lei de Benford',
    insightEducativo: 'Poucos registros para análise de dígito natural.',
  },
  fracionamento: {
    alerta: false,
    titulo: 'Chuva de Valores',
    insightEducativo: 'Sem anomalias repetitivas detectadas.',
  },
  monopolio: {
    alerta: false,
    titulo: 'Monopólio Departamental',
    insightEducativo: 'Não detectado.',
  },
};

export const executarAuditoria = (despesas) => {
  if (!despesas.length) {
    return {
      totais: { valorTotal: 0, totalRegistros: 0 },
      distribuicao: [],
      ranking: [],
      insights: null,
    };
  }

  const totais = calcularTotaisGerais(despesas);
  const distribuicao = calcularDistribuicaoPorCategoria(despesas);
  const ranking = gerarRankingFornecedores(despesas);

  const insights = {
    concentracao:
      gerarInsightConcentracao(ranking, totais.valorTotal) || INSIGHTS_PADRAO.concentracao,
    zScore: detectarOutliersZScore(despesas) || INSIGHTS_PADRAO.zScore,
    benford: analisarLeiBenford(despesas) || INSIGHTS_PADRAO.benford,
    fracionamento: detectarFracionamento(despesas) || INSIGHTS_PADRAO.fracionamento,
    monopolio: detectarMonopolioPorOrgao(despesas) || INSIGHTS_PADRAO.monopolio,
  };

  return { totais, distribuicao, ranking, insights };
};
