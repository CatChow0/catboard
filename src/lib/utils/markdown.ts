// Minimal Markdown renderer for the Notes widget, with no dependency.
// Safety model: every line is HTML-escaped FIRST; the renderer then only adds
// its own tags. Link targets are limited to http(s) and mailto, so the output
// can be given to {@html} without letting user text inject markup or scripts.
//
// Supported: # headings, **bold**, *italic* / _italic_, ~~strike~~, `code`,
// ``` code blocks ```, [links](https://…), - / * / + lists, 1. lists,
// - [ ] / - [x] checklists (clickable, see toggleTask), > quotes, --- rules.

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function inline(escaped: string): string {
	// Code spans first, kept out of the other rules via placeholders.
	const codes: string[] = [];
	let s = escaped.replace(/`([^`]+)`/g, (_, c) => {
		codes.push(`<code>${c}</code>`);
		return `\u0000${codes.length - 1}\u0000`;
	});
	s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) =>
		SAFE_URL.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>` : m
	);
	s = s
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/__([^_]+)__/g, '<strong>$1</strong>')
		.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
		.replace(/(^|[^\w_])_([^_\s][^_]*)_(?=[^\w]|$)/g, '$1<em>$2</em>')
		.replace(/~~([^~]+)~~/g, '<del>$1</del>');
	return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

export function renderMarkdown(src: string): string {
	const lines = (src || '').replace(/\r\n?/g, '\n').split('\n');
	const out: string[] = [];
	let list: 'ul' | 'ol' | null = null;
	let para: string[] = [];
	let quote: string[] = [];

	const flushPara = () => {
		if (para.length) out.push(`<p>${para.join('<br>')}</p>`);
		para = [];
	};
	const flushList = () => {
		if (list) out.push(`</${list}>`);
		list = null;
	};
	const flushQuote = () => {
		if (quote.length) out.push(`<blockquote>${quote.join('<br>')}</blockquote>`);
		quote = [];
	};
	const flushAll = () => {
		flushPara();
		flushList();
		flushQuote();
	};
	const openList = (kind: 'ul' | 'ol', cls = '') => {
		if (list !== kind) {
			flushList();
			out.push(`<${kind}${cls}>`);
			list = kind;
		}
	};

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];

		if (/^\s*```/.test(raw)) {
			flushAll();
			const code: string[] = [];
			while (++i < lines.length && !/^\s*```/.test(lines[i])) code.push(escapeHtml(lines[i]));
			out.push(`<pre><code>${code.join('\n')}</code></pre>`);
			continue;
		}
		if (!raw.trim()) {
			flushAll();
			continue;
		}
		const line = escapeHtml(raw);
		let m: RegExpMatchArray | null;

		if ((m = raw.match(/^(#{1,6})\s+(.*)$/))) {
			flushAll();
			const level = m[1].length;
			out.push(`<h${level}>${inline(escapeHtml(m[2]))}</h${level}>`);
		} else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(raw)) {
			flushAll();
			out.push('<hr>');
		} else if ((m = raw.match(TASK))) {
			flushPara();
			flushQuote();
			openList('ul', ' class="tasks"');
			const done = m[1].toLowerCase() === 'x';
			out.push(`<li class="task${done ? ' done' : ''}"><label><input type="checkbox" data-line="${i}"${done ? ' checked' : ''}> <span>${inline(escapeHtml(m[2]))}</span></label></li>`);
		} else if ((m = raw.match(BULLET))) {
			flushPara();
			flushQuote();
			openList('ul');
			out.push(`<li>${inline(escapeHtml(m[1]))}</li>`);
		} else if ((m = raw.match(ORDERED))) {
			flushPara();
			flushQuote();
			openList('ol');
			out.push(`<li>${inline(escapeHtml(m[1]))}</li>`);
		} else if (raw.trimStart().startsWith('>')) {
			flushPara();
			flushList();
			quote.push(inline(escapeHtml(raw.trimStart().replace(/^>\s?/, ''))));
		} else {
			flushList();
			flushQuote();
			para.push(inline(line));
		}
	}
	flushAll();
	return out.join('\n');
}

/** Flips the checklist box on source line `line` ("- [ ]" <-> "- [x]"). */
export function toggleTask(src: string, line: number): string {
	const lines = (src || '').replace(/\r\n?/g, '\n').split('\n');
	const m = lines[line]?.match(/^(\s*[-*+]\s+\[)([ xX])(\].*)$/);
	if (!m) return src;
	lines[line] = m[1] + (m[2] === ' ' ? 'x' : ' ') + m[3];
	return lines.join('\n');
}
