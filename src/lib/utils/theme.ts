import type { Theme } from '$lib/types';
import { containsDangerousCSS } from '$lib/utils/css-sanitizer';
import { themeSchema } from '$lib/schemas/theme-schema';

/**
 * Validates that a URL uses a safe protocol (http: or https:).
 * Rejects javascript:, data:, blob:, and other dangerous protocols.
 * Allows data: URIs for background images if they are reasonably sized.
 */
export const isValidThemeUrl = (url: string, allowDataUri = false): boolean => {
	if (!url || typeof url !== 'string') return false;
	try {
		const parsed = new URL(url);
		if (['http:', 'https:'].includes(parsed.protocol)) return true;
		if (allowDataUri && parsed.protocol === 'data:') {
			// Allow data URIs for images but enforce a size limit (500KB)
			const MAX_DATA_URI_SIZE = 500 * 1024;
			return url.length <= MAX_DATA_URI_SIZE;
		}
		return false;
	} catch {
		return false;
	}
};

export const validateTheme = (theme: any): { valid: boolean; error?: string } => {
	// Phase 1: Structural validation with Zod schema
	const schemaValidation = themeSchema.safeParse(theme);
	if (!schemaValidation.success) {
		// Format Zod errors into a readable message
		const firstError = schemaValidation.error.issues[0];
		const path = firstError.path.join('.');
		const message = firstError.message;
		return {
			valid: false,
			error: `Invalid theme structure${path ? ` at "${path}"` : ''}: ${message}`
		};
	}

	// Phase 2: Security-specific validations (these go beyond schema)
	if (typeof theme.id !== 'string' || !theme.id) {
		return { valid: false, error: 'Invalid theme: "id" must be a non-empty string.' };
	}
	if (typeof theme.name !== 'string' || !theme.name) {
		return { valid: false, error: 'Invalid theme: "name" must be a non-empty string.' };
	}
	const allowedBases = ['system', 'light', 'dark', 'oled-dark', 'her'];
	if (typeof theme.base !== 'string' || !allowedBases.includes(theme.base)) {
		return {
			valid: false,
			error: `Invalid theme: "base" must be one of ${allowedBases.join(', ')}.`
		};
	}
	if (theme.author && typeof theme.author !== 'string') {
		return { valid: false, error: 'Invalid theme: "author" must be a string.' };
	}
	if (theme.version && typeof theme.version !== 'string') {
		return { valid: false, error: 'Invalid theme: "version" must be a string.' };
	}
	if (
		theme.variables &&
		(typeof theme.variables !== 'object' ||
			Array.isArray(theme.variables) ||
			theme.variables === null)
	) {
		return { valid: false, error: 'Invalid theme: "variables" must be an object.' };
	}
	if (theme.css && typeof theme.css !== 'string') {
		return { valid: false, error: 'Invalid theme: "css" must be a string.' };
	}

	// Warn if CSS contains dangerous constructs (url(), @import, image-set(), etc.)
	if (theme.css && containsDangerousCSS(theme.css)) {
		return {
			valid: false,
			error: 'Invalid theme: CSS contains dangerous constructs (url(), @import, image-set(), expression()) which are not allowed for security reasons.'
		};
	}

	// Enforce CSS size limit (100KB) to prevent DoS
	const MAX_CSS_SIZE = 100 * 1024; // 100KB
	if (theme.css && theme.css.length > MAX_CSS_SIZE) {
		return {
			valid: false,
			error: `Invalid theme: "css" exceeds maximum size of ${MAX_CSS_SIZE / 1024}KB (current: ${Math.round(theme.css.length / 1024)}KB).`
		};
	}

	if (theme.animationScript && typeof theme.animationScript !== 'string') {
		return { valid: false, error: 'Invalid theme: "animationScript" must be a string.' };
	}

	// Enforce animation script size limit (50KB) to prevent DoS
	const MAX_SCRIPT_SIZE = 50 * 1024; // 50KB
	if (theme.animationScript && theme.animationScript.length > MAX_SCRIPT_SIZE) {
		return {
			valid: false,
			error: `Invalid theme: "animationScript" exceeds maximum size of ${MAX_SCRIPT_SIZE / 1024}KB (current: ${Math.round(theme.animationScript.length / 1024)}KB).`
		};
	}

	if (theme.animationScript) {
		const forbiddenStrings = ['window.', 'document.', 'parent.', 'top.'];
		for (const str of forbiddenStrings) {
			if (theme.animationScript.includes(str)) {
				return {
					valid: false,
					error: `Invalid theme: "animationScript" contains "${str}" which is no longer allowed for security reasons. Scripts must now run in an isolated Web Worker.`
				};
			}
		}
	}

	// URL validation for source and background URLs
	if (theme.sourceUrl && !isValidThemeUrl(theme.sourceUrl)) {
		return {
			valid: false,
			error: 'Invalid theme: "sourceUrl" must be a valid HTTP or HTTPS URL.'
		};
	}
	if (theme.repository && !isValidThemeUrl(theme.repository)) {
		return {
			valid: false,
			error: 'Invalid theme: "repository" must be a valid HTTP or HTTPS URL.'
		};
	}
	if (theme.systemBackgroundImageUrl && !isValidThemeUrl(theme.systemBackgroundImageUrl, true)) {
		return {
			valid: false,
			error: 'Invalid theme: "systemBackgroundImageUrl" must be a valid HTTP/HTTPS URL or data URI (max 500KB).'
		};
	}
	if (theme.chatBackgroundImageUrl && !isValidThemeUrl(theme.chatBackgroundImageUrl, true)) {
		return {
			valid: false,
			error: 'Invalid theme: "chatBackgroundImageUrl" must be a valid HTTP/HTTPS URL or data URI (max 500KB).'
		};
	}
	return { valid: true };
};

