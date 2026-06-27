import { EmptyState } from '@harborclient/sdk/components';
import { useEffect, useMemo, useState } from '@harborclient/sdk/react';
import type { ResponseTabContext } from '@harborclient/sdk';
import { JwtCandidateList } from './components/JwtCandidateList';
import { JwtDetail } from './components/JwtDetail';
import { extractJwtCandidates } from './jwt/extract';

interface Props {
  /**
   * Read-only response tab context from HarborClient.
   */
  context: ResponseTabContext;
}

/**
 * Response tab that lists JWTs found in the last response and decodes the selected token.
 */
export function JwtTab({ context }: Props) {
  const { response, draft } = context;

  /**
   * JWT candidates extracted from response headers and body.
   */
  const candidates = useMemo(() => extractJwtCandidates(response), [response]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * Keeps selection aligned with the current candidate list after each response change.
   */
  useEffect(() => {
    if (candidates.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current != null && candidates.some((candidate) => candidate.id === current)) {
        return current;
      }
      return candidates[0]?.id ?? null;
    });
  }, [candidates]);

  if (!response) {
    return <EmptyState variant="centered">No response yet.</EmptyState>;
  }

  if (candidates.length === 0) {
    return <EmptyState variant="centered">No JWTs found in this response.</EmptyState>;
  }

  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <JwtCandidateList candidates={candidates} selectedId={selected.id} onSelect={setSelectedId} />
      <JwtDetail token={selected.raw} draft={draft} />
    </div>
  );
}
