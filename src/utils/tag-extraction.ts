/**
 * Pure tag extraction helpers.
 * Used when scanning/persisting Highlight.tags and as a render-time fallback.
 *
 * Tag shape matches the existing sidebar/renderer regex:
 *   # followed by letters/numbers/marks/underscore/hyphen/slash (incl. CJK via \p{L})
 */

/** Global unicode hashtag matcher (without the leading # in capture). */
export const TAG_MATCH_REGEX = /#[\p{L}\p{N}\p{M}_/-]+/gu;

/**
 * Extract unique tags (without leading #) from a single string, in order found.
 */
export function extractTagsFromString(text: string): string[] {
	const tags: string[] = [];
	if (!text) {
		return tags;
	}

	// Reset lastIndex in case a shared global regex is reused across calls.
	TAG_MATCH_REGEX.lastIndex = 0;
	const matches = text.match(TAG_MATCH_REGEX);
	if (!matches) {
		return tags;
	}

	for (const tag of matches) {
		const tagName = tag.substring(1); // drop leading #
		if (tagName && !tags.includes(tagName)) {
			tags.push(tagName);
		}
	}
	return tags;
}

/**
 * Extract tags from highlight body text and footnote/comment contents.
 * Body first, then footnotes in order; duplicates are dropped.
 */
export function extractAndMergeTags(
	text: string,
	footnoteContents?: readonly string[] | null
): string[] {
	const tags: string[] = extractTagsFromString(text || '');

	if (footnoteContents) {
		for (const content of footnoteContents) {
			if (!content || content.trim() === '') {
				continue;
			}
			for (const tagName of extractTagsFromString(content)) {
				if (!tags.includes(tagName)) {
					tags.push(tagName);
				}
			}
		}
	}

	return tags;
}

/**
 * Resolve tags for display/filter:
 * - Prefer persisted `highlight.tags` when non-empty (post-scan data).
 * - Otherwise recompute from text + footnoteContents (legacy / empty tags).
 */
export function resolveHighlightTags(highlight: {
	tags?: readonly string[] | null;
	text?: string;
	footnoteContents?: readonly string[] | null;
}): string[] {
	if (highlight.tags && highlight.tags.length > 0) {
		return [...highlight.tags];
	}
	return extractAndMergeTags(highlight.text || '', highlight.footnoteContents);
}
