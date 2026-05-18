import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ProductCardInline from './ProductCardInline';
import FollowupChips from './FollowupChips';
import type { ChatMessage } from '../../hooks/useChatState';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  loadingLabel: string;
  /**
   * Localised strings for the product card section:
   *   - `view`, `whatsapp` are CTAs on each card.
   *   - `similarLabel` is the heading shown above the "similar products"
   *     strip that appears whenever a product is flagged `primary: true`.
   *     When no product carries that flag, the message renders a flat
   *     grid and the label is unused.
   */
  productCardLabels: { view: string; whatsapp: string; similarLabel: string };
  /**
   * Active chat language (`ar` / `en` / `tr` / `ru`). Forwarded to each
   * ProductCardInline so its WhatsApp pre-fill matches the language of
   * the conversation.
   */
  lang: string;
  /** Accessible label for the follow-up chip strip (region landmark). */
  followupsLabel: string;
  /** Fires when the visitor taps a follow-up chip below the latest assistant turn. */
  onFollowupPick: (followup: string) => void;
  /** Ref for the sentinel div at the bottom of the list (auto-scroll anchor). */
  endRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Renders the scrollable transcript of chat messages.
 *
 * Pure presentation: takes the message list + a loading flag and renders
 * markdown with per-paragraph direction detection (RTL / LTR based on the
 * first run of characters in each paragraph). Links open in a new tab and
 * are forced to LTR because phone numbers and URLs always read L-to-R even
 * inside an RTL paragraph.
 */
const MessageListComponent: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  loadingLabel,
  productCardLabels,
  lang,
  followupsLabel,
  onFollowupPick,
  endRef,
}) => {
  // The followup chip strip should ONLY appear under the latest
  // assistant message — once the visitor sends a new turn, the old
  // strip is stale (chips were curated for the previous reply's
  // context). We pre-compute the id of the eligible message here so
  // the per-message render below can do a cheap equality check.
  const lastAssistantWithFollowups = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'assistant' && m.followups && m.followups.length > 0 && m.streaming !== true) {
        return m.id;
      }
    }
    return null;
  })();

  return (
  <div className="ai-assistant__messages" role="log">
    {messages.map((message) => {
      const isStreaming = message.streaming === true;
      // While the assistant message is still receiving stream chunks, the
      // content may be empty for a few frames between `start` and the first
      // `chunk`. Showing the pulsing cursor on its own keeps the bubble
      // from looking like an empty placeholder; once tokens arrive the
      // cursor sits at the tail of the text. The cursor is rendered as a
      // sibling of the markdown so it never disrupts the prose flow or
      // the per-paragraph dir detection.
      return (
        <div
          key={message.id}
          className={`ai-assistant__message ai-assistant__message--${message.role}${isStreaming ? ' ai-assistant__message--streaming' : ''}`}
          data-message-id={message.id}
          aria-busy={isStreaming || undefined}
        >
          {message.content.length > 0 && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children, ...props }) => {
                  const text = String(children);
                  const hasArabic = /[\u0600-\u06FF]/.test(text);
                  return (
                    <p
                      {...props}
                      dir={hasArabic ? 'rtl' : 'ltr'}
                      style={{ textAlign: hasArabic ? 'right' : 'left' }}
                    >
                      {children}
                    </p>
                  );
                },
                a: ({ ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#25D366',
                      textDecoration: 'underline',
                      direction: 'ltr',
                      unicodeBidi: 'plaintext',
                    }}
                  />
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
          {isStreaming && (
            <span
              className="ai-assistant__stream-cursor"
              aria-hidden="true"
              aria-label={loadingLabel}
            />
          )}

          {/* Product cards from a search_products tool call. Rendered
              BETWEEN the prose and the timestamp so the visitor sees
              the narrative answer first, then the actionable cards as
              a "where to go next" pointer.
              ──
              Two visual layouts depending on whether the relevance
              scorer flagged a clear "primary" winner:
                1. `primary: true` on one product → render it as a
                   featured card spanning the full bubble width, then
                   a "similar products" label, then the remaining
                   products in a smaller-tier grid. This is the case
                   the visitor reported ("when I ask for regular
                   laundry powder I get every powder type") — we
                   highlight THE answer and demote the alternatives.
                2. No primary flag → render the flat grid as before
                   (broad browse queries like "what products do you
                   have?" where every option is equally valid). */}
          {message.attachments?.products && message.attachments.products.length > 0 && (() => {
            const products = message.attachments.products;
            const primaryIndex = products.findIndex((p) => p.primary === true);
            const hasPrimary = primaryIndex >= 0;
            const primary = hasPrimary ? products[primaryIndex] : null;
            const others = hasPrimary
              ? products.filter((_, i) => i !== primaryIndex)
              : products;

            return (
              <div className="ai-chat-product-card-group">
                {primary && (
                  <div
                    className="ai-chat-product-card-group__primary"
                    role="region"
                    aria-label={primary.name}
                  >
                    <ProductCardInline
                      product={primary}
                      viewLabel={productCardLabels.view}
                      whatsappLabel={productCardLabels.whatsapp}
                      lang={lang}
                    />
                  </div>
                )}
                {others.length > 0 && (
                  <>
                    {hasPrimary && (
                      <p className="ai-chat-product-card-group__similar-label">
                        {productCardLabels.similarLabel}
                      </p>
                    )}
                    <div
                      className={
                        hasPrimary
                          ? 'ai-chat-product-card-grid ai-chat-product-card-grid--similar'
                          : 'ai-chat-product-card-grid'
                      }
                      role="list"
                      aria-label={`${others.length} products`}
                    >
                      {others.map((p) => (
                        <div role="listitem" key={p.id}>
                          <ProductCardInline
                            product={p}
                            viewLabel={productCardLabels.view}
                            whatsappLabel={productCardLabels.whatsapp}
                            lang={lang}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Follow-up chips: rendered ONLY beneath the latest finished
              assistant message (see `lastAssistantWithFollowups` lookup
              above) so the strip never appears under an older,
              context-stale turn. The chip set arrives in the SSE 'done'
              event and is attached to the message in useChatState. */}
          {message.id === lastAssistantWithFollowups && message.followups && (
            <FollowupChips
              followups={message.followups}
              ariaLabel={followupsLabel}
              onPick={onFollowupPick}
            />
          )}

          {!isStreaming && (
            <span className="ai-assistant__timestamp">{message.timestamp}</span>
          )}
        </div>
      );
    })}

    {isLoading && (
      <div className="ai-assistant__message ai-assistant__message--assistant">
        <div className="ai-assistant__dots" aria-label={loadingLabel}>
          <span className="dot">.</span>
          <span className="dot">.</span>
          <span className="dot">.</span>
        </div>
      </div>
    )}

    <div ref={endRef} />
  </div>
  );
};

/**
 * Memoised so parent re-renders (e.g. input typing) don't repaint the whole
 * transcript — the markdown parser is the heaviest thing in the chat.
 * Default shallow compare is sufficient: the `messages` array reference only
 * changes when `setMessages` is called.
 */
const MessageList = memo(MessageListComponent);
MessageList.displayName = 'MessageList';

export default MessageList;
