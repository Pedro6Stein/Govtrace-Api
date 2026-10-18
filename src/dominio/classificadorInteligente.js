import { PARAMETROS_CLASSIFICACAO } from './configuracoes.js';
import { calcularPercentual } from './numeros.js';

/**
 * Classificador inteligente: CNPJ → CNAE (Receita Federal) → divisão IBGE.
 *
 * Domínio puro: não importa axios nem serviços. As consultas externas chegam
 * por injeção de dependência (`servicos`), o que permite testar com dublês
 * sem rede e trocar a fonte de dados sem tocar nesta regra.
 *
 * Estratégia:
 *  1. CNPJs únicos (Set/Map), ordenados pelo valor recebido — poucos
 *     fornecedores concentram quase todo o dinheiro (Pareto).
 *  2. Promise.allSettled sobre a lista ordenada; o limitador do serviço
 *     executa em ordem (FIFO), então os maiores valores resolvem primeiro.
 *  3. Promise.race com um prazo: devolve o que ficou pronto. O restante
 *     segue em segundo plano aquecendo o cache para a próxima análise.
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
 * @returns {Promise<{ categoriasPorCnpj: Map<string,string>, estatisticas: object }>}
 */
export const enriquecerDespesasComCnae = async (despesas, servicos, opcoes = {}) => {
  const {
    orcamentoMs = PARAMETROS_CLASSIFICACAO.ORCAMENTO_MS,
    maxCnpjs = PARAMETROS_CLASSIFICACAO.MAX_CNPJS_POR_ANALISE,
  } = opcoes;

  const inicio = Date.now();
  const { cnpjs, valorPorCnpj } = listarCnpjsPorRelevancia(despesas);
  const selecionados = cnpjs.slice(0, maxCnpjs);
  const categorias = new Map();

  const classificar = async (cnpj) => {
    const divisao = extrairDivisaoCnae(await servicos.buscarCnaeFiscal(cnpj));
    if (!divisao) return;
    const categoria = await servicos.buscarDescricaoDivisaoCnae(divisao);
    if (categoria) categorias.set(cnpj, categoria);
  };

  // allSettled: uma falha isolada nunca derruba as demais (nem a análise)
  const todas = Promise.allSettled(selecionados.map(classificar));

  let temporizador;
  const prazo = new Promise((resolver) => { temporizador = setTimeout(resolver, orcamentoMs); });
  const concluiuNoPrazo = await Promise.race([todas.then(() => true), prazo.then(() => false)]);
  clearTimeout(temporizador);

  // Cópia: as consultas em segundo plano continuam escrevendo em `categorias`
  const categoriasPorCnpj = new Map(categorias);

  let valorPj = 0;
  let valorClassificado = 0;
  for (const [cnpj, valor] of valorPorCnpj) {
    valorPj += valor;
    if (categoriasPorCnpj.has(cnpj)) valorClassificado += valor;
  }

  return {
    categoriasPorCnpj,
    estatisticas: {
      cnpjsUnicos: cnpjs.length,
      cnpjsConsultados: selecionados.length,
      cnpjsClassificados: categoriasPorCnpj.size,
      percentualValorClassificado: calcularPercentual(valorClassificado, valorPj),
      concluiuNoPrazo,
      tempoMs: Date.now() - inicio,
    },
  };
};
