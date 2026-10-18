import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  enriquecerDespesasComCnae,
  extrairDivisaoCnae,
  listarCnpjsPorRelevancia,
} from '../src/dominio/classificadorInteligente.js';
import { calcularDistribuicaoPorCategoria } from '../src/dominio/analise.js';
import { categorizarDespesa } from '../src/dominio/regrasCategorias.js';
import { AREAS } from '../src/dominio/tabelaCnaeAreas.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const despesa = (id, valor, pj = true, nome = `EMPRESA ${id}`) =>
  ({ fornecedorId: id, valor, ehPessoaJuridica: pj, fornecedorNome: nome, orgao: 'PREFEITURA' });

const A = '11111111000111'; // material de construção (lento)
const B = '22222222000122'; // farmácia
const C = '33333333000133'; // API sem resposta
const D = '44444444000144'; // "mercadorias em geral" (MISTA)
const CPF = '12345678901';

const despesas = [
  despesa(A, 100), despesa(B, 5000), despesa(C, 900), despesa(B, -200), despesa(D, 300),
  despesa(CPF, 999999, false, 'JOAO DA SILVA'), despesa('123', 50),
];

const CNAE_POR_CNPJ = { [A]: '4744099', [B]: '4771701', [C]: null, [D]: '4693100' };

const criarServicos = ({ atrasoA = 0, ordem = [] } = {}) => ({
  buscarCnaeFiscal: async (cnpj) => {
    ordem.push(cnpj);
    await esperar(cnpj === A ? atrasoA : 5);
    return CNAE_POR_CNPJ[cnpj] ?? null;
  },
  buscarDescricaoDivisaoCnae: async (divisao) => (divisao === '47' ? 'Comércio varejista' : null),
});

describe('listarCnpjsPorRelevancia', () => {
  it('ordena por valor e ignora CPF e ids inválidos', () => {
    const { cnpjs } = listarCnpjsPorRelevancia(despesas);
    assert.deepEqual(cnpjs, [B, C, D, A]);
  });

  it('extrai a divisão preservando zero à esquerda', () => {
    assert.equal(extrairDivisaoCnae('0111301'), '01');
    assert.equal(extrairDivisaoCnae('123'), null);
  });
});

describe('enriquecerDespesasComCnae', () => {
  it('consulta em ordem de valor e classifica pela tabela', async () => {
    const ordem = [];
    const { classificacoesPorCnpj, estatisticas } =
      await enriquecerDespesasComCnae(despesas, criarServicos({ ordem }), { orcamentoMs: 500 });

    assert.deepEqual(ordem, [B, C, D, A]);
    assert.deepEqual(classificacoesPorCnpj.get(B), {
      cnae: '4771701', divisao: '47', atividade: 'Comércio varejista', area: AREAS.SAUDE,
    });
    assert.equal(classificacoesPorCnpj.get(A).area, AREAS.INFRAESTRUTURA);
    assert.equal(classificacoesPorCnpj.get(D).area, null, 'MISTA: tem CNAE, mas sem área');
    assert.ok(!classificacoesPorCnpj.has(C), 'sem CNAE: fica de fora');
    assert.equal(estatisticas.cnpjsComCnae, 3);
    assert.equal(estatisticas.cnpjsComArea, 2);
    assert.equal(estatisticas.concluiuNoPrazo, true);
  });

  it('respeita o prazo e devolve um retrato que não muda depois', async () => {
    const { classificacoesPorCnpj, estatisticas } =
      await enriquecerDespesasComCnae(despesas, criarServicos({ atrasoA: 300 }), { orcamentoMs: 80 });

    assert.equal(estatisticas.concluiuNoPrazo, false);
    assert.ok(estatisticas.tempoMs < 250, `${estatisticas.tempoMs}ms`);
    assert.ok(!classificacoesPorCnpj.has(A), 'A estourou o prazo');
    await esperar(350);
    assert.ok(!classificacoesPorCnpj.has(A), 'o retrato devolvido não é alterado em segundo plano');
  });

  it('serviço que rejeita (contrato violado) não derruba a análise', async () => {
    const servicos = {
      buscarCnaeFiscal: async () => { throw new Error('boom'); },
      buscarDescricaoDivisaoCnae: async () => 'X',
    };
    const { classificacoesPorCnpj, estatisticas } =
      await enriquecerDespesasComCnae(despesas, servicos, { orcamentoMs: 100 });
    assert.equal(classificacoesPorCnpj.size, 0);
    assert.equal(estatisticas.concluiuNoPrazo, true);
  });

  it('área independe do IBGE: sem descrição, a área continua definida', async () => {
    const servicos = { ...criarServicos(), buscarDescricaoDivisaoCnae: async () => null };
    const { classificacoesPorCnpj } = await enriquecerDespesasComCnae(despesas, servicos, { orcamentoMs: 500 });
    assert.equal(classificacoesPorCnpj.get(B).atividade, null);
    assert.equal(classificacoesPorCnpj.get(B).area, AREAS.SAUDE);
  });
});

describe('calcularDistribuicaoPorCategoria', () => {
  it('área oficial primeiro; MISTA, sem CNAE e CPF caem no Regex', async () => {
    const { classificacoesPorCnpj } =
      await enriquecerDespesasComCnae(despesas, criarServicos(), { orcamentoMs: 500 });
    const distribuicao = calcularDistribuicaoPorCategoria(despesas, classificacoesPorCnpj);
    const porNome = Object.fromEntries(distribuicao.map((c) => [c.nome, c]));

    assert.equal(porNome[AREAS.SAUDE].valor, 4800);
    assert.equal(porNome[AREAS.SAUDE].percentualOficial, 100);
    assert.equal(porNome['Pessoa Física / Autônomo'].percentualOficial, 0);
    assert.ok(distribuicao.every((c) => c.nome !== 'Outras'), 'não existe a categoria "Outras"');

    const soma = distribuicao.reduce((a, c) => a + c.valor, 0);
    const esperado = despesas.reduce((a, d) => a + d.valor, 0);
    assert.ok(Math.abs(soma - esperado) < 1e-6, 'soma preservada');
  });

  it('sem mapa: 100% estimativa (comportamento anterior)', () => {
    assert.ok(calcularDistribuicaoPorCategoria(despesas).every((c) => c.percentualOficial === 0));
  });

  it('mesma área com as duas fontes: percentualOficial proporcional (regressão)', () => {
    // Santa Casa via CNAE (Saúde) + farmácia sem CNPJ caindo em Saúde pelo Regex
    const lista = [despesa(B, 750), { ...despesa('SEM_ID', 250, false, 'DROGARIA POPULAR LTDA'), fornecedorId: 'SEM_ID' }];
    const mapa = new Map([[B, { cnae: '8610101', divisao: '86', atividade: null, area: AREAS.SAUDE }]]);
    const [saude] = calcularDistribuicaoPorCategoria(lista, mapa);
    assert.equal(saude.nome, AREAS.SAUDE);
    assert.equal(saude.valor, 1000);
    assert.equal(saude.percentualOficial, 75);
  });
});

describe('regressão: Regex não chama CNPJ de Pessoa Física', () => {
  it('Prefeitura com CNPJ ≠ Pessoa Física; CPF continua Pessoa Física', () => {
    assert.notEqual(
      categorizarDespesa('X', 'PREFEITURA MUNICIPAL DE BRAGANCA PAULISTA', '46352746000165'),
      'Pessoa Física / Autônomo',
    );
    assert.equal(categorizarDespesa('X', 'JOAO DA SILVA', '12345678901'), 'Pessoa Física / Autônomo');
  });
});
