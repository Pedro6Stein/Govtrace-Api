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
import { apenasPagamentos, umPorEmpenho } from './etapas.js';

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

/**
 * @param {Array}  despesas  despesas normalizadas
 * @param {object} [contexto] { classificacoesPorCnpj: Map<cnpj, { cnae, divisao, atividade, area }> }
 *                            — vazio = 100% Regex (comportamento anterior)
 */
export const executarAuditoria = (despesas, { classificacoesPorCnpj = new Map() } = {}) => {
  if (!despesas.length) {
    return {
      totais: {
        valorTotal: 0,
        porEtapa: { empenhado: 0, liquidado: 0, pago: 0, anulado: 0 },
        totalRegistros: 0,
        totalEmpenhos: 0,
      },
      distribuicao: [],
      ranking: [],
      insights: null,
    };
  }

  // Uma base por pergunta — nunca somar etapas do mesmo empenho (ver etapas.js)
  const pagamentos = apenasPagamentos(despesas);   // quem recebeu / para onde foi
  const documentos = umPorEmpenho(despesas);       // motores: cada empenho uma vez

  const totais = calcularTotaisGerais(despesas);
  const distribuicao = calcularDistribuicaoPorCategoria(pagamentos, classificacoesPorCnpj);

  // Ranking pelo valor PAGO; cada fornecedor carrega sua atividade oficial (CNAE)
  const ranking = gerarRankingFornecedores(pagamentos).map((fornecedor) => {
    const classificacao = classificacoesPorCnpj.get(fornecedor.id);
    return classificacao ? { ...fornecedor, atividade: classificacao } : fornecedor;
  });

  const insights = {
    concentracao:
      gerarInsightConcentracao(ranking, totais.porEtapa.pago) || INSIGHTS_PADRAO.concentracao,
    zScore: detectarOutliersZScore(documentos) || INSIGHTS_PADRAO.zScore,
    benford: analisarLeiBenford(documentos) || INSIGHTS_PADRAO.benford,
    fracionamento: detectarFracionamento(documentos) || INSIGHTS_PADRAO.fracionamento,
    monopolio: detectarMonopolioPorOrgao(documentos) || INSIGHTS_PADRAO.monopolio,
  };

  return { totais, distribuicao, ranking, insights };
};
