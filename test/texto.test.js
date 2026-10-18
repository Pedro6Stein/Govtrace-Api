import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { decodificarEntidadesHtml } from '../src/dominio/texto.js';

describe('decodificarEntidadesHtml', () => {
  it('decodifica o "&" escapado (caso real: razão social com "&")', () => {
    assert.equal(decodificarEntidadesHtml('W &amp; C ALIMENTOS EIRELI'), 'W & C ALIMENTOS EIRELI');
  });

  it('decodifica aspas e apóstrofo', () => {
    assert.equal(decodificarEntidadesHtml('A &quot;Prefeitura&quot;'), 'A "Prefeitura"');
    assert.equal(decodificarEntidadesHtml('D&apos;Avila'), "D'Avila");
  });

  it('decodifica entidades numéricas decimais e hexadecimais', () => {
    assert.equal(decodificarEntidadesHtml('A&#38;B'), 'A&B');
    assert.equal(decodificarEntidadesHtml('A&#x26;B'), 'A&B');
  });

  it('texto sem entidades passa intacto, sem alocação desnecessária', () => {
    assert.equal(decodificarEntidadesHtml('PREFEITURA MUNICIPAL'), 'PREFEITURA MUNICIPAL');
  });

  it('não mexe em acentuação (já vem em UTF-8, nunca como entidade)', () => {
    assert.equal(decodificarEntidadesHtml('Secretaria de Educação'), 'Secretaria de Educação');
  });

  it('entidade desconhecida permanece literal (não quebra, não adivinha)', () => {
    assert.equal(decodificarEntidadesHtml('A&foo;B'), 'A&foo;B');
  });

  it('valores não-string passam direto (comportamento de fallback do chamador)', () => {
    assert.equal(decodificarEntidadesHtml(undefined), undefined);
    assert.equal(decodificarEntidadesHtml(null), null);
  });
});
