import axios from 'axios';

import { ErroApi } from '../erros/ErroApi.js';

/**
 * Cliente HTTP da API de Transparência do TCE-SP.
 *
 * Isola o detalhe de infraestrutura (URL, timeout, formato do município)
 * e traduz cada falha técnica do axios em um ErroApi com mensagem clara.
 */
const TIMEOUT_MS = 30_000; // O TCE-SP pode ser lento em municípios grandes

const clienteTce = axios.create({
  baseURL: 'https://transparencia.tce.sp.gov.br/api/json/despesas',
  timeout: TIMEOUT_MS,
});

// "Bragança Paulista" → "braganca-paulista" (formato exigido pelo TCE-SP)
export const formatarMunicipio = (municipio) =>
  municipio
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');

// Converte o erro técnico do axios em um ErroApi com a causa real
const traduzirErroAxios = (erro, contexto) => {
  const detalhes = { ...contexto, codigoRede: erro.code ?? null, statusTce: erro.response?.status ?? null };

  if (erro.code === 'ECONNABORTED' || erro.code === 'ETIMEDOUT') {
    return new ErroApi(504, 'TCE_TIMEOUT',
      `O TCE-SP não respondeu em ${TIMEOUT_MS / 1000} segundos. Tente novamente em instantes.`,
      { detalhes, causa: erro });
  }

  if (erro.response) {
    return new ErroApi(502, 'TCE_ERRO_HTTP',
      `O TCE-SP recusou a consulta (HTTP ${erro.response.status}). O serviço do Tribunal pode estar instável.`,
      { detalhes, causa: erro });
  }

  // Sem resposta: DNS, conexão recusada, conexão derrubada...
  return new ErroApi(502, 'TCE_INDISPONIVEL',
    `Não foi possível conectar ao TCE-SP (${erro.code ?? 'falha de rede'}). O serviço do Tribunal pode estar fora do ar.`,
    { detalhes, causa: erro });
};

export const buscarDespesasTce = async (municipio, ano, mes) => {
  const caminho = `/${formatarMunicipio(municipio)}/${ano}/${mes}`;
  const contexto = { urlTce: clienteTce.defaults.baseURL + caminho };

  let resposta;
  try {
    resposta = await clienteTce.get(caminho);
  } catch (erro) {
    throw traduzirErroAxios(erro, contexto);
  }

  // O TCE-SP responde 200 com uma lista; qualquer outra coisa é contrato quebrado
  if (!Array.isArray(resposta.data)) {
    throw new ErroApi(502, 'TCE_FORMATO_INESPERADO',
      'O TCE-SP devolveu os dados em um formato inesperado. A análise foi interrompida para não exibir números incorretos.',
      { detalhes: { ...contexto, tipoRecebido: typeof resposta.data } });
  }

  return resposta.data;
};
