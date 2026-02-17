/**
 * Simple CSS Formatter
 * Formats a CSS string with proper indentation and newlines.
 */
export const formatCSS = (css: string): string => {
	if (!css) return '';

	// 1. Basic cleanup: remove existing newlines and extra spaces
	const clean = css
		.replace(/\s+/g, ' ') // Collapse all whitespace to single space
		.replace(/([{};,])\s*/g, '$1') // Remove spaces around delimiters
		.replace(/\s*([{};,])/g, '$1');

	// 2. Add structural formatting
	const formatted = clean
		.replace(/{/g, ' {\n') // Newline after {
		.replace(/}/g, '\n}\n\n') // Newline before and after }
		.replace(/;/g, ';\n') // Newline after ;
		.replace(/,/g, ', '); // Space after ,

	// 3. Handle indentation
	const lines = formatted.split('\n');
	let indentLevel = 0;
	const result = [];

	for (let line of lines) {
		line = line.trim();
		if (!line) continue;

		if (line.startsWith('}')) {
			indentLevel = Math.max(0, indentLevel - 1);
		}

		result.push('\t'.repeat(indentLevel) + line);

		if (line.endsWith('{')) {
			indentLevel++;
		}
	}

	return result.join('\n').replace(/\n\s*\n/g, '\n\n').trim();
};
