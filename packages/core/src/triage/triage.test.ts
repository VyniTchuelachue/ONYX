import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { matchRule, triageOffline } from './engine';
import { assistantTurnSchema } from './types';
import { TRIAGE_RULES } from './rules';

describe('offline triage', () => {
  const cases: [string, string][] = [
    ["Ma voiture ne démarre plus, j'entends des clics", 'wont_start'],
    ['pneu crevé sur la route de Japoma', 'flat_tire'],
    ['Le moteur chauffe et il y a de la vapeur', 'overheating'],
    ['La pédale de frein est molle', 'brakes'],
    ['My car is overheating, steam everywhere', 'overheating'],
    ['flat battery, nothing lights up', 'battery'],
    ["J'ai allumé mes feux de détresse, j'ai un pneu crevé", 'flat_tire'],
    ['Le voyant moteur orange est allumé', 'warning_light'],
    ['panne sèche, jauge à zéro', 'fuel'],
  ];
  for (const [text, expected] of cases) {
    it(`"${text}" → ${expected}`, () => assert.equal(matchRule(text).category, expected));
  }

  it('puts safety first when danger is mentioned at all', () => {
    assert.equal(matchRule('la voiture fume et ne démarre pas').category, 'smoke_fire');
    assert.equal(matchRule('accident, the car does not start').category, 'accident');
  });

  it('asks a question when it cannot tell', () => {
    const turn = triageOffline(['bonjour'], 'fr');
    assert.equal(turn.category, 'other');
    assert.ok(turn.followUpQuestion);
  });

  it('refines with follow-up answers', () => {
    const turn = triageOffline(['ma voiture est en panne', 'il y a de la vapeur sous le capot'], 'fr');
    assert.equal(turn.category, 'overheating');
    assert.match(turn.technicianSummary, /vapeur/);
  });

  it('produces turns the AI schema accepts, in both languages', () => {
    for (const rule of TRIAGE_RULES) {
      for (const locale of ['fr', 'en'] as const) {
        const keyword = rule.keywords[0] ?? 'hello';
        const turn = triageOffline([keyword], locale);
        assert.ok(assistantTurnSchema.safeParse(turn).success, `${rule.category}/${locale}`);
        assert.equal(rule.content.fr.checks.length, rule.content.en.checks.length, `${rule.category} checks parity`);
        assert.equal(rule.content.fr.safety.length, rule.content.en.safety.length, `${rule.category} safety parity`);
      }
    }
  });

  it('flags emergencies', () => {
    const turn = triageOffline(['il y a des flammes sous le capot'], 'fr');
    assert.equal(turn.callEmergency, true);
    assert.equal(turn.canDrive, 'no');
    assert.equal(turn.urgency, 'critical');
  });
});
