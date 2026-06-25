import type { JwtCandidate } from "../jwt/extract";
import { truncateJwt } from "../jwt/extract";

interface Props {
  /**
   * JWT candidates discovered in the response.
   */
  candidates: JwtCandidate[];

  /**
   * Id of the currently selected candidate.
   */
  selectedId: string | null;

  /**
   * Selects a candidate from the list.
   */
  onSelect: (id: string) => void;
}

/**
 * Scrollable list of JWT candidates found in the response.
 */
export function JwtCandidateList({ candidates, selectedId, onSelect }: Props) {
  return (
    <div
      className="flex w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-separator bg-sidebar p-2"
      role="listbox"
      aria-label="JWT tokens found in response"
    >
      {candidates.map((candidate) => {
        const selected = candidate.id === selectedId;
        return (
          <button
            key={candidate.id}
            type="button"
            role="option"
            aria-current={selected ? "true" : undefined}
            aria-selected={selected}
            className={`rounded-md px-2 py-2 text-left text-[14px] ${
              selected ? "bg-selection text-text" : "text-text hover:bg-control"
            }`}
            onClick={() => onSelect(candidate.id)}
          >
            <div className="font-medium">{candidate.label}</div>
            <div className="mt-0.5 truncate font-mono text-muted">
              {truncateJwt(candidate.raw)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
