import axios from 'axios';

/**
 * Cliente HTTP da API de Transparência do TCE-SP.
 *
 * Isola o detalhe de infraestrutura (URL, timeout, formato do município)
 * para que rotas e domínio não dependam de como o dado é obtido.
 */
const clienteTce = axios.create({
  baseURL: 'https://transparencia.tce.sp.gov.br/api/json/despesas',
  timeout: 30_000, // O TCE-SP pode ser lento em municípios grandes
});

// "Bragança Paulista" → "braganca-paulista" (formato exigido pelo TCE-SP)
export const formatarMunicipio = (municipio) =>
  municipio
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');

export const buscarDespesasTce = async (municipio, ano, mes) => {
  const { data } = await clienteTce.get(`/${formatarMunicipio(municipio)}/${ano}/${mes}`);
  return data;
};