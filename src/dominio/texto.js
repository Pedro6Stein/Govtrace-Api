/**
 * Utilitários de texto do domínio — normalização de strings vindas do TCE.
 */

// As únicas entidades que de fato aparecem nos dados do TCE: os caracteres
// reservados do HTML (&, <, >, ", ') e o espaço não separável. Acentuação
// já vem em UTF-8 normal, nunca como entidade — não há por que cobrir a
// tabela inteira do HTML5.
const ENTIDADES_HTML = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const PADRAO_ENTIDADE = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;

/**
 * Decodifica entidades HTML remanescentes em texto que deveria ser plano.
 *
 *   "W &amp; C ALIMENTOS EIRELI" → "W & C ALIMENTOS EIRELI"
 *   "A &quot;Prefeitura&quot;"   → 'A "Prefeitura"'
 *
 * O TCE devolve alguns campos (nome de fornecedor, órgão) já escapados em
 * HTML, nunca decodificados antes de chegar na nossa API — sem isso, o "&"
 * de uma razão social aparece literalmente como "&amp;" na tela do usuário.
 */
export const decodificarEntidadesHtml = (texto) => {
  if (typeof texto !== 'string' || !texto.includes('&')) return texto;

  return texto.replace(PADRAO_ENTIDADE, (entidade, codigo) => {
    if (codigo[0] === '#') {
      const codigoPonto = codigo[1] === 'x' || codigo[1] === 'X'
        ? parseInt(codigo.slice(2), 16)
        : parseInt(codigo.slice(1), 10);
      return Number.isNaN(codigoPonto) ? entidade : String.fromCodePoint(codigoPonto);
    }

    const chave = codigo.toLowerCase();
    return chave in ENTIDADES_HTML ? ENTIDADES_HTML[chave] : entidade;
  });
};
