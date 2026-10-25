/**
 * Words for the Audit tab (UX review items 2 and 9): the verdict as text (the icons alone were
 * silent to screen readers), what a rule costs, and the formula, for every plan.
 */
import type { RuleResult, RuleSeverity } from './AuditResult';
import type { RuleWeights } from '../storage/settings';

/** The verdict as a word; "Not applicable" for a rule that did not apply to this page. */
export function verdictLabel(rule: Pick<RuleResult, 'status' | 'skipped'>): string {
  if (rule.skipped) return 'Not applicable';
  switch (rule.status) {
    case 'pass':
      return 'Pass';
    case 'warn':
      return 'Needs work';
    case 'fail':
      return 'Fail';
    default:
      return 'Checking';
  }
}

/** Points out of 100 this rule costs the score (0 on pass), to one decimal. Mirrors `scoreFor`. */
export function pointsLost(rule: Pick<RuleResult, 'status' | 'severity'>, weights: RuleWeights, possible: number): number {
  if (possible <= 0) return 0;
  const w = weights[rule.severity];
  const kept = rule.status === 'pass' ? w : rule.status === 'fail' ? 0 : w / 2;
  return Math.round(((w - kept) / possible) * 1000) / 10;
}

/** The sum of every rule's weight: the denominator of the score. */
export function possiblePoints(rules: readonly Pick<RuleResult, 'severity'>[], weights: RuleWeights): number {
  return rules.reduce((sum, r) => sum + weights[r.severity], 0);
}

const SEVERITY_WORD: Record<RuleSeverity, string> = {
  required: 'required',
  recommended: 'recommended',
  'best-practice': 'best-practice',
};

/** One sentence that says how the number is made, with the weights actually in effect. */
export function formulaText(weights: RuleWeights): string {
  const parts = (Object.keys(SEVERITY_WORD) as RuleSeverity[]).map((s) => `${SEVERITY_WORD[s]} ${weights[s]}`);
  return `Each rule earns its weight when it passes, half when it needs work, nothing when it fails (weights: ${parts.join(', ')}). The score is the share of points earned. Rules that do not apply to this page count as passed, as in the web app.`;
}