export const isDuplicateTheme = (
	theme: Theme,
	existingThemes: Theme[],
	isEditing: boolean,
	idToUpdate?: string
): boolean => {
	for (const existingTheme of existingThemes) {
		// Skip self-comparison when editing
		if (isEditing && existingTheme.id === idToUpdate) {
			continue;
		}

		if (
			theme.imageFingerprint &&
			existingTheme.imageFingerprint &&
			JSON.stringify(existingTheme.imageFingerprint) === JSON.stringify(theme.imageFingerprint)
		) {
			return true;
		}

		const newThemeCopy = { ...theme };
		delete newThemeCopy.id;
		delete newThemeCopy.sourceUrl;
		delete newThemeCopy.emoji;
		delete newThemeCopy.imageFingerprint;

		const existingThemeCopy = { ...existingTheme };
		delete existingThemeCopy.id;
		delete existingThemeCopy.sourceUrl;
		delete existingThemeCopy.emoji;
		delete existingThemeCopy.imageFingerprint;

		if (JSON.stringify(existingThemeCopy) === JSON.stringify(newThemeCopy)) {
			return true;
		}
	}
	return false;
};

export const isMismatchedVersion = (uiVersion: string, themeVersion: string) => {
	if (!themeVersion) {
		return false;
	}

	const [uiMajor, uiMinor] = uiVersion.split('.').map(Number);
	const [themeMajor, themeMinor] = themeVersion.split('.').map(Number);

	if (uiMajor !== themeMajor || uiMinor !== themeMinor) {
		return true;
	}

	return false;
};

export const objectToCss = (obj: { [key: string]: string }): string => {
	if (!obj) return '';
	let css = '';
	for (const key in obj) {
		css += `${key}: ${obj[key]};\n`;
	}
	return css.trim();
};

export const cssToObject = (css: string): { [key: string]: string } => {
	const obj = {};
	// Remove comments, then find all key-value pairs
	const uncommentedCss = css.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1');

	const regex = /([\w-]+)\s*:\s*([^;]+);?/g;
	let match;
	while ((match = regex.exec(uncommentedCss)) !== null) {
		obj[match[1].trim()] = match[2].trim();
	}

	return obj;
};
