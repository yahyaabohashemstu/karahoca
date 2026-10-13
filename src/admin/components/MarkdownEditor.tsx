import React, { useCallback, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { IconButton, Tabs, type IconName } from '../ui';

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
 *   - Toolbar with the most-common formatting actions (bold, italic,
 *     H1–H3, lists, quote, link, image, code). Each inserts the right
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

const messages = defineMessages({
  en: {
    bold: 'Bold (Ctrl+B)',
    italic: 'Italic (Ctrl+I)',
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
    ul: 'Bullet list',
    ol: 'Numbered list',
    quote: 'Blockquote',
    link: 'Link (Ctrl+K)',
    image: 'Image',
    code: 'Inline code',
    formatting: 'Formatting',
    view: 'Editor view',
    preview: 'Preview',
    placeholder: 'Write in markdown — **bold**, *italic*, # heading, - list, [link](url)…',
    emptyPreview: 'Nothing to preview yet — switch back to Edit and write something.',
  },
  ar: {
    bold: 'غامق (Ctrl+B)',
    italic: 'مائل (Ctrl+I)',
    h1: 'عنوان 1',
    h2: 'عنوان 2',
    h3: 'عنوان 3',
    ul: 'قائمة نقطية',
    ol: 'قائمة مرقّمة',
    quote: 'اقتباس',
    link: 'رابط (Ctrl+K)',
    image: 'صورة',
    code: 'شيفرة ضمن السطر',
    formatting: 'التنسيق',
    view: 'طريقة العرض',
    preview: 'معاينة',
    placeholder: 'اكتب بصيغة Markdown — **غامق**، *مائل*، # عنوان، - قائمة، [رابط](url)…',
    emptyPreview: 'لا يوجد ما يُعاين بعد — عُد إلى «تعديل» واكتب شيئًا.',
  },
});

interface Props {
  value: string;
  onChange: (next: string) => void;
  dir?: 'ltr' | 'rtl';
  rows?: number;
  placeholder?: string;
  /** Given to the textarea, so a <Field> label points at it. */
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

type ToolbarAction =
  | 'bold' | 'italic' | 'h1' | 'h2' | 'h3'
  | 'ul' | 'ol' | 'quote' | 'link' | 'image' | 'code';

// Each button shows an icon, or the text glyph writers know (B, I, H1…).
// Its name (title / aria-label) is the message keyed by its action.
type ToolbarButton =
  | { action: ToolbarAction; icon: IconName }
  | { action: ToolbarAction; glyph: React.ReactNode };

const TOOLBAR: ToolbarButton[] = [
  { action: 'bold',   glyph: <strong>B</strong> },
  { action: 'italic', glyph: <em>I</em> },
  { action: 'h1',     glyph: 'H1' },
  { action: 'h2',     glyph: 'H2' },
  { action: 'h3',     glyph: 'H3' },
  { action: 'ul',     icon: 'list' },
  { action: 'ol',     icon: 'listOrdered' },
  { action: 'quote',  icon: 'quote' },
  { action: 'link',   icon: 'link' },
  { action: 'image',  icon: 'image' },
  { action: 'code',   icon: 'code' },
];

/**
 * Helper: given the current value + selection range + an action,
 * return the new value + new selection range. Pure function so
 * it's trivial to unit-test (no DOM dependency at all).
 */
const applyMarkdownAction = (
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
  value, onChange, dir = 'ltr', rows = 12, placeholder, id,
  'aria-describedby': describedBy, 'aria-invalid': invalid,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const t = useT(messages);
  const tc = useT(common);

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
    <div className="adm-markdown-editor">
      <div className="adm-markdown-bar">
        <div role="toolbar" aria-label={t('formatting')} className="adm-markdown-tools">
          {TOOLBAR.map((b) => ('icon' in b ? (
            <IconButton
              key={b.action}
              icon={b.icon}
              label={t(b.action)}
              size="sm"
              onClick={() => applyAction(b.action)}
              disabled={mode === 'preview'}
            />
          ) : (
            // A text glyph in the same square button as the icons.
            <button
              key={b.action}
              type="button"
              className="adm-icon-btn adm-icon-btn-default adm-icon-btn-sm"
              title={t(b.action)}
              aria-label={t(b.action)}
              onClick={() => applyAction(b.action)}
              disabled={mode === 'preview'}
            >
              {b.glyph}
            </button>
          )))}
        </div>
        <div className="adm-markdown-mode">
          <Tabs
            variant="segmented"
            size="sm"
            ariaLabel={t('view')}
            value={mode}
            onChange={setMode}
            items={[
              { value: 'edit', label: tc('edit'), icon: 'edit' },
              { value: 'preview', label: t('preview'), icon: 'eye' },
            ]}
          />
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="adm-textarea adm-markdown-source"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          dir={dir}
          rows={rows}
          placeholder={placeholder ?? t('placeholder')}
        />
      ) : (
        // The same box as the textarea, so switching to the preview
        // doesn't move the page.
        <div dir={dir} className="adm-textarea adm-markdown-preview">
          {value.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Match the public NewsArticlePage's heading hierarchy:
                // the page already provides an <h1>, so our H1 maps to
                // <h2> visually but keeps the markdown source clean.
                // Look of headings, links, quotes and code: .adm-markdown-preview in admin.css.
                h1: ({ node, ...rest }) => <h2 {...rest} />,
                h2: ({ node, ...rest }) => <h3 {...rest} />,
                h3: ({ node, ...rest }) => <h4 {...rest} />,
                a: ({ node, href, ...rest }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" {...rest} />
                ),
                // react-markdown v10 dropped the `inline` flag from
                // the code renderer — block code blocks now carry a
                // `language-*` className (set by the parser), inline
                // code does not. Detecting via className keeps us
                // type-safe against the v10 signature.
                code: ({ className, children, ...rest }) => {
                  const isBlock = /language-/.test(className || '');
                  return isBlock
                    ? <pre><code className={className} {...rest}>{children}</code></pre>
                    : <code className={className} {...rest}>{children}</code>;
                },
              }}
            >
              {value}
            </ReactMarkdown>
          ) : (
            <p className="adm-markdown-empty">{t('emptyPreview')}</p>
          )}
        </div>
      )}
    </div>
  );
};
