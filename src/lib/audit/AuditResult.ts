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
