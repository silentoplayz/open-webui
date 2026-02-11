/**
 * @file CSS Sanitizer for theme security
 * This module strips dangerous CSS constructs that could be used for data exfiltration or phishing.
 */

/**
 * Sanitizes custom CSS by removing dangerous constructs.
 * Strips:
 * - @import rules (can load external stylesheets)
 * - url() functions (can make external requests for tracking/exfiltration)
 * 
 * @param css - The raw CSS string to sanitize
 * @returns Sanitized CSS with dangerous constructs removed
 */
export const sanitizeCSS = (css: string): string => {
	if (!css || typeof css !== 'string') {
		return '';
	}

	let sanitized = css;

	// Step 1: Remove CSS comments to prevent obfuscation
	// Matches /* ... */ including multiline
	sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

	// Step 2: Remove @import rules (case-insensitive)
	// Matches: @import url(...); or @import "..."; or @import '...';
	sanitized = sanitized.replace(/@import\s+(?:url\s*\([^)]*\)|["'][^"']*["'])\s*;?/gi, '');

	// Step 3: Remove url() functions (case-insensitive)
	// Matches: url("..."), url('...'), url(...) in any context
	sanitized = sanitized.replace(/url\s*\([^)]*\)/gi, '');

	return sanitized;
};

/**
 * Checks if CSS contains dangerous constructs that will be stripped.
 * Used for validation warnings.
 * 
 * @param css - The CSS string to check
 * @returns true if dangerous constructs are found
 */
export const containsDangerousCSS = (css: string): boolean => {
	if (!css || typeof css !== 'string') {
		return false;
	}

	// Remove comments first to avoid false positives
	const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

	// Check for @import
	if (/@import\s+(?:url\s*\([^)]*\)|["'][^"']*["'])/i.test(withoutComments)) {
		return true;
	}

	// Check for url()
	if (/url\s*\([^)]*\)/i.test(withoutComments)) {
		return true;
	}

	return false;
};
