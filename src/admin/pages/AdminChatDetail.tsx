import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { adminApi } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDateTime } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { AdminIcon, Alert, Button, Card, EmptyState, LangTag, Loading, PageHeader } from '../ui';

const messages = defineMessages({
  en: {
    backToChats: 'Chat history',
    messageCount: { other: '{n} messages' },
    seen: 'First seen {first} · Last active {last}',
    deleteConversation: 'Delete conversation',
    conversation: 'Conversation',
    noMessages: 'No messages found.',
    assistant: 'Assistant',
    visitor: 'Visitor',
    confirmDelete: { other: 'Delete this visitor\'s whole conversation ({n} messages)? This cannot be undone.' },
    deleteFailed: 'Failed to delete the conversation',
  },
  ar: {
    backToChats: 'سجل المحادثات',
    messageCount: {
      zero: 'لا رسائل',
      one: 'رسالة واحدة',
      two: 'رسالتان',
      few: '{n} رسائل',
      many: '{n} رسالة',
      other: '{n} رسالة',
    },
    seen: 'أول ظهور {first} · آخر نشاط {last}',
    deleteConversation: 'حذف المحادثة',
    conversation: 'المحادثة',
    noMessages: 'لا توجد رسائل.',
    assistant: 'المساعد',
    visitor: 'الزائر',
    confirmDelete: {
      zero: 'حذف محادثة هذا الزائر بالكامل (لا رسائل)؟ لا يمكن التراجع عن ذلك.',
      one: 'حذف محادثة هذا الزائر بالكامل (رسالة واحدة)؟ لا يمكن التراجع عن ذلك.',
      two: 'حذف محادثة هذا الزائر بالكامل (رسالتان)؟ لا يمكن التراجع عن ذلك.',
      few: 'حذف محادثة هذا الزائر بالكامل ({n} رسائل)؟ لا يمكن التراجع عن ذلك.',
      many: 'حذف محادثة هذا الزائر بالكامل ({n} رسالة)؟ لا يمكن التراجع عن ذلك.',
      other: 'حذف محادثة هذا الزائر بالكامل ({n} رسالة)؟ لا يمكن التراجع عن ذلك.',
    },
    deleteFailed: 'تعذّر حذف المحادثة',
  },
});

// Assistant replies are Markdown (the visitor's widget renders them), so the
// admin showed raw "**KARAHOCA**" and "[+90…](https://wa.me/…)". Rendered
// without rehype-raw: any HTML in a message stays inert text, and
// react-markdown's default URL filter drops javascript: links.
const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

export const AdminChatDetail: React.FC = () => {
  // useParams already decodes; decoding again threw "URI malformed" for an
  // id containing "%" (ids are client-supplied).
  const { userId = '' } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState('');
  const t = useT(messages);
  const tc = useT(common);

  const { data, loading, error } = useAsync(
    () => adminApi.getChatUser(userId),
    [userId]
  );

  const handleDelete = async () => {
    if (!confirm(t.plural('confirmDelete', data?.messages.length ?? 0))) return;
    setDeleteError('');
    try {
      await adminApi.deleteChatUser(userId);
      navigate('/admin/chats');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('deleteFailed'));
    }
  };

  const back = { to: '/admin/chats', label: t('backToChats') };
  // The visitor id is the page title: monospace, read left to right.
  const idTitle = (id: string) => <span className="adm-chat-title"><bdi dir="ltr">{id}</bdi></span>;

  if (loading) return <Loading label={tc('loading')} />;
  if (error) {
    return (
      <div>
        <PageHeader title={idTitle(userId)} back={back} />
        <Alert tone="danger">{error}</Alert>
      </div>
    );
  }

  const user = data?.user;
  const chatMessages = data?.messages ?? [];

  return (
    <div>
      <PageHeader
        title={idTitle(user?.id ?? userId)}
        back={back}
        meta={user?.language ? <LangTag lang={user.language} /> : undefined}
        subtitle={<>{t.plural('messageCount', chatMessages.length)} · {t('seen', { first: fmtDateTime(user?.first_seen), last: fmtDateTime(user?.last_seen) })}</>}
        actions={<Button variant="danger" icon="trash" onClick={handleDelete}>{t('deleteConversation')}</Button>}
      />

      {deleteError && <Alert tone="danger">{deleteError}</Alert>}

      <Card flush title={t('conversation')} icon="chats" subtitle={t.plural('messageCount', chatMessages.length)}>
        <div className="adm-chat-thread adm-chat-thread-page">
          {chatMessages.length === 0 ? (
            <EmptyState icon="chats" title={t('noMessages')} compact />
          ) : chatMessages.map(msg => (
            <div
              key={msg.id}
              className={`adm-chat-row adm-chat-row-${msg.role}`}
            >
              <div className={`adm-chat-bubble adm-chat-${msg.role}`}>
                <div className="adm-chat-meta">
                  <AdminIcon name={msg.role === 'assistant' ? 'bot' : 'user'} size="xs" />
                  <strong>{msg.role === 'assistant' ? t('assistant') : t('visitor')}</strong>
                  {msg.language && <LangTag lang={msg.language} />}
                  <span>{fmtDateTime(msg.created_at)}</span>
                </div>
                {/* dir="auto": Arabic messages in this left-to-right page put
                    their punctuation and Latin brand names on the wrong side. */}
                <div className="adm-chat-content" dir="auto">
                  {msg.role === 'assistant' ? (
                    <div className="adm-chat-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
