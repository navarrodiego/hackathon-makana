import { createHash } from 'node:crypto';
import { basename } from 'node:path';

export interface WorktreeDatabases { readonly dev: string; readonly test: string; readonly isolation: string }

/**
 * Nombres propios de un worktree: derivados de su ruta, estables y sin colisión entre rutas.
 * Cabe en 63 caracteres incluso con el sufijo más largo (`_test_isolation`) y el rol `_migrate`.
 */
export function worktreeDatabases(worktreePath: string): WorktreeDatabases {
  const slug = basename(worktreePath).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 23).replace(/_+$/, '') || 'wt';
  const hash = createHash('sha256').update(worktreePath).digest('hex').slice(0, 6);
  const dev = `relevo_wt_${slug}_${hash}`;
  return { dev, test: `${dev}_test`, isolation: `${dev}_test_isolation` };
}
