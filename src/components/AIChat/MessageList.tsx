import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../hooks/useChatState';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  loadingLabel: string;
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
const MessageListComponent: React.FC<MessageListProps> = ({ messages, isLoading, loadingLabel, endRef }) => (
  <div className="ai-assistant__messages" role="log">
    {messages.map((message) => (
      <div
        key={message.id}
        className={`ai-assistant__message ai-assistant__message--${message.role}`}
        data-message-id={message.id}
      >
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
        <span className="ai-assistant__timestamp">{message.timestamp}</span>
      </div>
    ))}

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

/**
 * Memoised so parent re-renders (e.g. input typing) don't repaint the whole
 * transcript — the markdown parser is the heaviest thing in the chat.
 * Default shallow compare is sufficient: the `messages` array reference only
 * changes when `setMessages` is called.
 */
const MessageList = memo(MessageListComponent);
MessageList.displayName = 'MessageList';

export default MessageList;
