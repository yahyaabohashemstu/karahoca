import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type ChatUser } from '../utils/adminApi';
import { useAsync } from '../utils/useAdminAuth';
import { fmtDate, fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';

const messages = defineMessages({
  en: {
    title: 'Chat History',
    subtitle: 'All users who interacted with the AI assistant',
    filterByLanguage: 'Filter by language:',
    total: { other: 'Total: {n} users' },
    colUserId: 'User ID',
    colLanguage: 'Language',
    colMessages: 'Messages',
    colFirstSeen: 'First Seen',
    colLastActive: 'Last Active',
    colLastMessage: 'Last Message',
    noUsers: 'No users found.',
    deleteConversation: 'Delete conversation',
    confirmDelete: { other: 'Delete this visitor\'s conversation ({n} messages)? This cannot be undone.' },
    deleteFailed: 'Failed to delete the conversation',
  },
  ar: {
    title: 'سجل المحادثات',
    subtitle: 'كل الزوار الذين تحدّثوا مع المساعد',
    filterByLanguage: 'التصفية حسب اللغة:',
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
    noUsers: 'لا يوجد زوار.',
    deleteConversation: 'حذف المحادثة',
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

  const langs = ['', 'ar', 'en', 'tr', 'ru'];

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">{t('title')}</h1>
          <p className="adm-page-subtitle">{t('subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="adm-card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="adm-text-muted" style={{ fontSize: 13 }}>{t('filterByLanguage')}</span>
        {langs.map(l => (
          <button
            key={l || 'all'}
            className={`adm-btn adm-btn-sm ${lang === l ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
            onClick={() => { setLang(l); setPage(1); }}
          >
            {l || tc('all')}
          </button>
        ))}
        {data && (
          <span className="adm-text-muted adm-text-sm" style={{ marginInlineStart: 'auto' }}>
            {t.plural('total', data.total)}
          </span>
        )}
      </div>

      {loading && <div className="adm-loading-center"><span className="adm-spinner" /> {tc('loading')}</div>}
      {error && <div className="adm-alert adm-alert-error">⚠ {error}</div>}
      {actionError && <div className="adm-alert adm-alert-error" role="alert">⚠ {actionError}</div>}

      {data && (
        <>
          <div className="adm-card" style={{ padding: 0 }}>
            <div className="adm-table-wrap">
              <table className="adm-table">
                {/* User ID, Language, Messages, First Seen, Last Active, Last
                    Message, Actions. No comments between the <col>s: the
                    whitespace around them is invalid inside <colgroup>. */}
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'start'  }}>{t('colUserId')}</th>
                    <th style={{ textAlign: 'center' }}>{t('colLanguage')}</th>
                    <th style={{ textAlign: 'center' }}>{t('colMessages')}</th>
                    <th style={{ textAlign: 'center' }}>{t('colFirstSeen')}</th>
                    <th style={{ textAlign: 'center' }}>{t('colLastActive')}</th>
                    <th style={{ textAlign: 'start'  }}>{t('colLastMessage')}</th>
                    <th style={{ textAlign: 'center' }}>{tc('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>{t('noUsers')}</td></tr>
                  ) : data.users.map((u: ChatUser) => (
                    <tr key={u.id}>
                      <td style={{ textAlign: 'start' }}>
                        <span className="adm-mono adm-text-sm" style={{ color: 'var(--adm-text-muted)' }} title={u.id}>
                          {u.id.slice(0, 16)}…
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="adm-badge adm-badge-blue">{u.language}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <strong>{fmtNumber(u.message_count)}</strong>
                      </td>
                      <td style={{ textAlign: 'center' }} className="adm-text-muted adm-text-sm">
                        {fmtDate(u.first_seen)}
                      </td>
                      <td style={{ textAlign: 'center' }} className="adm-text-muted adm-text-sm">
                        {fmtDateTime(u.last_seen)}
                      </td>
                      <td style={{ textAlign: 'start', maxWidth: 0 }} className="adm-text-sm">
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir="auto">
                          {u.last_user_message || u.last_message || '—'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'center' }}>
                          <Link to={`/admin/chats/${encodeURIComponent(u.id)}`} className="adm-btn adm-btn-ghost adm-btn-sm">
                            {tc('viewArrow')}
                          </Link>
                          <button
                            className="adm-btn adm-btn-danger adm-btn-sm"
                            onClick={() => handleDelete(u)}
                            disabled={deleting === u.id}
                            aria-label={t('deleteConversation')}
                            title={t('deleteConversation')}
                          >
                            {deleting === u.id ? '…' : '🗑'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.total > data.limit && (
            <div className="adm-pagination">
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >{tc('prev')}</button>
              <span className="adm-text-muted adm-text-sm">
                {tc('pageOf', { page, total: lastPage })}
              </span>
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                disabled={page >= lastPage}
                onClick={() => setPage(p => p + 1)}
              >{tc('next')}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
