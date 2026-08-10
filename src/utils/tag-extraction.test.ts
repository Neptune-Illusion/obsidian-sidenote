/**
 * Tests for tag extraction used when persisting Highlight.tags.
 */

import {
	extractTagsFromString,
	extractAndMergeTags,
	resolveHighlightTags,
	TAG_MATCH_REGEX
} from './tag-extraction';

describe('tag extraction', () => {
	describe('extractTagsFromString', () => {
		it('extracts #xxx from highlight body text', () => {
			expect(extractTagsFromString('meeting #project notes')).toEqual(['project']);
			expect(extractTagsFromString('==meeting #project==')).toEqual(['project']);
		});

		it('extracts Chinese tags like #项目', () => {
			expect(extractTagsFromString('讨论 #项目 进度')).toEqual(['项目']);
			expect(extractTagsFromString('#项目A #笔记')).toEqual(['项目A', '笔记']);
		});

		it('supports nested paths and hyphens/underscores', () => {
			expect(extractTagsFromString('#work/project-1 #my_tag')).toEqual([
				'work/project-1',
				'my_tag'
			]);
		});

		it('stops at spaces and punctuation', () => {
			expect(extractTagsFromString('#foo, #bar.')).toEqual(['foo', 'bar']);
			expect(extractTagsFromString('(#baz)')).toEqual(['baz']);
		});

		it('returns empty for no tags', () => {
			expect(extractTagsFromString('no tags here')).toEqual([]);
			expect(extractTagsFromString('')).toEqual([]);
		});

		it('dedupes repeated tags in one string', () => {
			expect(extractTagsFromString('#a #b #a')).toEqual(['a', 'b']);
		});
	});

	describe('extractAndMergeTags', () => {
		it('extracts tags from footnote/comment contents', () => {
			expect(extractAndMergeTags('plain text', ['review #urgent'])).toEqual([
				'urgent'
			]);
		});

		it('merges body and footnote tags and dedupes', () => {
			expect(
				extractAndMergeTags('body #project and #shared', [
					'comment #shared #followup',
					''
				])
			).toEqual(['project', 'shared', 'followup']);
		});

		it('handles missing footnotes', () => {
			expect(extractAndMergeTags('#solo')).toEqual(['solo']);
			expect(extractAndMergeTags('#solo', null)).toEqual(['solo']);
			expect(extractAndMergeTags('#solo', undefined)).toEqual(['solo']);
		});

		it('extracts Chinese tags from body and comments', () => {
			expect(
				extractAndMergeTags('正文 #项目', ['备注 #待办 #项目'])
			).toEqual(['项目', '待办']);
		});
	});

	describe('resolveHighlightTags', () => {
		it('prefers persisted tags when non-empty', () => {
			expect(
				resolveHighlightTags({
					tags: ['persisted'],
					text: 'body #ignored',
					footnoteContents: ['#also-ignored']
				})
			).toEqual(['persisted']);
		});

		it('falls back to text + footnotes when tags empty (legacy)', () => {
			expect(
				resolveHighlightTags({
					tags: [],
					text: 'meeting #project',
					footnoteContents: ['note #urgent']
				})
			).toEqual(['project', 'urgent']);
		});

		it('falls back when tags missing', () => {
			expect(
				resolveHighlightTags({
					text: '#only-body'
				})
			).toEqual(['only-body']);
		});
	});

	describe('TAG_MATCH_REGEX', () => {
		it('is a global unicode regex', () => {
			expect(TAG_MATCH_REGEX.flags).toContain('g');
			expect(TAG_MATCH_REGEX.flags).toContain('u');
		});
	});
});
