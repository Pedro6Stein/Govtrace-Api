import { PARAMETROS_CLASSIFICACAO } from './configuracoes.js';
import { calcularPercentual } from './numeros.js';
import { areaDoCnae } from './tabelaCnaeAreas.js';

/**
 * Classificador inteligente: CNPJ → CNAE (Receita Federal) → área pública.
 *
 * Domínio puro: não importa axios nem serviços. As consultas externas chegam
 * por injeção de dependência (`servicos`), o que permite testar com dublês
 * sem rede e trocar a fonte de dados sem tocar nesta regra.
 *
 * Estratégia:
 *  1. CNPJs únicos (Map), ordenados pelo valor recebido — poucos
 *     fornecedores concentram quase todo o dinheiro (Pareto).
 *  2. Promise.allSettled sobre a lista ordenada; o limitador do serviço
 *     executa em ordem (FIFO), então os maiores valores resolvem primeiro.
 *  3. Promise.race com um prazo: devolve o que ficou pronto. O restante
 *     segue em segundo plano aquecendo o cache para a próxima análise.
 *
 * A ÁREA vem da tabela de referência (tabelaCnaeAreas.js) e depende só do
 * CNAE. A descrição do IBGE é detalhe de auditoria: se o IBGE falhar, a
 * área continua sendo decidida.
 */

const CNPJ_VALIDO = /^\d{14}$/;

/** "4744099" → "47" | null */
export const extrairDivisaoCnae = (cnae) => (/^\d{7}$/.test(cnae ?? '') ? cnae.slice(0, 2) : null);

/** O(n) para agregar + O(u log u) para ordenar os u CNPJs únicos */
export const listarCnpjsPorRelevancia = (despesas) => {
  const valorPorCnpj = new Map();
  for (const d of despesas) {
    if (!d.ehPessoaJuridica || !CNPJ_VALIDO.test(d.fornecedorId)) continue;
    // Magnitude: anulações (negativas) também indicam relevância do fornecedor
    valorPorCnpj.set(d.fornecedorId, (valorPorCnpj.get(d.fornecedorId) ?? 0) + Math.abs(d.valor));
  }
  const cnpjs = [...valorPorCnpj.keys()].sort((a, b) => valorPorCnpj.get(b) - valorPorCnpj.get(a));
  return { cnpjs, valorPorCnpj };
};

/**
 * @param {Array}  despesas  despesas normalizadas
 * @param {object} servicos  { buscarCnaeFiscal(cnpj), buscarDescricaoDivisaoCnae(divisao) }
 *                           — ambos resolvem string | null e nunca rejeitam
 * @param {object} [opcoes]  { orcamentoMs, maxCnpjs }
 * @returns {Promise<{ classificacoesPorCnpj: Map<string, Classificacao>, estatisticas: object }>}
 *
 * Classificacao = { cnae: "4744099", divisao: "47", atividade: "Comércio varejista" | null,
 *                   area: "Infraestrutura, Obras e Urbanismo" | null (atividade mista) }
 */
export const enriquecerDespesasComCnae = async (despesas, servicos, opcoes = {}) => {
  const {
    orcamentoMs = PARAMETROS_CLASSIFICACAO.ORCAMENTO_MS,
    maxCnpjs = PARAMETROS_CLASSIFICACAO.MAX_CNPJS_POR_ANALISE,
  } = opcoes;

  const inicio = Date.now();
  const { cnpjs, valorPorCnpj } = listarCnpjsPorRelevancia(despesas);
  const selecionados = cnpjs.slice(0, maxCnpjs);
  const classificacoes = new Map();

  const classificar = async (cnpj) => {
    const cnae = await servicos.buscarCnaeFiscal(cnpj);
    const divisao = extrairDivisaoCnae(cnae);
    if (!divisao) return;
    const atividade = await servicos.buscarDescricaoDivisaoCnae(divisao);
    classificacoes.set(cnpj, { cnae, divisao, atividade, area: areaDoCnae(cnae) });
  };

  // allSettled: uma falha isolada nunca derruba as demais (nem a análise)
  const todas = Promise.allSettled(selecionados.map(classificar));

  let temporizador;
  const prazo = new Promise((resolver) => { temporizador = setTimeout(resolver, orcamentoMs); });
  const concluiuNoPrazo = await Promise.race([todas.then(() => true), prazo.then(() => false)]);
  clearTimeout(temporizador);

  // Cópia: as consultas em segundo plano continuam escrevendo em `classificacoes`
  const classificacoesPorCnpj = new Map(classificacoes);

  let valorPj = 0;
  let valorComArea = 0;
  let cnpjsComArea = 0;
  for (const [cnpj, valor] of valorPorCnpj) {
    valorPj += valor;
    if (classificacoesPorCnpj.get(cnpj)?.area) {
      valorComArea += valor;
      cnpjsComArea++;
    }
  }

  return {
    classificacoesPorCnpj,
    estatisticas: {
      cnpjsUnicos: cnpjs.length,
      cnpjsConsultados: selecionados.length,
      cnpjsComCnae: classificacoesPorCnpj.size,
      cnpjsComArea,                 // CNAE com área definida (os demais são "mistos" → Regex)
      percentualValorClassificado: calcularPercentual(valorComArea, valorPj),
      concluiuNoPrazo,
      tempoMs: Date.now() - inicio,
    },
  };
};
