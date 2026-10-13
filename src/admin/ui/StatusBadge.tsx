import React from 'react';
import { defineMessages, useT } from '../i18n/core';
import { Badge } from './Feedback';
import { STATUS_LOOK, type Status } from './statusLook';

// One look per status everywhere: the same colour, icon and word for
// "published" on a product, an article and a blog post.

const messages = defineMessages({
  en: {
    published: 'Published', live: 'Live', active: 'Active', draft: 'Draft', scheduled: 'Scheduled',
    hidden: 'Hidden', inactive: 'Inactive', deleted: 'Deleted', queued: 'Queued', sending: 'Sending',
    sent: 'Sent', failed: 'Failed', running: 'Running', stopped: 'Stopped', done: 'Completed', new: 'New',
    reviewed: 'Reviewed', ignored: 'Ignored',
  },
  ar: {
    published: 'منشور', live: 'ظاهر للزوار', active: 'مفعّل', draft: 'مسودة', scheduled: 'مجدول',
    hidden: 'مخفي', inactive: 'غير مفعّل', deleted: 'محذوف', queued: 'في قائمة الانتظار', sending: 'قيد الإرسال',
    sent: 'مُرسَلة', failed: 'فشل', running: 'قيد التشغيل', stopped: 'متوقف', done: 'مكتمل', new: 'جديد',
    reviewed: 'تمت المراجعة', ignored: 'متجاهَل',
  },
});

/** `label` overrides the word (e.g. a feminine form or a count) — the look stays. */
export const StatusBadge: React.FC<{ status: Status; label?: React.ReactNode; title?: string }> = ({ status, label, title }) => {
  const t = useT(messages);
  const look = STATUS_LOOK[status];
  return <Badge tone={look.tone} icon={look.icon} title={title}>{label ?? t(status)}</Badge>;
};
