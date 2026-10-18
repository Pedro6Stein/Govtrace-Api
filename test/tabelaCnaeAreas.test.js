import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AREAS,
  AREA_POR_CLASSE,
  AREA_POR_DIVISAO,
  AREA_POR_SUBCLASSE,
  areaDoCnae,
} from '../src/dominio/tabelaCnaeAreas.js';

const AREAS_VALIDAS = new Set([...Object.values(AREAS), null]);

describe('areaDoCnae — busca do mais específico para o mais geral', () => {
  it('subclasse vence a classe: livros × papelaria na mesma classe 4647', () => {
    assert.equal(areaDoCnae('4647802'), AREAS.EDUCACAO);
    assert.equal(areaDoCnae('4647801'), AREAS.ADMINISTRACAO);
  });

  it('classe vence a divisão: material de construção no comércio (47)', () => {
    assert.equal(areaDoCnae('4744099'), AREAS.INFRAESTRUTURA);
    assert.equal(areaDoCnae('4644301'), AREAS.SAUDE);
  });

  it('MISTA explícita interrompe a busca (não herda da divisão)', () => {
    assert.equal(areaDoCnae('4693100'), null); // "mercadorias em geral"
    assert.equal(areaDoCnae('4647899'), null); // classe 4647 sem subclasse mapeada
  });

  it('cai na divisão quando não há exceção', () => {
    assert.equal(areaDoCnae('8610101'), AREAS.SAUDE);
    assert.equal(areaDoCnae('8411600'), AREAS.MAQUINA_PUBLICA);
    assert.equal(areaDoCnae('9430800'), AREAS.ASSISTENCIA);
  });

  it('CNAE com zero à esquerda (agricultura 0111301)', () => {
    assert.equal(areaDoCnae('0111301'), AREAS.ALIMENTACAO);
  });

  it('entrada inválida → null', () => {
    for (const invalido of [null, undefined, '', '123', '47440990', 'abcdefg']) {
      assert.equal(areaDoCnae(invalido), null, String(invalido));
    }
  });
});

describe('integridade da tabela', () => {
  it('todo valor é uma área conhecida ou MISTA (null)', () => {
    for (const tabela of [AREA_POR_DIVISAO, AREA_POR_CLASSE, AREA_POR_SUBCLASSE]) {
      for (const [chave, area] of Object.entries(tabela)) {
        assert.ok(AREAS_VALIDAS.has(area), `${chave} → ${area}`);
      }
    }
  });

  it('chaves com o tamanho certo e ligadas a uma divisão existente', () => {
    for (const k of Object.keys(AREA_POR_DIVISAO)) assert.match(k, /^\d{2}$/);
    for (const k of Object.keys(AREA_POR_CLASSE)) {
      assert.match(k, /^\d{4}$/);
      assert.ok(Object.hasOwn(AREA_POR_DIVISAO, k.slice(0, 2)), `classe ${k} sem divisão`);
    }
    for (const k of Object.keys(AREA_POR_SUBCLASSE)) assert.match(k, /^\d{7}$/);
  });

  it('as áreas usam exatamente os nomes do Regex (o front depende deles)', () => {
    const fonteRegex = readFileSync(new URL('../src/dominio/regrasCategorias.js', import.meta.url), 'utf8');
    const categoriasRegex = new Set([...fonteRegex.matchAll(/categoria: '([^']+)'/g)].map((m) => m[1]));
    for (const area of Object.values(AREAS)) {
      if (area === AREAS.ASSISTENCIA) continue; // área nova, criada com a tabela CNAE
      assert.ok(categoriasRegex.has(area), `"${area}" não existe no Regex`);
    }
  });
});

describe('cobertura contra a lista oficial do IBGE (online)', () => {
  const baixar = async (caminho) => {
    const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v2/cnae/${caminho}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return resposta.json();
  };

  it('todas as divisões oficiais têm área (ou MISTA) e não há divisão inventada', async (t) => {
    let oficiais;
    try {
      oficiais = (await baixar('divisoes')).map((d) => d.id);
    } catch (erro) {
      t.skip(`IBGE indisponível (${erro.message}) — teste pulado`);
      return;
    }
    const semArea = oficiais.filter((id) => !Object.hasOwn(AREA_POR_DIVISAO, id));
    const inventadas = Object.keys(AREA_POR_DIVISAO).filter((id) => !oficiais.includes(id));
    assert.deepEqual(semArea, [], `divisões oficiais sem área: ${semArea}`);
    assert.deepEqual(inventadas, [], `divisões que não existem no IBGE: ${inventadas}`);
  });

  it('toda classe da tabela existe no IBGE', async (t) => {
    let oficiais;
    try {
      oficiais = new Set((await baixar('classes')).map((c) => c.id.slice(0, 4)));
    } catch (erro) {
      t.skip(`IBGE indisponível (${erro.message}) — teste pulado`);
      return;
    }
    const inexistentes = Object.keys(AREA_POR_CLASSE).filter((k) => !oficiais.has(k));
    assert.deepEqual(inexistentes, [], `classes que não existem no IBGE: ${inexistentes}`);
  });
});
