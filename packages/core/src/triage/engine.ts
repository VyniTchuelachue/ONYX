import { CATEGORY_SPECIALTY, type Locale } from '../constants';
import { TRIAGE_RULES, type TriageRule } from './rules';
import type { AssistantTurn } from './types';

/** Lowercase, strip accents and punctuation so "Ça chauffe !" matches "ca chauffe". */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compiled = TRIAGE_RULES.map((rule) => ({
  rule,
  patterns: rule.keywords.map((kw) => {
    const norm = normalizeText(kw);
    // Whole words, tolerating plural/feminine endings on the last word ("frein" → "freins", "creve" → "crevee").
    return { weight: norm.split(' ').length, re: new RegExp(`(?:^| )${escape(norm)}(?:s|e|es)?(?= |$)`) };
  }),
}));

export interface RuleMatch {
  rule: TriageRule;
  score: number;
}

export function scoreRules(text: string): RuleMatch[] {
  const norm = normalizeText(text);
  return compiled
    .map(({ rule, patterns }) => ({
      rule,
      score: patterns.reduce((sum, p) => sum + (p.re.test(norm) ? p.weight : 0), 0),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score * (1 + b.rule.priority / 100) - a.score * (1 + a.rule.priority / 100));
}

/** Pick the rule for a description. Anything life-threatening that is mentioned at all wins. */
export function matchRule(text: string): TriageRule {
  const matches = scoreRules(text);
  const critical = matches
    .filter((m) => m.rule.urgency === 'critical')
    .sort((a, b) => b.rule.priority - a.rule.priority)[0];
  if (critical) return critical.rule;
  return matches[0]?.rule ?? TRIAGE_RULES.find((r) => r.category === 'other')!;
}

/**
 * Offline assistant turn for a conversation. All of the driver's messages are considered,
 * so a follow-up like "I hear clicking" refines the first description.
 */
export function triageOffline(userTexts: string[], locale: Locale): AssistantTurn {
  const joined = userTexts.join('. ');
  const latest = userTexts[userTexts.length - 1] ?? '';
  // The latest message decides when it is specific on its own; otherwise use the whole thread.
  const latestMatches = scoreRules(latest);
  const rule = latestMatches.length > 0 ? matchRule(latest) : matchRule(joined);
  const c = rule.content[locale];
  const quoted = joined.length > 280 ? `${joined.slice(0, 277)}…` : joined;
  const driverSays = locale === 'fr' ? `Le conducteur indique : « ${quoted} »` : `Driver says: "${quoted}"`;

  return {
    reply: c.reply,
    urgency: rule.urgency,
    category: rule.category,
    specialty: CATEGORY_SPECIALTY[rule.category],
    canDrive: rule.canDrive,
    callEmergency: rule.callEmergency,
    safety: c.safety,
    checks: c.checks,
    likelyCauses: c.causes,
    needsProfessional: rule.category !== 'other',
    followUpQuestion: c.followUp,
    quickReplies: c.quickReplies,
    technicianSummary: quoted ? `${c.summary} ${driverSays}` : c.summary,
  };
}
