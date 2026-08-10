/**
 * Tests for pure mark-type filter matching used by the sidebar.
 */

import {
	matchesMarkTypeFilter,
	ALL_MARK_TYPE_FILTER_VALUES,
	type MarkTypeFilterable
} from './mark-type-filter';

describe('matchesMarkTypeFilter', () => {
	const highlight: MarkTypeFilterable = { markType: 'highlight' };
	const underline: MarkTypeFilterable = { markType: 'underline' };
	const strikethrough: MarkTypeFilterable = { markType: 'strikethrough' };
	const bold: MarkTypeFilterable = { markType: 'bold' };
	const noType: MarkTypeFilterable = {};
	const nativeComment: MarkTypeFilterable = { isNativeComment: true };
	const nativeWithMarkType: MarkTypeFilterable = {
		isNativeComment: true,
		markType: 'highlight'
	};

	it('passes everything when no mark types are selected', () => {
		const selected = new Set<string>();
		expect(matchesMarkTypeFilter(highlight, selected)).toBe(true);
		expect(matchesMarkTypeFilter(underline, selected)).toBe(true);
		expect(matchesMarkTypeFilter(nativeComment, selected)).toBe(true);
		expect(matchesMarkTypeFilter(noType, selected)).toBe(true);
	});

	it('defaults missing markType to highlight', () => {
		expect(matchesMarkTypeFilter(noType, new Set(['highlight']))).toBe(true);
		expect(matchesMarkTypeFilter(noType, new Set(['underline']))).toBe(false);
	});

	it('matches a single selected mark type (OR of one)', () => {
		const selected = new Set(['underline']);
		expect(matchesMarkTypeFilter(underline, selected)).toBe(true);
		expect(matchesMarkTypeFilter(highlight, selected)).toBe(false);
		expect(matchesMarkTypeFilter(strikethrough, selected)).toBe(false);
		expect(matchesMarkTypeFilter(bold, selected)).toBe(false);
		expect(matchesMarkTypeFilter(nativeComment, selected)).toBe(false);
	});

	it('matches any of multiple selected mark types (OR)', () => {
		const selected = new Set(['bold', 'strikethrough']);
		expect(matchesMarkTypeFilter(bold, selected)).toBe(true);
		expect(matchesMarkTypeFilter(strikethrough, selected)).toBe(true);
		expect(matchesMarkTypeFilter(highlight, selected)).toBe(false);
		expect(matchesMarkTypeFilter(underline, selected)).toBe(false);
	});

	it('matches native comments only via the comment filter value', () => {
		const commentOnly = new Set(['comment']);
		expect(matchesMarkTypeFilter(nativeComment, commentOnly)).toBe(true);
		expect(matchesMarkTypeFilter(nativeWithMarkType, commentOnly)).toBe(true);
		expect(matchesMarkTypeFilter(highlight, commentOnly)).toBe(false);

		const highlightOnly = new Set(['highlight']);
		expect(matchesMarkTypeFilter(nativeComment, highlightOnly)).toBe(false);
		expect(matchesMarkTypeFilter(nativeWithMarkType, highlightOnly)).toBe(false);
	});

	it('OR-combines comment with other mark types', () => {
		const selected = new Set(['comment', 'underline']);
		expect(matchesMarkTypeFilter(nativeComment, selected)).toBe(true);
		expect(matchesMarkTypeFilter(underline, selected)).toBe(true);
		expect(matchesMarkTypeFilter(bold, selected)).toBe(false);
	});

	it('accepts array as well as Set for selected values', () => {
		expect(matchesMarkTypeFilter(bold, ['bold', 'highlight'])).toBe(true);
		expect(matchesMarkTypeFilter(underline, ['bold', 'highlight'])).toBe(false);
	});

	it('exposes all supported filter values', () => {
		expect(ALL_MARK_TYPE_FILTER_VALUES).toEqual([
			'highlight',
			'underline',
			'strikethrough',
			'bold',
			'comment'
		]);
	});
});
