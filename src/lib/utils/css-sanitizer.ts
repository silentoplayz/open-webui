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
 * Strips CSS comments using a linear-time manual scan.
 * This replaces the regex-based approach (`/\/\*[\s\S]*?\*\//g`) which was
 * vulnerable to ReDoS on malformed inputs like unclosed comments.
 * 
 * @param css - The raw CSS string
 * @returns CSS with all block comments removed
 */
export const stripCSSComments = (css: string): string => {
	let result = '';
	let i = 0;
	while (i < css.length) {
		if (css[i] === '/' && i + 1 < css.length && css[i + 1] === '*') {
			// Skip until closing */
			i += 2;
			while (i < css.length - 1 && !(css[i] === '*' && css[i + 1] === '/')) {
				i++;
			}
			// Skip the closing */ (or end of string if unclosed)
			if (i < css.length - 1) {
				i += 2;
			} else {
				i = css.length; // Unclosed comment — skip to end
			}
		} else {
			result += css[i];
			i++;
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
 */
const DANGEROUS_PATTERNS: RegExp[] = [
	// @import rules: @import url(...) or @import "..." or @import '...'
	/@import\s+(?:url\s*\([^)]*\)|["'][^"']*["'])\s*;?/gi,
	// url() function in any context
	/url\s*\([^)]*\)/gi,
	// image-set() — can load external images (vendor-prefixed and standard)
	/(?:-webkit-)?image-set\s*\(/gi,
	// CSS expressions (IE legacy, but defense-in-depth)
	/expression\s*\(/gi,
	// -moz-binding (Firefox XBL injection, rare but dangerous)
	/-moz-binding\s*:/gi,
	// behavior (IE HTCs)
	/behavior\s*:/gi,
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
