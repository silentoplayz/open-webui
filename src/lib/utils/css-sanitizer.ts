/**
 * @file CSS Sanitizer for theme security
 * This module strips dangerous CSS constructs that could be used for data exfiltration or phishing.
 * 
 * Defense-in-depth approach:
 * 1. Strip comments using a linear-time scanner (immune to ReDoS)
 * 2. Normalize CSS escape sequences so obfuscated identifiers are caught
 * 3. Remove @import rules, url() functions, and other external resource functions
 */

/**
 * Strips CSS comments using a linear-time manual scan that respects string boundaries.
 * This ensures that comments inside strings (e.g. content: "/*") are preserved,
 * while actual comments are removed.
 * 
 * @param css - The raw CSS string
 * @returns CSS with all block comments removed
 */
export const stripCSSComments = (css: string): string => {
	let result = '';
	let i = 0;
	let inString: string | null = null; // null, "'", or '"'

	while (i < css.length) {
		const char = css[i];

		if (inString) {
			result += char;
			if (char === inString) {
				// potential end of string
				// Check for escaped quote (odd number of backslashes before)
				let backslashCount = 0;
				let j = i - 1;
				while (j >= 0 && css[j] === '\\') {
					backslashCount++;
					j--;
				}
				if (backslashCount % 2 === 0) {
					inString = null;
				}
			}
			i++;
		} else {
			// Not in a string
			if (char === '"' || char === "'") {
				inString = char;
				result += char;
				i++;
			} else if (char === '/' && i + 1 < css.length && css[i + 1] === '*') {
				// Start of comment
				i += 2;
				while (i < css.length - 1 && !(css[i] === '*' && css[i + 1] === '/')) {
					i++;
				}
				// Skip the closing */
				if (i < css.length - 1) {
					i += 2;
				} else {
					i = css.length; // Unclosed comment
				}
				// We do NOT add anything to result (stripping the comment)
				// Note: We might want to add a space to prevent merging tokens, e.g. div/*...*/.class -> div.class
				// But standardized minifiers/sanitizers often just strip.
				// Let's add a space to be safe against accidental token merging
				result += ' '; 
			} else {
				result += char;
				i++;
			}
		}
	}
	return result;
};

/**
 * Normalizes CSS escape sequences to their plain-text equivalents.
 * This prevents bypasses like `\75\72\6c()` to hide `url()`.
 *
 * Handles:
 * - `\XX` hex escapes (1-6 hex digits followed by optional whitespace)
 * - `\<char>` literal escapes
 */
const normalizeCSSEscapes = (css: string): string => {
	// Match CSS escape sequences: backslash + 1-6 hex digits (+ optional whitespace), or backslash + any char
	return css.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_, hex, char) => {
		if (hex) {
			return String.fromCodePoint(parseInt(hex, 16));
		}
		return char || '';
	});
};

/**
 * Regex patterns matching dangerous CSS constructs.
 * All are case-insensitive and checked after normalization.
 * 
 * Improvements:
 * - Attempt to match the closing parenthesis to avoid leaving "debris" arguments.
 * - However, matching balanced parentheses with regex is impossible.
 * - We will use a greedy match up to the first closing parenthesis, which is safer than nothing,
 *   but strict removal of the function name + opening paren is actually the robust part (rendering it invalid).
 *   
 *   Refining the strategy:
 *   If we just remove `url(` then `url('x')` becomes `'x')`. This is invalid CSS syntax for a property value in most cases,
 *   or at least benign string content.
 *   
 *   The most important thing is that the *functional* part is gone.
 *   
 *   Let's keep the removal of the identifier + `(` as the primary mechanism, but allows for eating up content if simple.
 */
const DANGEROUS_PATTERNS: RegExp[] = [
	// @import rules: @import url(...) or @import "..." or @import '...'
	/@import\s+(?:url\s*\([^)]*\)|["'][^"']*["'])\s*;?/gi,
	// url() function - consume until )
	/url\s*\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/gi, 
	// image-set()
	/(?:-webkit-)?image-set\s*\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/gi,
	// CSS expressions (IE legacy)
	/expression\s*\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/gi,
	// -moz-binding
	/-moz-binding\s*:[^;]+;?/gi,
	// behavior
	/behavior\s*:[^;]+;?/gi,
];

/**
 * Regex patterns for detection only (used by containsDangerousCSS).
 * These are the same patterns but we only need to test, not replace.
 */
const DETECTION_PATTERNS: RegExp[] = [
	/@import\s+(?:url\s*\([^)]*\)|["'][^"']*["'])/i,
	/url\s*\([^)]*\)/i,
	/(?:-webkit-)?image-set\s*\(/i,
	/expression\s*\(/i,
	/-moz-binding\s*:/i,
	/behavior\s*:/i,
];

/**
 * Sanitizes custom CSS by removing dangerous constructs.
 * Strips:
 * - @import rules (can load external stylesheets)
 * - url() functions (can make external requests for tracking/exfiltration)
 * - image-set() functions (can load external images)
 * - expression() / -moz-binding / behavior (legacy browser code execution)
 * 
 * @param css - The raw CSS string to sanitize
 * @returns Sanitized CSS with dangerous constructs removed
 */
export const sanitizeCSS = (css: string): string => {
	if (!css || typeof css !== 'string') {
		return '';
	}

	let sanitized = css;

	// Step 1: Remove CSS comments using linear-time scanner (immune to ReDoS)
	sanitized = stripCSSComments(sanitized);

	// Step 2: Normalize CSS escape sequences to catch obfuscated identifiers
	// e.g. \75\72\6c() → url()
	sanitized = normalizeCSSEscapes(sanitized);

	// Step 3: Remove all dangerous patterns
	for (const pattern of DANGEROUS_PATTERNS) {
		// Reset lastIndex for global regexes
		pattern.lastIndex = 0;
		sanitized = sanitized.replace(pattern, '');
	}

	return sanitized;
};

/**
 * Checks if CSS contains dangerous constructs that will be stripped.
 * Used for validation warnings during import.
 * 
 * @param css - The CSS string to check
 * @returns true if dangerous constructs are found
 */
export const containsDangerousCSS = (css: string): boolean => {
	if (!css || typeof css !== 'string') {
		return false;
	}

	// Remove comments using linear-time scanner (immune to ReDoS)
	let normalized = stripCSSComments(css);

	// Normalize escape sequences
	normalized = normalizeCSSEscapes(normalized);

	// Check all detection patterns
	for (const pattern of DETECTION_PATTERNS) {
		if (pattern.test(normalized)) {
			return true;
		}
	}

	return false;
};
