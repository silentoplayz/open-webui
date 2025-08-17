// Helper function to find matching closing tag
function findMatchingClosingTag(src: string, openTag: string, closeTag: string): number {
	let depth = 1;
	let index = openTag.length;
	while (depth > 0 && index < src.length) {
		if (src.startsWith(openTag, index)) {
			depth++;
		} else if (src.startsWith(closeTag, index)) {
			depth--;
		}
		if (depth > 0) {
			index++;
		}
	}
	return depth === 0 ? index + closeTag.length : -1;
}

// Function to parse attributes from tag
function parseAttributes(tag: string): { [key: string]: string } {
	const attributes: { [key: string]: string } = {};
	const attrRegex = /(\w+)="(.*?)"/g;
	let match;
	while ((match = attrRegex.exec(tag)) !== null) {
		attributes[match[1]] = match[2];
	}
	return attributes;
}

function detailsTokenizer(src: string) {
	// Updated regex to capture attributes inside <details>
	const detailsRegex = /^<details(\s+[^>]*)?>\n/;
	const summaryRegex = /^<summary>(.*?)<\/summary>\n/;

	const detailsMatch = detailsRegex.exec(src);
	if (detailsMatch) {
		const endIndex = findMatchingClosingTag(src, '<details', '</details>');
		if (endIndex === -1) return;

		const fullMatch = src.slice(0, endIndex);
		const detailsTag = detailsMatch[0];
		const attributes = parseAttributes(detailsTag); // Parse attributes from <details>

		let content = fullMatch.slice(detailsTag.length, -10).trim(); // Remove <details> and </details>
		let summary = '';

		const summaryMatch = summaryRegex.exec(content);
		if (summaryMatch) {
			summary = summaryMatch[1].trim();
			content = content.slice(summaryMatch[0].length).trim();
		}

		return {
			type: 'details',
			raw: fullMatch,
			summary: summary,
			text: content,
			attributes: attributes // Include extracted attributes from <details>
		};
	}
}

function detailsStart(src: string) {
	return src.match(/^<details>/) ? 0 : -1;
}

function detailsRenderer(token: any) {
	const attributesString = token.attributes
		? Object.entries(token.attributes)
				.map(([key, value]) => `${key}="${value}"`)
				.join(' ')
		: '';

	return `<details ${attributesString}>
  ${token.summary ? `<summary>${token.summary}</summary>` : ''}
  ${token.text}
  </details>`;
}

// Extension wrapper function
function detailsExtension() {
	return {
		name: 'details',
		level: 'block',
		start: detailsStart,
		tokenizer: detailsTokenizer,
		renderer: detailsRenderer
	};
}

function definitionListTokenizer(src: string) {
    const rule = /^(?:[^\n]+\n)(?::[^\n]*(?:\n|$))+/;
    const match = rule.exec(src);
    if (match) {
        const token = {
            type: 'definitionList',
            raw: match[0],
            text: match[0].trim(),
            tokens: []
        };
        this.lexer.inline(token.text, token.tokens);
        return token;
    }
}

function definitionListRenderer(token: any) {
    let html = '<dl>';
    const lines = token.raw.split('\n');
    let inDd = false;
    for (const line of lines) {
        if (line.startsWith(':')) {
            if (!inDd) {
                html += '<dd>';
                inDd = true;
            }
            html += this.parser.parseInline(line.substring(1).trim());
        } else {
            if (inDd) {
                html += '</dd>';
                inDd = false;
            }
            html += `<dt>${this.parser.parseInline(line.trim())}</dt>`;
        }
    }
    if (inDd) {
        html += '</dd>';
    }
    html += '</dl>';
    return html;
}

function definitionListExtension() {
    return {
        name: 'definitionList',
        level: 'block',
        start(src) { return src.indexOf('\n:'); },
        tokenizer: definitionListTokenizer,
        renderer: definitionListRenderer
    };
}

function abbreviationsTokenizer(src: string) {
    const rule = /^\*\[(.+?)\]:\s*(.+)$/;
    const match = rule.exec(src);
    if (match) {
        return {
            type: 'abbreviations',
            raw: match[0],
            abbr: match[1],
            definition: match[2]
        };
    }
}

function abbreviationsRenderer(token: any) {
    if (!this.parser.options.abbreviations) {
        this.parser.options.abbreviations = {};
    }
    this.parser.options.abbreviations[token.abbr] = token.definition;
    return '';
}

function inlineAbbreviationsTokenizer(src: string) {
    if (!this.parser.options.abbreviations) {
        return;
    }
    const rule = new RegExp('^(' + Object.keys(this.parser.options.abbreviations).join('|') + ')');
    const match = rule.exec(src);
    if (match) {
        return {
            type: 'inlineAbbreviations',
            raw: match[0],
            text: match[1]
        };
    }
}

function inlineAbbreviationsRenderer(token: any) {
    if (!this.parser.options.abbreviations) {
        return token.text;
    }
    const definition = this.parser.options.abbreviations[token.text];
    return `<abbr title="${definition}">${token.text}</abbr>`;
}

function abbreviationsExtension() {
    return {
        name: 'abbreviations',
        level: 'block',
        start(src) { return src.indexOf('*['); },
        tokenizer: abbreviationsTokenizer,
        renderer: abbreviationsRenderer
    };
}

function inlineAbbreviationsExtension() {
    return {
        name: 'inlineAbbreviations',
        level: 'inline',
        start(src) {
            if (!this.parser.options.abbreviations) {
                return -1;
            }
            const keys = Object.keys(this.parser.options.abbreviations);
            if (keys.length === 0) {
                return -1;
            }
            const rule = new RegExp('^(' + keys.join('|') + ')');
            const match = rule.exec(src);
            return match ? match.index : -1;
        },
        tokenizer: inlineAbbreviationsTokenizer,
        renderer: inlineAbbreviationsRenderer
    };
}

export default function (options = {}) {
	return {
		extensions: [detailsExtension(options), definitionListExtension(), abbreviationsExtension(), inlineAbbreviationsExtension()]
	};
}
