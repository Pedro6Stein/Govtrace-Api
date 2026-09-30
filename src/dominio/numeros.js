/**
 * Utilitários numéricos do domínio — conversão monetária e percentuais.
 *
 * Centraliza as duas operações em que "type coercion" costuma gerar bugs
 * silenciosos: transformar texto em dinheiro e dinheiro em porcentagem.
 */

// "1.234.567" — pontos exclusivamente como separador de milhar
const APENAS_MILHAR = /^-?\d{1,3}(\.\d{3})+$/;

/**
 * Converte um valor monetário brasileiro em Number.
 *
 *   "4000,00"       → 4000
 *   "1.234.567,89"  → 1234567.89
 *   "R$ -8,80"      → -8.8
 *   "1.500"         → 1500   (ponto como milhar)
 *   1234.5          → 1234.5 (já numérico)
 *
 * Retorna NaN quando o valor não é interpretável — nunca um 0 silencioso.
 * Usa Number() em vez de parseFloat(): parseFloat("12abc") devolve 12 e
 * esconderia dados corrompidos.
 */
export const converterMoedaBR = (valor) => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  if (typeof valor !== 'string') return NaN;

  let texto = valor.replace(/R\$/gi, '').replace(/[\s ]/g, '');
  if (!texto) return NaN;

  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.'); // "1.234,56" → "1234.56"
  } else if (APENAS_MILHAR.test(texto)) {
    texto = texto.replace(/\./g, '');                    // "1.500"    → "1500"
  }

  return Number(texto);
};

/**
 * Calcula (parte / total) × 100 como Number, sem arredondar para zero
 * participações pequenas porém reais.
 *
 *   ≥ 1%  → 2 casas decimais           (47.53)
 *   < 1%  → 2 algarismos significativos (0.0021 — e não "0.0")
 *
 * Total zero, negativo ou inválido → 0 (não há base para a proporção).
 */
export const calcularPercentual = (parte, total) => {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return 0;

  const percentual = (parte / total) * 100;
  if (percentual === 0) return 0;

  return Math.abs(percentual) >= 1
    ? Math.round(percentual * 100) / 100
    : Number(percentual.toPrecision(2));
};
