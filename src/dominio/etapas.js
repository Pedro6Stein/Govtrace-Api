/**
 * Etapas da despesa pública — e por que elas não podem ser somadas.
 *
 * O TCE-SP publica uma linha por ETAPA de cada documento: o mesmo empenho
 * aparece quando é empenhado, quando é liquidado e quando é pago. Somar
 * tudo contaria o mesmo dinheiro até três vezes (em Bragança Paulista,
 * março/2024: R$ 240,9 mi "no total" contra R$ 70,3 mi empenhados).
 *
 * Por isso cada pergunta usa uma base só:
 *   - "Quanto foi empenhado, liquidado e pago?" → somarPorEtapa (cada etapa separada)
 *   - "Quem recebeu / para onde foi o dinheiro?" → apenasPagamentos
 *   - Motores estatísticos (Z-Score, Benford…)  → umPorEmpenho (cada documento uma vez)
 */

const EVENTOS_DE_EMPENHO = new Set(['Empenhado', 'Reforço', 'Anulação']);

/**
 * Soma de cada etapa no período:
 *   empenhado — empenhos + reforços − anulações (o compromisso líquido)
 *   liquidado — serviço ou produto confirmado
 *   pago      — dinheiro que saiu do caixa
 *   anulado   — total anulado (negativo), já descontado de `empenhado`
 * Pagamentos e liquidações podem se referir a empenhos de meses anteriores.
 */
export const somarPorEtapa = (despesas) => {
  const soma = { empenhado: 0, liquidado: 0, pago: 0, anulado: 0 };
  for (const d of despesas) {
    if (EVENTOS_DE_EMPENHO.has(d.evento)) soma.empenhado += d.valor;
    if (d.evento === 'Anulação') soma.anulado += d.valor;
    if (d.evento === 'Liquidado') soma.liquidado += d.valor;
    if (d.evento === 'Pago') soma.pago += d.valor;
  }
  return soma;
};

/** Só os pagamentos: o dinheiro que de fato chegou a cada fornecedor no período. */
export const apenasPagamentos = (despesas) => despesas.filter((d) => d.evento === 'Pago');

/**
 * Um registro por empenho. O valor é o maior entre as etapas positivas do
 * documento (o mesmo dinheiro passa por todas); anulações ficam de fora.
 * Registros sem número de documento não podem ser agrupados e entram
 * individualmente.
 */
export const umPorEmpenho = (despesas) => {
  const porDocumento = new Map();
  const semDocumento = [];

  for (const d of despesas) {
    if (d.valor <= 0) continue;
    if (!d.documento || d.documento === 'Sem documento') {
      semDocumento.push(d);
      continue;
    }
    // Órgão + número: prefeitura, câmara e autarquias numeram empenhos separadamente
    const chave = `${d.orgao}|${d.documento}`;
    const atual = porDocumento.get(chave);
    if (!atual || d.valor > atual.valor) porDocumento.set(chave, d);
  }

  return [...porDocumento.values(), ...semDocumento];
};
