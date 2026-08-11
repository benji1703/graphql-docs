import { Layers3 } from 'lucide-react';
import type { OperationProviderBucket, OperationProviderId } from '../lib/operationProviders';

export function OperationProviderSelect({ buckets, value, onChange, compact = false }: {
  buckets: OperationProviderBucket[];
  value: OperationProviderId;
  onChange: (value: OperationProviderId) => void;
  compact?: boolean;
}) {
  return (
    <label className={`operation-provider-select ${compact ? 'operation-provider-select--compact' : ''}`}>
      <Layers3 size={compact ? 14 : 16} />
      <span className="sr-only">Provider category</span>
      <select value={value} onChange={(event) => onChange(event.target.value as OperationProviderId)} aria-label="Filter operations by provider">
        {buckets.map((bucket) => (
          <option value={bucket.id} key={bucket.id}>{bucket.label} · {bucket.count.toLocaleString()}</option>
        ))}
      </select>
    </label>
  );
}
