export type RuleSeverity = 'required' | 'recommended' | 'best-practice';
export type RuleStatus = 'pass' | 'warn' | 'fail' | 'pending';
export type ScoreBand = 'success' | 'warning' | 'danger';

export interface RuleResult {
  id: string;
  severity: RuleSeverity;
  title: string;
  description: string;
  status: RuleStatus;
  detail: string;
  /**
   * The rule did not apply to this page (not an article, no hreflang, no JSON-LD). Status stays
   * `pass` so the score matches the web app's engine; the UI says "Not applicable" instead of a tick.
   */
  skipped?: true;
  meta?: {
    length?: number;
    min?: number;
    max?: number;
  };
}

export interface AuditResult {
  score: number;
  band: ScoreBand;
  rules: RuleResult[];
  hasPending: boolean;
}
