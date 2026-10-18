import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { detectarOutliersZScore, analisarLeiBenford } from '../src/dominio/analiseAvancada.js';

const d = (valor, nome = 'EMPRESA LTDA', id = '11111111000111') =>
  ({ valor, fornecedorNome: nome, fornecedorId: id, orgao: 'X' });

describe('detectarOutliersZScore — campo estatisticas (Prova dos 9)', () => {
  it('amostra insuficiente (<10): sem estatisticas, igual ao comportamento anterior', () => {
    const r = detectarOutliersZScore([d(10), d(20), d(30)]);
    assert.deepEqual(r, { alerta: false });
  });

  it('expõe média, desvio padrão e limite consistentes com o cálculo interno', () => {
    // 9 valores normais (~100) + 1 disparado: média e desvio ficam fáceis de conferir na mão
    const normais = Array.from({ length: 19 }, (_, i) => d(100 + i, `F${i}`, String(10000000000000 + i)));
    const gigante = d(1_000_000, 'GIGANTE LTDA', '99999999000199');
    const r = detectarOutliersZScore([...normais, gigante]);

    assert.equal(r.alerta, true);
    assert.equal(r.outliers[0].fornecedorNome, 'GIGANTE LTDA');
    assert.equal(r.estatisticas.totalAnalisado, 20);
    assert.equal(r.estatisticas.limite, 4);
    assert.equal(r.estatisticas.exemploValor, 1_000_000);

    // A prova: reconstruir Z com os números devolvidos tem que reproduzir o alerta
    const { media, desvioPadrao } = r.estatisticas;
    const zReconstruido = (r.estatisticas.exemploValor - media) / desvioPadrao;
    assert.ok(zReconstruido > r.estatisticas.limite, `Z=${zReconstruido} deveria passar do limite`);
  });

  it('sem outliers: ainda expõe estatisticas (a prova funciona para demonstrar "dentro do normal")', () => {
    const valores = Array.from({ length: 15 }, (_, i) => d(1000 + i * 10, `F${i}`, String(20000000000000 + i)));
    const r = detectarOutliersZScore(valores);
    assert.equal(r.alerta, false);
    assert.equal(r.outliers.length, 0);
    assert.ok(r.estatisticas, 'estatisticas deve existir mesmo sem alerta');
    assert.equal(r.estatisticas.exemploValor, Math.max(...valores.map((v) => v.valor)));
  });
});

describe('analisarLeiBenford — campo frequencias (Prova dos 9)', () => {
  it('amostra insuficiente (<100): sem frequencias, igual ao comportamento anterior', () => {
    const r = analisarLeiBenford(Array.from({ length: 50 }, () => d(100)));
    assert.deepEqual(r, { alerta: false });
  });

  it('expõe 9 dígitos, contagem soma totalAnalisado e percentualEsperado bate com a fórmula', () => {
    // 200 valores todos começados em "1" (1000..1199) — maximiza o desvio pro dígito 1
    const r = analisarLeiBenford(Array.from({ length: 200 }, (_, i) => d(1000 + i, `F${i}`, String(30000000000000 + i))));

    assert.equal(r.frequencias.length, 9);
    assert.equal(r.totalAnalisado, 200);
    assert.equal(r.limiarDesvio, 5);

    const somaContagem = r.frequencias.reduce((acc, f) => acc + f.contagem, 0);
    assert.equal(somaContagem, r.totalAnalisado);

    const digito1 = r.frequencias.find((f) => f.digito === 1);
    assert.equal(digito1.contagem, 200);
    assert.equal(digito1.percentualObservado, 100);
    assert.equal(digito1.percentualEsperado, 30.1); // LEI_BENFORD_IDEAL[1] — fonte única da verdade

    // percentualEsperado reproduz a fórmula de Newcomb-Benford P(d) = log10(1 + 1/d)
    for (const f of r.frequencias) {
      const formula = Math.log10(1 + 1 / f.digito) * 100;
      assert.ok(Math.abs(f.percentualEsperado - formula) < 0.05, `dígito ${f.digito}: ${f.percentualEsperado} vs fórmula ${formula}`);
    }

    assert.equal(r.alerta, true);
    assert.equal(r.digitoSuspeito, 1);
  });
});
