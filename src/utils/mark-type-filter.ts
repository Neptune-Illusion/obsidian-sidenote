/**
 * Pure mark-type filter helpers for the sidebar.
 * Extracted so filter matching can be unit-tested without the full view.
 */

/** Filter values selectable in the mark-type filter menu. */
export type MarkTypeFilterValue =
	| 'highlight'
	| 'underline'
	| 'strikethrough'
	| 'bold'
	| 'comment';

/** Minimal shape needed to decide mark-type filter membership. */
export interface MarkTypeFilterable {
	markType?: 'highlight' | 'underline' | 'strikethrough' | 'bold';
	isNativeComment?: boolean;
}

export const ALL_MARK_TYPE_FILTER_VALUES: readonly MarkTypeFilterValue[] = [
	'highlight',
	'underline',
	'strikethrough',
	'bold',
	'comment'
] as const;

/**
 * Whether an item passes the selected mark-type filters.
 *
 * - Empty selection → no type filter (always pass).
 * - Non-empty selection → OR across selected types.
 * - Native comments match only the `'comment'` filter value.
 * - Regular marks match their `markType` (defaulting to `'highlight'`).
 */
export function matchesMarkTypeFilter(
	item: MarkTypeFilterable,
	selected: Iterable<string>
): boolean {
	const selectedSet = selected instanceof Set ? selected : new Set(selected);
	if (selectedSet.size === 0) {
		return true;
	}

	if (item.isNativeComment) {
		return selectedSet.has('comment');
	}

	const markType = item.markType || 'highlight';
	return selectedSet.has(markType);
}
