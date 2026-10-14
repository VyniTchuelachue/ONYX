import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createTranslator, dictionaries } from './index';

function shape(node: unknown, prefix = ''): string[] {
  if (Array.isArray(node)) return [`${prefix}[${node.length}]`];
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe('i18n', () => {
  it('English mirrors French exactly, list lengths included', () => {
    assert.deepEqual(shape(dictionaries.en).sort(), shape(dictionaries.fr).sort());
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    const walk = (fr: unknown, en: unknown, path: string) => {
      if (typeof fr === 'string') {
        assert.equal(placeholders(en as string), placeholders(fr), path);
      } else if (fr && typeof fr === 'object') {
        for (const k of Object.keys(fr)) walk((fr as never)[k], (en as never)[k], `${path}.${k}`);
      }
    };
    walk(dictionaries.fr, dictionaries.en, '');
  });

  it('interpolates, pluralises and applies French spacing', () => {
    const fr = createTranslator('fr');
    const en = createTranslator('en');
    assert.equal(fr.t('location.near', { place: 'Akwa' }), 'Près d’Akwa');
    assert.equal(fr.t('location.near', { place: 'Ndokoti' }), 'Près de Ndokoti');
    assert.equal(en.t('home.headline'), 'Broken down? Tell us what’s wrong.');
    assert.equal(fr.tp('technicians.results', 1), '1 technicien');
    assert.equal(fr.tp('technicians.results', 12), '12 techniciens');
    assert.equal(en.tp('technicians.results', 1), '1 technician');
    assert.equal(fr.t('requestNew.whatHappened'), 'Que se passe-t-il ?');
    assert.equal(fr.tp('technicians.results', 1500), '1 500 techniciens');
    assert.equal(fr.ta('emergency.checklist').length, 5);
  });
});
