import { describe, expect, it } from 'vitest';
import { renderMarkdown, toggleTask } from './markdown';

describe('renderMarkdown', () => {
	it('renders headings, emphasis, code and rules', () => {
		expect(renderMarkdown('# Title')).toBe('<h1>Title</h1>');
		expect(renderMarkdown('**bold** *it* ~~old~~ `x*y*`')).toBe('<p><strong>bold</strong> <em>it</em> <del>old</del> <code>x*y*</code></p>');
		expect(renderMarkdown('---')).toBe('<hr>');
	});

	it('renders lists, quotes and code blocks', () => {
		expect(renderMarkdown('- a\n- b')).toBe('<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
		expect(renderMarkdown('1. one\n2. two')).toBe('<ol>\n<li>one</li>\n<li>two</li>\n</ol>');
		expect(renderMarkdown('> quoted')).toBe('<blockquote>quoted</blockquote>');
		expect(renderMarkdown('```\n<b>raw</b>\n```')).toBe('<pre><code>&lt;b&gt;raw&lt;/b&gt;</code></pre>');
	});

	it('renders checklists with their source line', () => {
		const html = renderMarkdown('intro\n\n- [ ] todo\n- [x] done');
		expect(html).toContain('<ul class="tasks">');
		expect(html).toContain('data-line="2"');
		expect(html).toContain('<li class="task done"><label><input type="checkbox" data-line="3" checked>');
	});

	it('keeps http(s) and mailto links only', () => {
		expect(renderMarkdown('[site](https://example.com)')).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a>');
		expect(renderMarkdown('[mail](mailto:a@b.c)')).toContain('href="mailto:a@b.c"');
		expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('<a');
		expect(renderMarkdown('[x](data:text/html,hi)')).not.toContain('<a');
	});

	it('escapes HTML everywhere', () => {
		const html = renderMarkdown('<script>alert(1)</script>\n# <img src=x onerror=alert(1)>\n- <b>\n> "quote" & \'apos\'');
		expect(html).not.toMatch(/<script|<img|<b>/);
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('&quot;quote&quot; &amp; &#39;apos&#39;');
	});

	it('does not let a link target break out of its attribute', () => {
		const html = renderMarkdown('[x](https://a.b/"onmouseover="alert(1))');
		expect(html).not.toContain('" onmouseover');
		expect(html).not.toMatch(/href="[^"]*"onmouseover/);
	});

	it('handles empty and CRLF input', () => {
		expect(renderMarkdown('')).toBe('');
		expect(renderMarkdown('a\r\nb')).toBe('<p>a<br>b</p>');
	});
});

describe('toggleTask', () => {
	it('flips one checklist line and nothing else', () => {
		const src = '- [ ] a\n- [x] b\ntext';
		expect(toggleTask(src, 0)).toBe('- [x] a\n- [x] b\ntext');
		expect(toggleTask(src, 1)).toBe('- [ ] a\n- [ ] b\ntext');
		expect(toggleTask(src, 2)).toBe(src);
		expect(toggleTask(src, 9)).toBe(src);
	});
});
