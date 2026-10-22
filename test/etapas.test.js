import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { apenasPagamentos, somarPorEtapa, umPorEmpenho } from '../src/dominio/etapas.js';
import { calcularTotaisGerais } from '../src/dominio/analise.js';
import { executarAuditoria } from '../src/dominio/auditoria.js';

// Um mesmo empenho de R$ 1.000 passando pelas três etapas + outro só pago
// (empenhado em mês anterior) + uma anulação parcial de um terceiro empenho.
const registro = (documento, evento, valor, extra = {}) => ({
  orgao: 'PREFEITURA MUNICIPAL',
  documento,
  evento,
  valor,
  data: '05/03/2024',
  fornecedorId: '11111111000111',
  fornecedorNome: 'EMPRESA A',
  ehPessoaJuridica: true,
  ...extra,
});

const despesas = [
  registro('000001-2024', 'Empenhado', 1000),
  registro('000001-2024', 'Liquidado', 1000),
  registro('000001-2024', 'Pago', 1000),
  registro('000002-2024', 'Pago', 500, { fornecedorId: '22222222000122', fornecedorNome: 'EMPRESA B' }),
  registro('000003-2024', 'Empenhado', 300),
  registro('000003-2024', 'Anulação', -100),
];

describe('somarPorEtapa — o mesmo dinheiro não é somado três vezes', () => {
  it('separa empenhado (líquido de anulações), liquidado e pago', () => {
    assert.deepEqual(somarPorEtapa(despesas), { empenhado: 1200, liquidado: 1000, pago: 1500, anulado: -100 });
  });
});

describe('apenasPagamentos', () => {
  it('mantém só o dinheiro que saiu do caixa', () => {
    assert.deepEqual(apenasPagamentos(despesas).map((d) => d.valor), [1000, 500]);
  });
});

describe('umPorEmpenho', () => {
  it('um registro por documento, com o maior valor entre as etapas, sem anulações', () => {
    const docs = umPorEmpenho(despesas);
    assert.equal(docs.length, 3);
    assert.deepEqual(docs.map((d) => [d.documento, d.valor]).sort(), [
      ['000001-2024', 1000],
      ['000002-2024', 500],
      ['000003-2024', 300],
    ]);
  });

  it('o mesmo número em órgãos diferentes são documentos diferentes', () => {
    const docs = umPorEmpenho([
      registro('000009-2024', 'Empenhado', 10),
      registro('000009-2024', 'Empenhado', 20, { orgao: 'CAMARA MUNICIPAL' }),
    ]);
    assert.equal(docs.length, 2);
  });

  it('registros sem número de documento entram individualmente', () => {
    const docs = umPorEmpenho([
      registro('Sem documento', 'Pago', 10),
      registro('Sem documento', 'Pago', 10),
    ]);
    assert.equal(docs.length, 2);
  });
});

describe('calcularTotaisGerais — total por etapa', () => {
  it('valorTotal é o empenhado; nada é contado em dobro', () => {
    const totais = calcularTotaisGerais(despesas);
    assert.equal(totais.valorTotal, 1200); // e não 3.700 (a soma de todas as linhas)
    assert.equal(totais.porEtapa.pago, 1500);
    assert.equal(totais.totalRegistros, 6);
    assert.equal(totais.totalEmpenhos, 3);
    assert.equal(totais.maiorPagamento.documento, '000001-2024');
  });
});

describe('executarAuditoria — ranking e CR5 pelo valor pago', () => {
  it('cada fornecedor aparece com o que de fato recebeu', () => {
    const { ranking, insights } = executarAuditoria(despesas);
    assert.deepEqual(ranking.map((f) => [f.nome, f.valorTotal]), [['EMPRESA A', 1000], ['EMPRESA B', 500]]);
    assert.equal(insights.concentracao.percentual, 100); // os 2 fornecedores = todo o valor pago
  });
});
