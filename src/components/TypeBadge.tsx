import type { SearchItem, TypeCategory } from '../lib/schema';

type BadgeKind = TypeCategory | SearchItem['kind'] | 'deprecated';

export function TypeBadge({ kind, children }: { kind: BadgeKind; children?: React.ReactNode }) {
  return <span className={`type-badge type-badge--${kind}`}>{children ?? kind}</span>;
}
