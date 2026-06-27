import type { RequestDraft, Variable } from '@harborclient/sdk';

/**
 * Builds collection-scoped variables from request draft headers and params
 * for SDK variable highlighting in read-only editors.
 *
 * @param draft - Active request draft from the response tab context.
 */
export function variablesFromDraft(draft: RequestDraft): Variable[] {
  return [...draft.headers, ...draft.params]
    .filter((row) => row.enabled && row.key)
    .map((row) => ({
      key: row.key,
      value: row.value,
      defaultValue: '',
      share: false
    }));
}
