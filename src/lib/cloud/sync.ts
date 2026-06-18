/**
 * Maps an extension scan (PageMeta + AuditResult) to the cloud ScanPayload the web app
 * renders, and uploads it to users/{uid}/scans. Re-scanning a URL overwrites its doc
 * (deterministic id) so history shows the latest state per URL, not duplicates.
 */
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { fbDb } from './firebase';
import type { PageMeta } from '../scrapers/PageMeta';
import type { AuditResult, RuleStatus } from '../audit/AuditResult';
import type { SiteFiles } from '../scrapers/SiteFiles';
import type { SyncScope } from './workspaces';

const SCAN_SCHEMA_VERSION = 1;

function bandFor(score: number): 'good' | 'warn' | 'fail' {
  return score >= 80 ? 'good' : score >= 50 ? 'warn' : 'fail';
}

/** Stable, Firestore-safe doc id from a URL (djb2 hash). */
function scanIdFor(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
  return 's' + h.toString(36);
}

function mapStatus(s: RuleStatus): 'pass' | 'warn' | 'fail' {
  if (s === 'pass') return 'pass';
  if (s === 'fail') return 'fail';
  return 'warn'; // 'warn' | 'pending' both surface as warn in the cloud view
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Build the cloud payload. Undefined fields are dropped on write (ignoreUndefinedProperties). */
export function toScanPayload(
  meta: PageMeta,
  auditResult: AuditResult,
  url: string,
  siteFiles?: SiteFiles
) {
  const tagValue = (key: string): string | undefined =>
    meta.tags.find((t) => t.key.toLowerCase() === key)?.value;

  // Trim site files to a summary (no raw text; cap lists) for the app's Site tab — 1:1 detail.
  const siteFilesSummary = siteFiles
    ? {
        robots: {
          present: siteFiles.robots.present,
          groups: siteFiles.robots.groups.slice(0, 8).map((g) => ({
            userAgents: g.userAgents,
            disallow: g.disallow.length,
            allow: g.allow.length,
          })),
          sitemaps: siteFiles.robots.sitemaps.slice(0, 10),
        },
        sitemap: {
          present: siteFiles.sitemap.present,
          isIndex: siteFiles.sitemap.isIndex,
          urlCount: siteFiles.sitemap.urlCount,
          childCount: siteFiles.sitemap.childCount,
          children: siteFiles.sitemap.children.slice(0, 20).map((c) => ({
            url: c.url,
            urlCount: c.urlCount,
            isIndex: c.isIndex,
            error: c.error,
          })),
          sample: siteFiles.sitemap.sample.slice(0, 10),
          truncated: siteFiles.sitemap.truncated,
        },
        llms: {
          present: siteFiles.llms.present,
          sections: siteFiles.llms.sections.slice(0, 15).map((s) => ({
            heading: s.heading,
            links: s.links.slice(0, 15),
          })),
        },
      }
    : undefined;

  return {
    siteFiles: siteFilesSummary,
    schemaVersion: SCAN_SCHEMA_VERSION,
    url,
    hostname: hostnameOf(url),
    scannedAt: Date.now(),
    title: meta.title ?? '',
    source: 'extension' as const,
    starred: false,
    workspaceId: null,
    // denormalized summary for the history list
    score: auditResult.score,
    band: bandFor(auditResult.score),
    pageMeta: {
      title: meta.title ?? undefined,
      description: tagValue('description'),
      canonical: meta.canonical ?? undefined,
      ogImage: tagValue('og:image') ?? tagValue('twitter:image'),
      favicon: meta.icon ?? undefined,
      tagCount: meta.tags.length,
      tags: meta.tags.map((t) => ({ key: t.key, value: t.value, category: t.category })),
    },
    audit: {
      score: auditResult.score,
      band: bandFor(auditResult.score),
      rules: auditResult.rules.map((r) => ({
        id: r.id,
        label: r.title,
        status: mapStatus(r.status),
        severity: r.severity,
        message: r.detail || undefined,
        meta: r.meta,
      })),
    },
  };
}

export async function uploadScan(
  uid: string,
  payload: ReturnType<typeof toScanPayload>,
  scope: SyncScope = { kind: 'personal' }
): Promise<void> {
  const id = scanIdFor(payload.url);
  const ref =
    scope.kind === 'workspace'
      ? doc(fbDb(), 'workspaces', scope.wsId, 'scans', id)
      : doc(fbDb(), 'users', uid, 'scans', id);
  await setDoc(ref, {
    ...payload,
    workspaceId: scope.kind === 'workspace' ? scope.wsId : null,
    createdAt: serverTimestamp(),
  });
}
