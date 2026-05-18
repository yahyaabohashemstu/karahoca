import React, { useCallback, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Lightweight markdown editor for the blog body field (Phase F).
 *
 * Rationale for not using Tiptap:
 *   - Tiptap + StarterKit + react bindings adds ~150 KB gzipped.
 *   - The blog body's existing render path (NewsArticlePage) is already
 *     a string-array; switching to markdown is a one-line change there.
 *   - react-markdown + remark-gfm are ALREADY in the bundle (used by
 *     the AI chat) — reusing them costs zero bytes.
 *
 * UX:
 *   - Toolbar with the 8 most-common formatting actions (bold, italic,
 *     H1/H2, list, quote, link, image). Each inserts the right
 *     markdown syntax at the cursor — selected text is wrapped.
 *   - "Preview" tab renders the live markdown via react-markdown so
 *     the admin sees exactly what visitors will see, headings and
 *     lists and all.
 *   - The component is dir-aware (Arabic textarea + Arabic preview
 *     both flip RTL) so the layout reads naturally for Arabic copy.
 *
 * Backward compat with the existing schema:
 *   - The value PROP and onChange CB exchange a plain markdown string.
 *   - The body-as-string-array shape lives in AdminNewsEdit's
 *     getBodyText/setBodyText helpers — those collapse to a single
 *     element wrapping the full markdown.
 */

interface Props {
  value: string;
  onChange: (next: string) => void;
  dir?: 'ltr' | 'rtl';
  rows?: number;
  placeholder?: string;
}

type ToolbarAction =
  | 'bold' | 'italic' | 'h1' | 'h2' | 'h3'
  | 'ul' | 'ol' | 'quote' | 'link' | 'image' | 'code';

interface ToolbarButton {
  action: ToolbarAction;
  label: string;
  title: string;
}

const TOOLBAR: ToolbarButton[] = [
  { action: 'bold',   label: 'B',  title: 'Bold (Ctrl+B)' },
  { action: 'italic', label: 'I',  title: 'Italic (Ctrl+I)' },
  { action: 'h1',     label: 'H1', title: 'Heading 1' },
  { action: 'h2',     label: 'H2', title: 'Heading 2' },
  { action: 'h3',     label: 'H3', title: 'Heading 3' },
  { action: 'ul',     label: '•',  title: 'Bullet list' },
  { action: 'ol',     label: '1.', title: 'Numbered list' },
  { action: 'quote',  label: '❝', title: 'Blockquote' },
  { action: 'link',   label: '🔗', title: 'Link (Ctrl+K)' },
  { action: 'image',  label: '🖼', title: 'Image' },
  { action: 'code',   label: '⟨⟩', title: 'Inline code' },
];

/**
 * Helper: given the current value + selection range + an action,
 * return the new value + new selection range. Pure function so
 * it's trivial to unit-test (no DOM dependency at all).
 */
export const applyMarkdownAction = (
  value: string,
  start: number,
  end: number,
  action: ToolbarAction,
): { next: string; selStart: number; selEnd: number } => {
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  // Block-level actions operate on the WHOLE line(s) containing the
  // selection. We expand the range outward to the nearest line breaks
  // first, then apply.
  const isBlock = ['h1', 'h2', 'h3', 'ul', 'ol', 'quote'].includes(action);
  if (isBlock) {
    let lineStart = start;
    while (lineStart > 0 && value[lineStart - 1] !== '\n') lineStart -= 1;
    let lineEnd = end;
    while (lineEnd < value.length && value[lineEnd] !== '\n') lineEnd += 1;
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const prefixed = lines.map((line, i) => {
      switch (action) {
        case 'h1':    return `# ${line.replace(/^#+\s*/, '')}`;
        case 'h2':    return `## ${line.replace(/^#+\s*/, '')}`;
        case 'h3':    return `### ${line.replace(/^#+\s*/, '')}`;
        case 'ul':    return `- ${line.replace(/^[-*]\s*/, '')}`;
        case 'ol':    return `${i + 1}. ${line.replace(/^\d+\.\s*/, '')}`;
        case 'quote': return `> ${line.replace(/^>\s*/, '')}`;
        default:      return line;
      }
    }).join('\n');
    const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
    return { next, selStart: lineStart, selEnd: lineStart + prefixed.length };
  }

  // Inline actions — wrap the selection or insert a placeholder if
  // nothing's selected.
  let wrapped: string;
  let cursorOffset = 0; // where to place caret inside the inserted text
  switch (action) {
    case 'bold':
      wrapped = selected ? `**${selected}**` : `**bold**`;
      cursorOffset = selected ? wrapped.length : 2 + 4; // after "bold"
      break;
    case 'italic':
      wrapped = selected ? `*${selected}*` : `*italic*`;
      cursorOffset = selected ? wrapped.length : 1 + 6;
      break;
    case 'code':
      wrapped = selected ? `\`${selected}\`` : `\`code\``;
      cursorOffset = selected ? wrapped.length : 1 + 4;
      break;
    case 'link':
      wrapped = selected ? `[${selected}](https://)` : `[link text](https://)`;
      cursorOffset = wrapped.length - 1; // place caret right before the closing paren
      break;
    case 'image':
      wrapped = selected ? `![${selected}](https://)` : `![alt text](https://)`;
      cursorOffset = wrapped.length - 1;
      break;
    default:
      wrapped = selected;
      cursorOffset = wrapped.length;
  }
  const next = before + wrapped + after;
  return { next, selStart: start, selEnd: start + cursorOffset };
};

export const MarkdownEditor: React.FC<Props> = ({
  value, onChange, dir = 'ltr', rows = 12, placeholder,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const applyAction = useCallback((action: ToolbarAction) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { next, selStart, selEnd } = applyMarkdownAction(
      value,
      ta.selectionStart,
      ta.selectionEnd,
      action,
    );
    onChange(next);
    // Restore the cursor on the next tick (after React re-renders).
    requestAnimationFrame(() => {
      ta.focus();
      try { ta.setSelectionRange(selStart, selEnd); } catch { /* */ }
    });
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Familiar shortcuts: Ctrl/Cmd-B = bold, Ctrl/Cmd-I = italic,
    // Ctrl/Cmd-K = link. Three keystrokes get an admin most of the
    // way through any product blog post.
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      if (e.key === 'b') { e.preventDefault(); applyAction('bold'); }
      if (e.key === 'i') { e.preventDefault(); applyAction('italic'); }
      if (e.key === 'k') { e.preventDefault(); applyAction('link'); }
    }
  };

  return (
    <div className="adm-markdown-editor" style={{ border: '1px solid var(--adm-border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: 6,
        background: 'var(--adm-surface2)',
        borderBottom: '1px solid var(--adm-border)',
        flexWrap: 'wrap',
      }}>
        {TOOLBAR.map((b) => (
          <button
            key={b.action}
            type="button"
            title={b.title}
            onClick={() => applyAction(b.action)}
            disabled={mode === 'preview'}
            style={{
              border: '1px solid var(--adm-border)',
              background: 'transparent',
              color: 'inherit',
              fontWeight: 600,
              fontSize: 13,
              padding: '2px 8px',
              borderRadius: 4,
              cursor: mode === 'preview' ? 'not-allowed' : 'pointer',
              minWidth: 28,
            }}
          >
            {b.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button
            type="button"
            className={`adm-btn adm-btn-sm ${mode === 'edit' ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
            onClick={() => setMode('edit')}
          >
            ✏️ Edit
          </button>
          <button
            type="button"
            className={`adm-btn adm-btn-sm ${mode === 'preview' ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
            onClick={() => setMode('preview')}
          >
            👁 Preview
          </button>
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          dir={dir}
          rows={rows}
          placeholder={placeholder ?? 'Write in markdown — **bold**, *italic*, # heading, - list, [link](url)…'}
          style={{
            width: '100%',
            border: 0,
            outline: 'none',
            padding: 12,
            fontFamily: 'ui-monospace, "JetBrains Mono", "Fira Code", monospace',
            fontSize: 13,
            lineHeight: 1.55,
            resize: 'vertical',
            minHeight: 200,
            background: 'var(--adm-surface)',
            color: 'inherit',
          }}
        />
      ) : (
        <div
          dir={dir}
          className="adm-markdown-preview"
          style={{
            padding: '16px 18px',
            minHeight: 220,
            fontSize: 15,
            lineHeight: 1.7,
            background: 'var(--adm-surface)',
          }}
        >
          {value.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Match the public NewsArticlePage's heading hierarchy:
                // the page already provides an <h1>, so our H1 maps to
                // <h2> visually but keeps the markdown source clean.
                h1: ({ node, ...rest }) => <h2 {...rest} style={{ fontSize: 22, fontWeight: 700, marginTop: 24, marginBottom: 10 }} />,
                h2: ({ node, ...rest }) => <h3 {...rest} style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8 }} />,
                h3: ({ node, ...rest }) => <h4 {...rest} style={{ fontSize: 16, fontWeight: 600, marginTop: 16, marginBottom: 6 }} />,
                a: ({ node, href, ...rest }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#4f6ef7', textDecoration: 'underline' }} {...rest} />
                ),
                blockquote: ({ node, ...rest }) => (
                  <blockquote
                    {...rest}
                    style={{
                      borderLeft: dir === 'rtl' ? 0 : '4px solid #4f6ef7',
                      borderRight: dir === 'rtl' ? '4px solid #4f6ef7' : 0,
                      paddingLeft: dir === 'rtl' ? 0 : 14,
                      paddingRight: dir === 'rtl' ? 14 : 0,
                      margin: '12px 0',
                      color: 'var(--adm-text-muted)',
                    }}
                  />
                ),
                // react-markdown v10 dropped the `inline` flag from
                // the code renderer — block code blocks now carry a
                // `language-*` className (set by the parser), inline
                // code does not. Detecting via className keeps us
                // type-safe against the v10 signature.
                code: ({ className, children, ...rest }) => {
                  const isBlock = /language-/.test(className || '');
                  return isBlock
                    ? <pre style={{ background: 'rgba(127,127,127,0.1)', padding: 12, borderRadius: 6, overflow: 'auto' }}><code className={className} {...rest}>{children}</code></pre>
                    : <code className={className} style={{ background: 'rgba(127,127,127,0.15)', padding: '1px 5px', borderRadius: 3, fontSize: 13 }} {...rest}>{children}</code>;
                },
              }}
            >
              {value}
            </ReactMarkdown>
          ) : (
            <em style={{ color: 'var(--adm-text-dim)' }}>Nothing to preview yet — switch back to Edit and write something.</em>
          )}
        </div>
      )}
    </div>
  );
};
