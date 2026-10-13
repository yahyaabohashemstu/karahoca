import React, { useEffect, useState } from 'react';
import { adminApi, type ChatUser } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { Alert, Button, Card, EmptyState, IconButton, LangTag, Loading, PageHeader, Tabs, Toolbar, type TabItem } from '../ui';

const CHAT_LANGS = ['ar', 'en', 'tr', 'ru'] as const;

const messages = defineMessages({
  en: {
    title: 'Chat history',
    subtitle: 'All users who interacted with the AI assistant',
    filterByLanguage: 'Language',
    total: { other: 'Total: {n} users' },
    colUserId: 'User ID',
    colLanguage: 'Language',
    colMessages: 'Messages',
    colFirstSeen: 'First seen',
    colLastActive: 'Last active',
    colLastMessage: 'Last message',
    noUsers: 'No conversations yet.',
    noUsersLang: 'No conversations in this language.',
    deleteConversation: 'Delete conversation',
    viewConversation: 'View conversation',
    confirmDelete: { other: 'Delete this visitor\'s conversation ({n} messages)? This cannot be undone.' },
    deleteFailed: 'Failed to delete the conversation',
  },
  ar: {
    title: 'سجل المحادثات',
    subtitle: 'كل الزوار الذين تحدّثوا مع المساعد',
    filterByLanguage: 'اللغة',
    total: {
      zero: 'الإجمالي: لا زوار',
      one: 'الإجمالي: زائر واحد',
      two: 'الإجمالي: زائران',
      few: 'الإجمالي: {n} زوار',
      many: 'الإجمالي: {n} زائرًا',
      other: 'الإجمالي: {n} زائر',
    },
    colUserId: 'معرّف الزائر',
    colLanguage: 'اللغة',
    colMessages: 'الرسائل',
    colFirstSeen: 'أول ظهور',
    colLastActive: 'آخر نشاط',
    colLastMessage: 'آخر رسالة',
    noUsers: 'لا توجد محادثات بعد.',
    noUsersLang: 'لا توجد محادثات بهذه اللغة.',
    deleteConversation: 'حذف المحادثة',
    viewConversation: 'عرض المحادثة',
    confirmDelete: {
      zero: 'حذف محادثة هذا الزائر (لا رسائل)؟ لا يمكن التراجع عن ذلك.',
      one: 'حذف محادثة هذا الزائر (رسالة واحدة)؟ لا يمكن التراجع عن ذلك.',
      two: 'حذف محادثة هذا الزائر (رسالتان)؟ لا يمكن التراجع عن ذلك.',
      few: 'حذف محادثة هذا الزائر ({n} رسائل)؟ لا يمكن التراجع عن ذلك.',
      many: 'حذف محادثة هذا الزائر ({n} رسالة)؟ لا يمكن التراجع عن ذلك.',
      other: 'حذف محادثة هذا الزائر ({n} رسالة)؟ لا يمكن التراجع عن ذلك.',
    },
    deleteFailed: 'تعذّر حذف المحادثة',
  },
});

export const AdminChats: React.FC = () => {
  const t = useT(messages);
  const tc = useT(common);
  const [page, setPage] = useState(1);
  const [lang, setLang] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const { data, loading, error, reload } = useAsync(
    () => adminApi.getChats({ page, lang: lang || undefined }),
    [page, lang]
  );

  // Deleting the only row of the last page left "No users found." with the
  // pager gone (total now fits one page) and no way back.
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  useEffect(() => {
    if (data && page > lastPage) setPage(lastPage);
  }, [data, page, lastPage]);

  const handleDelete = async (user: ChatUser) => {
    if (!confirm(t.plural('confirmDelete', user.message_count))) return;
    setDeleting(user.id);
    setActionError('');
    try {
      await adminApi.deleteChatUser(user.id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('deleteFailed'));
    } finally {
      setDeleting(null);
    }
  };

  const langItems: TabItem<string>[] = [
    { value: '', label: tc('all') },
    ...CHAT_LANGS.map((l) => ({ value: l, label: <><LangTag lang={l} /> {tc(`lang_${l}`)}</> })),
  ];

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Toolbar end={data && <span className="adm-text-muted adm-text-sm">{t.plural('total', data.total)}</span>}>
        <span className="adm-toolbar-label">{t('filterByLanguage')}</span>
        <Tabs
          variant="segmented"
          ariaLabel={tc('language')}
          items={langItems}
          value={lang}
          onChange={(l) => { setLang(l); setPage(1); }}
        />
      </Toolbar>

      {loading && <Loading label={tc('loading')} />}
      {error && <Alert tone="danger">{error}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {data && (
        <>
          <Card flush>
            {data.users.length === 0 ? (
              <EmptyState icon="chats" title={lang ? t('noUsersLang') : t('noUsers')} compact />
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  {/* User ID, Language, Messages, First Seen, Last Active, Last
                      Message, Actions. No comments between the <col>s: the
                      whitespace around them is invalid inside <colgroup>. */}
                  <colgroup>
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '32%' }} />
                    <col style={{ width: '8%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>{t('colUserId')}</th>
                      <th>{t('colLanguage')}</th>
                      <th>{t('colMessages')}</th>
                      <th>{t('colFirstSeen')}</th>
                      <th>{t('colLastActive')}</th>
                      <th>{t('colLastMessage')}</th>
                      <th className="adm-col-actions"><span className="adm-sr-only">{tc('actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u: ChatUser) => (
                      <tr key={u.id}>
                        <td className="adm-mono adm-text-muted adm-cell-ltr" title={u.id}>
                          {u.id.slice(0, 16)}…
                        </td>
                        <td>{u.language ? <LangTag lang={u.language} /> : '—'}</td>
                        <td><strong>{fmtNumber(u.message_count)}</strong></td>
                        <td className="adm-cell-date">{fmtDate(u.first_seen)}</td>
                        <td className="adm-cell-date">{fmtDateTime(u.last_seen)}</td>
                        <td className="adm-text-sm" style={{ maxWidth: 0 }}>
                          <div className="adm-truncate" dir="auto">
                            {u.last_user_message || u.last_message || '—'}
                          </div>
                        </td>
                        <td className="adm-col-actions">
                          <div className="adm-row-actions">
                            <IconButton
                              icon="eye"
                              size="sm"
                              label={t('viewConversation')}
                              to={`/admin/chats/${encodeURIComponent(u.id)}`}
                            />
                            <IconButton
                              icon="trash"
                              tone="danger"
                              size="sm"
                              label={t('deleteConversation')}
                              onClick={() => handleDelete(u)}
                              loading={deleting === u.id}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Pagination */}
          {data.total > data.limit && (
            <div className="adm-pagination">
              <Button
                variant="ghost"
                size="sm"
                icon="chevronBack"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                {tc('prev')}
              </Button>
              <span className="adm-text-muted adm-text-sm">
                {tc('pageOf', { page, total: lastPage })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                iconEnd="chevronForward"
                disabled={page >= lastPage}
                onClick={() => setPage(p => p + 1)}
              >
                {tc('next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
