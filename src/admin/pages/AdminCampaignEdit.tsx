import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi, type Campaign, type CampaignSend } from '../utils/adminApi';
import { TranslationHelper } from '../components/TranslationHelper';
import {
  availableLanguages,
  incompleteLanguages,
  languageForSubscriber,
  normaliseSubscriberLang,
} from '../utils/campaignLanguage';
import { fmtDateTime, fmtNumber } from '../utils/dateUtils';
import { buildApiUrl } from '../../utils/api';
import { defineMessages, useT } from '../i18n/core';
import { common } from '../i18n/common';
import { AdminIcon, Alert, Badge, Button, Card, EmptyState, Field, LangLabel, LangTag, Loading, PageHeader, StatCard, StatGrid, StatusBadge, Tabs, type IconName, type Tone } from '../ui';

const messages = defineMessages({
  en: {
    backToCampaigns: 'Campaigns',
    saveCampaign: 'Save campaign',
    // Templates
    tplCustom: 'Custom',
    tplNewProduct: 'New product',
    tplOffer: 'Special offer',
    tplNews: 'Company news',
    // Language tabs of the editor: whether each version can be sent.
    langComplete: 'Complete',
    langIncomplete: 'Incomplete, so not sent',
    // Load / save / send messages
    statsFailed: 'Failed to load stats',
    subscribersFailed: 'Failed to load subscribers',
    audienceItem: '{n} × {code}',
    listSep: ', ',
    confirmTemplate: 'Applying this template replaces the English subject and body, and clears the Arabic, Turkish and Russian texts and every Group B subject. Continue?',
    titleRequired: 'Title is required',
    created: 'Campaign created!',
    savedOk: 'Saved!',
    saveFailed: 'Save failed',
    canvasUnsupported: 'Canvas not supported',
    imageLoadFailed: 'Failed to load image',
    unsupportedType: 'Unsupported file type. Use JPG, PNG, WebP, or GIF.',
    fileTooLarge: 'File too large. Maximum size is 20 MB.',
    uploadFailed: 'Upload failed',
    saveBeforeSchedule: 'Save the campaign first before scheduling it.',
    chooseDate: 'Choose a date to schedule this campaign.',
    invalidSchedule: 'Invalid schedule date or time.',
    timePassed: 'That time has already passed. Pick a later date or time, or use Queue Send to send it now.',
    scheduledOk: 'Campaign scheduled successfully!',
    scheduleFailed: 'Schedule failed',
    noActiveSubscribers: 'There are no active subscribers to send to.',
    noRecipientsSelected: 'No recipients are selected. Tick at least one subscriber under Recipients.',
    noCompleteLanguage: 'Write a subject and a body in at least one language first.',
    confirmSend: {
      one: 'Queue this campaign for immediate delivery to {n} subscriber?\n\nBy language: {summary}',
      other: 'Queue this campaign for immediate delivery to {n} subscribers?\n\nBy language: {summary}',
    },
    alreadyQueued: 'Campaign is already queued for background delivery.',
    queuedTo: {
      one: 'Queued for background delivery to {n} subscriber.',
      other: 'Queued for background delivery to {n} subscribers.',
    },
    sendFailed: 'Send failed',
    // Header
    newCampaign: 'New campaign',
    editCampaign: 'Edit campaign',
    sentCount: { one: 'Sent to {n} recipient', other: 'Sent to {n} recipients' },
    opensCount: { one: '{n} open', other: '{n} opens' },
    headerQueued: 'Queued for background delivery',
    headerSending: 'Being sent right now',
    waitingForList: 'Waiting for the subscriber list',
    scheduling: 'Scheduling…',
    schedule: 'Schedule',
    queueing: 'Queueing…',
    queueSend: 'Queue send',
    lockedSent: 'Read-only: this campaign has been sent, so its content and recipients can no longer be changed. To send something similar, create a new campaign.',
    lockedSending: 'Read-only: this campaign is being sent right now, so its content and recipients can no longer be changed. To send something similar, create a new campaign.',
    lockedQueued: 'Read-only: this campaign is queued for delivery, so its content and recipients can no longer be changed. To send something similar, create a new campaign.',
    stats: 'Stats',
    // Settings
    settingsTitle: 'Campaign settings',
    campaignTitle: 'Campaign title',
    campaignTitlePlaceholder: 'e.g. April Newsletter',
    templateType: 'Template type',
    // Timing
    timingTitle: 'Campaign timing',
    saveFirstToSchedule: 'Save the campaign first, then you can set a scheduled send time.',
    sentOn: 'Campaign sent on {date}.',
    queuedInfo: 'Campaign is queued for background delivery. The worker will pick it up automatically.',
    sendingInfo: 'Campaign is being sent right now. Reload this page later to see the result.',
    date: 'Date',
    time: 'Time',
    currentlyScheduled: 'Currently scheduled for {date}.',
    // Image
    imageTitle: 'Campaign image',
    imageHint: 'Optional — shown at the top of the e-mail',
    imageUrlLabel: 'Campaign image URL',
    imageUrlPlaceholder: 'https://... or upload from device',
    previewAlt: 'preview',
    // Recipients
    recipients: 'Recipients',
    subscribersLoadFailed: "Couldn't load the subscriber list: {error}. Sending and scheduling stay disabled until it loads.",
    loadingSubscribers: 'Loading subscribers…',
    noSubscribersYet: 'There are no active subscribers yet.',
    selectedOfTotal: '{n} / {total} selected',
    excluded: '{n} excluded',
    showRecipients: 'Choose recipients',
    hideRecipients: 'Hide the list',
    filterLabel: 'Filter recipients by e-mail',
    filterPlaceholder: 'Filter emails…',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    // Content
    content: 'Content',
    audienceTitle: 'Who receives which language',
    noLanguageComplete: 'No language is complete yet. Write a subject and a body in at least one language.',
    saveToSeeAudience: 'Save the campaign to see its audience by language.',
    noSubscribersSelected: 'No subscribers selected.',
    colSubscriberLang: 'Subscriber language',
    colSubscribers: 'Subscribers',
    colReceives: 'Receives',
    firstWritten: '(first written language)',
    noVersionYet: '— no {lang} version yet',
    incompleteSubjectOnly: '{lang} has a subject but no body, so it is not sent. Complete it or clear it.',
    incompleteBodyOnly: '{lang} has a body but no subject, so it is not sent. Complete it or clear it.',
    subjectA: 'Subject line — group A',
    subjectAPlaceholder: 'Email subject for Group A (everyone if no B)...',
    subjectB: 'Subject line — group B',
    abBadge: 'A/B test',
    subjectBPlaceholder: 'Leave empty to send same subject to everyone...',
    abNoReceivers: 'No selected subscriber receives {lang}, so this test will not run.',
    abActive: 'A/B test active — every second subscriber receiving {lang} gets Subject B',
    abOptional: 'Optional. Tests a second subject among the subscribers who receive {lang}.',
    body: 'Email body',
    bodyPlaceholder: 'Write your email content here... (use **bold** for emphasis)',
    bodyHint: 'Use **text** for bold. Each line becomes a paragraph.',
    // Stats
    opens: 'Opens',
    openRate: 'Open rate',
    clicks: 'Clicks',
    byLanguage: 'By language',
    colLanguageSent: 'Language sent',
    colRecipients: 'Recipients',
    colOpened: 'Opened',
    colOpenRate: 'Open rate',
    colClicks: 'Clicks',
    abResults: 'A/B test results',
    groupA: 'Group A',
    groupB: 'Group B',
    deliveryDetails: 'Delivery details',
    noSends: 'No emails sent yet for this campaign.',
    colEmail: 'Email',
    colVariant: 'Variant',
    colSent: 'Sent',
    colOpenTime: 'Open time',
  },
  ar: {
    backToCampaigns: 'الحملات البريدية',
    saveCampaign: 'حفظ الحملة',
    tplCustom: 'مخصص',
    tplNewProduct: 'منتج جديد',
    tplOffer: 'عرض خاص',
    tplNews: 'أخبار الشركة',
    langComplete: 'مكتملة',
    langIncomplete: 'غير مكتملة، لذلك لن تُرسل',
    statsFailed: 'تعذّر تحميل الإحصاءات',
    subscribersFailed: 'تعذّر تحميل المشتركين',
    audienceItem: '{lang}: {n}',
    listSep: '، ',
    confirmTemplate: 'سيستبدل تطبيق هذا القالب العنوان ونص الرسالة بالإنجليزية، ويمسح النصوص العربية والتركية والروسية وكل عناوين المجموعة B. متابعة؟',
    titleRequired: 'اسم الحملة مطلوب',
    created: 'تم إنشاء الحملة!',
    savedOk: 'تم الحفظ!',
    saveFailed: 'فشل الحفظ',
    canvasUnsupported: 'المتصفح لا يدعم معالجة الصور (Canvas)',
    imageLoadFailed: 'تعذّر تحميل الصورة',
    unsupportedType: 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP أو GIF.',
    fileTooLarge: 'الملف كبير جدًا. الحد الأقصى للحجم 20 ميغابايت.',
    uploadFailed: 'فشل الرفع',
    saveBeforeSchedule: 'احفظ الحملة أولًا قبل جدولتها.',
    chooseDate: 'اختر تاريخًا لجدولة هذه الحملة.',
    invalidSchedule: 'تاريخ الجدولة أو وقتها غير صالح.',
    timePassed: 'هذا الوقت قد مضى. اختر تاريخًا أو وقتًا لاحقًا، أو استخدم «إرسال الآن» لإرسالها فورًا.',
    scheduledOk: 'تمت جدولة الحملة بنجاح!',
    scheduleFailed: 'فشلت الجدولة',
    noActiveSubscribers: 'لا يوجد مشتركون نشطون للإرسال إليهم.',
    noRecipientsSelected: 'لم يُحدَّد أي مستلم. حدّد مشتركًا واحدًا على الأقل في قسم «المستلمون».',
    noCompleteLanguage: 'اكتب عنوانًا ونص رسالة بلغة واحدة على الأقل أولًا.',
    confirmSend: {
      one: 'إرسال هذه الحملة فورًا إلى مشترك واحد؟\n\nحسب اللغة: {summary}',
      two: 'إرسال هذه الحملة فورًا إلى مشتركَين؟\n\nحسب اللغة: {summary}',
      few: 'إرسال هذه الحملة فورًا إلى {n} مشتركين؟\n\nحسب اللغة: {summary}',
      many: 'إرسال هذه الحملة فورًا إلى {n} مشتركًا؟\n\nحسب اللغة: {summary}',
      other: 'إرسال هذه الحملة فورًا إلى {n} مشترك؟\n\nحسب اللغة: {summary}',
    },
    alreadyQueued: 'الحملة موجودة بالفعل في قائمة انتظار الإرسال في الخلفية.',
    queuedTo: {
      one: 'أُضيفت الحملة إلى قائمة انتظار الإرسال في الخلفية إلى مشترك واحد.',
      two: 'أُضيفت الحملة إلى قائمة انتظار الإرسال في الخلفية إلى مشتركَين.',
      few: 'أُضيفت الحملة إلى قائمة انتظار الإرسال في الخلفية إلى {n} مشتركين.',
      many: 'أُضيفت الحملة إلى قائمة انتظار الإرسال في الخلفية إلى {n} مشتركًا.',
      other: 'أُضيفت الحملة إلى قائمة انتظار الإرسال في الخلفية إلى {n} مشترك.',
    },
    sendFailed: 'فشل الإرسال',
    newCampaign: 'حملة جديدة',
    editCampaign: 'تعديل الحملة',
    sentCount: {
      zero: 'لم تُرسل إلى أحد',
      one: 'أُرسلت إلى مستلم واحد',
      two: 'أُرسلت إلى مستلمَين',
      few: 'أُرسلت إلى {n} مستلمين',
      many: 'أُرسلت إلى {n} مستلمًا',
      other: 'أُرسلت إلى {n} مستلم',
    },
    opensCount: {
      zero: 'لم تُفتح بعد',
      one: 'فُتحت مرة واحدة',
      two: 'فُتحت مرتين',
      few: 'فُتحت {n} مرات',
      many: 'فُتحت {n} مرة',
      other: 'فُتحت {n} مرة',
    },
    headerQueued: 'في قائمة انتظار الإرسال في الخلفية',
    headerSending: 'قيد الإرسال الآن',
    waitingForList: 'بانتظار تحميل قائمة المشتركين',
    scheduling: 'جارٍ الجدولة…',
    schedule: 'جدولة',
    queueing: 'جارٍ الإرسال…',
    queueSend: 'إرسال الآن',
    lockedSent: 'للقراءة فقط: أُرسلت هذه الحملة، لذا لم يعد بالإمكان تغيير محتواها ومستلميها. لإرسال حملة مشابهة، أنشئ حملة جديدة.',
    lockedSending: 'للقراءة فقط: هذه الحملة قيد الإرسال الآن، لذا لم يعد بالإمكان تغيير محتواها ومستلميها. لإرسال حملة مشابهة، أنشئ حملة جديدة.',
    lockedQueued: 'للقراءة فقط: هذه الحملة في قائمة انتظار الإرسال، لذا لم يعد بالإمكان تغيير محتواها ومستلميها. لإرسال حملة مشابهة، أنشئ حملة جديدة.',
    stats: 'الإحصاءات',
    settingsTitle: 'إعدادات الحملة',
    campaignTitle: 'اسم الحملة',
    campaignTitlePlaceholder: 'مثال: نشرة شهر أبريل',
    templateType: 'نوع القالب',
    timingTitle: 'توقيت الحملة',
    saveFirstToSchedule: 'احفظ الحملة أولًا، ثم يمكن تحديد موعد لإرسالها.',
    sentOn: 'أُرسلت الحملة في {date}.',
    queuedInfo: 'الحملة في قائمة انتظار الإرسال في الخلفية، وستُعالَج تلقائيًا.',
    sendingInfo: 'الحملة قيد الإرسال الآن. أعد تحميل هذه الصفحة لاحقًا لرؤية النتيجة.',
    date: 'التاريخ',
    time: 'الوقت',
    currentlyScheduled: 'مجدولة حاليًا في {date}.',
    imageTitle: 'صورة الحملة',
    imageHint: 'اختيارية — تظهر أعلى الرسالة',
    imageUrlLabel: 'رابط صورة الحملة',
    imageUrlPlaceholder: 'https://... أو ارفع صورة من الجهاز',
    previewAlt: 'معاينة',
    recipients: 'المستلمون',
    subscribersLoadFailed: 'تعذّر تحميل قائمة المشتركين: {error}. يبقى الإرسال والجدولة معطّلين حتى تُحمَّل.',
    loadingSubscribers: 'جارٍ تحميل المشتركين…',
    noSubscribersYet: 'لا يوجد مشتركون نشطون بعد.',
    selectedOfTotal: {
      zero: 'لم يُحدَّد أحد من {total}',
      one: 'تم تحديد مشترك واحد من {total}',
      two: 'تم تحديد مشتركَين من {total}',
      few: 'تم تحديد {n} مشتركين من {total}',
      many: 'تم تحديد {n} مشتركًا من {total}',
      other: 'تم تحديد {n} مشترك من {total}',
    },
    excluded: {
      one: 'مستبعد واحد',
      two: 'مستبعدان',
      few: '{n} مستبعدين',
      many: '{n} مستبعدًا',
      other: '{n} مستبعد',
    },
    showRecipients: 'اختيار المستلمين',
    hideRecipients: 'إخفاء القائمة',
    filterLabel: 'تصفية المستلمين حسب البريد الإلكتروني',
    filterPlaceholder: 'ابحث في عناوين البريد…',
    selectAll: 'تحديد الكل',
    deselectAll: 'إلغاء تحديد الكل',
    content: 'المحتوى',
    audienceTitle: 'من يتلقى أي لغة',
    noLanguageComplete: 'لا توجد لغة مكتملة بعد. اكتب عنوانًا ونص رسالة بلغة واحدة على الأقل.',
    saveToSeeAudience: 'احفظ الحملة لعرض جمهورها حسب اللغة.',
    noSubscribersSelected: 'لم يُحدَّد أي مشترك.',
    colSubscriberLang: 'لغة المشترك',
    colSubscribers: 'المشتركون',
    colReceives: 'يتلقى',
    firstWritten: '(أول لغة مكتوبة)',
    noVersionYet: '— لا توجد نسخة ب{lang} بعد',
    incompleteSubjectOnly: 'للنسخة ب{lang} عنوان دون نص رسالة، لذلك لن تُرسل. أكملها أو امسحها.',
    incompleteBodyOnly: 'للنسخة ب{lang} نص رسالة دون عنوان، لذلك لن تُرسل. أكملها أو امسحها.',
    subjectA: 'العنوان — المجموعة A',
    subjectAPlaceholder: 'عنوان الرسالة للمجموعة A (للجميع إن لم يوجد عنوان B)...',
    subjectB: 'العنوان — المجموعة B',
    abBadge: 'اختبار A/B',
    subjectBPlaceholder: 'اتركه فارغًا لإرسال العنوان نفسه إلى الجميع...',
    abNoReceivers: 'لا يوجد مشترك محدد تصله الحملة ب{lang}، لذلك لن يُجرى هذا الاختبار.',
    abActive: 'اختبار A/B مفعّل — كل مشترك ثانٍ ممن تصلهم الحملة ب{lang} يتلقى العنوان B',
    abOptional: 'اختياري. يختبر عنوانًا ثانيًا بين المشتركين الذين تصلهم الحملة ب{lang}.',
    body: 'نص الرسالة',
    bodyPlaceholder: 'اكتب محتوى الرسالة هنا... (استخدم **نص** للخط العريض)',
    bodyHint: 'استخدم **نص** للخط العريض. كل سطر يصبح فقرة.',
    opens: 'مرات الفتح',
    openRate: 'معدل الفتح',
    clicks: 'النقرات',
    byLanguage: 'حسب اللغة',
    colLanguageSent: 'لغة الإرسال',
    colRecipients: 'المستلمون',
    colOpened: 'فُتحت',
    colOpenRate: 'معدل الفتح',
    colClicks: 'النقرات',
    abResults: 'نتائج اختبار A/B',
    groupA: 'المجموعة A',
    groupB: 'المجموعة B',
    deliveryDetails: 'تفاصيل التسليم',
    noSends: 'لم تُرسل أي رسائل لهذه الحملة بعد.',
    colEmail: 'البريد الإلكتروني',
    colVariant: 'النسخة',
    colSent: 'وقت الإرسال',
    colOpenTime: 'وقت الفتح',
  },
});

type Key = keyof typeof messages.en;

const TEMPLATES: Array<{ value: Campaign['template_type']; label: Key; icon: IconName }> = [
  { value: 'custom',      label: 'tplCustom',     icon: 'edit' },
  { value: 'new_product', label: 'tplNewProduct', icon: 'products' },
  { value: 'offer',       label: 'tplOffer',      icon: 'tag' },
  { value: 'news',        label: 'tplNews',       icon: 'news' },
];
// E-mail content, not admin UI: the template fills in these English texts
// whatever language the dashboard is shown in.
const TEMPLATE_DEFAULTS: Record<string, { subject: string; body: string }> = {
  new_product: {
    subject: 'Exciting New Product from KARAHOCA!',
    body: '**Hello!**\n\nWe are excited to announce a brand-new product added to our catalog.\n\nThis product is designed to [DESCRIBE BENEFITS]. It\'s now available for order.\n\nContact us at info@karahoca.com to place your order today.',
  },
  offer: {
    subject: 'Exclusive Special Offer – Limited Time',
    body: '**Dear valued customer,**\n\nWe have a special offer exclusively for our subscribers.\n\n🏷️ [DESCRIBE OFFER]\n\nThis offer is available until [DATE]. Don\'t miss out!\n\nContact us to take advantage of this deal.',
  },
  news: {
    subject: 'KARAHOCA News Update',
    body: '**Dear friends,**\n\nWe have exciting news to share with you:\n\n[NEWS CONTENT]\n\nThank you for being part of the KARAHOCA family.',
  },
};

type LangKey = 'ar' | 'en' | 'tr' | 'ru';

const LANGS: Array<{ key: LangKey; dir: 'rtl' | 'ltr' }> = [
  { key: 'ar', dir: 'rtl' },
  { key: 'en', dir: 'ltr' },
  { key: 'tr', dir: 'ltr' },
  { key: 'ru', dir: 'ltr' },
];

type CompressedImage = { base64: string; fileName: string };

// Being mailed, or already mailed: the server refuses edits (409), so the
// page is read-only.
const LOCKED_STATUSES: ReadonlyArray<Campaign['status']> = ['queued', 'sending', 'sent'];

// Applying a template replaces these (English with the template's text).
const TEMPLATE_CLEARED_FIELDS = [
  'subject_ar', 'body_ar', 'subject_tr', 'body_tr', 'subject_ru', 'body_ru',
  'subject_b_ar', 'subject_b_en', 'subject_b_tr', 'subject_b_ru',
] as const;
const isTemplateText = (value: string) =>
  Object.values(TEMPLATE_DEFAULTS).some((tpl) => tpl.subject === value || tpl.body === value);

const empty = (): Partial<Campaign> => ({
  title: '', template_type: 'custom',
  subject_ar: '', subject_en: '', subject_tr: '', subject_ru: '',
  subject_b_ar: '', subject_b_en: '', subject_b_tr: '', subject_b_ru: '',
  body_ar: '', body_en: '', body_tr: '', body_ru: '',
  image_url: '',
});

const parseServerDatetime = (value?: string | null) => {
  if (!value) return null;

  const normalizedValue = value.includes('T')
    ? value
    : value.includes(' ')
      ? value.replace(' ', 'T') + 'Z'
      : value;

  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getLocalDateInputMin = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
};

const toDatetimeLocal = (value?: string | null): { date: string; time: string } => {
  if (!value) return { date: '', time: '10:00' };
  const d = parseServerDatetime(value);
  if (!d) return { date: '', time: '10:00' };
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - offsetMs).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
};

export const AdminCampaignEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const activeTab = searchParams.get('tab') || 'edit';
  const t = useT(messages);
  const tc = useT(common);
  // For the loaders below: reading `t` through a ref keeps a switch of the
  // dashboard language from re-running (re-fetching) them.
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  const langName = (l: LangKey | 'unknown') => tc(`lang_${l}`);

  const [form, setForm] = useState<Partial<Campaign>>(empty());
  const [lang, setLang] = useState<LangKey>('ar');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sends, setSends] = useState<CampaignSend[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Subscriber picker. null = still loading: the send confirmation counts
  // from this list, so Send/Schedule wait for it.
  const [allSubscribers, setAllSubscribers] = useState<string[] | null>(null);
  // Each subscriber's language decides which version they receive.
  const [subscriberLangs, setSubscriberLangs] = useState<Map<string, string | null>>(new Map());
  const [subscribersError, setSubscribersError] = useState('');
  const [subscribersAttempt, setSubscribersAttempt] = useState(0);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    if (!isNew && id) {
      adminApi.getCampaign(parseInt(id, 10))
        .then((r) => {
          setForm(r.campaign);
          // Re-open a scheduled campaign with the exclusions it was saved with.
          try {
            const stored: unknown = JSON.parse(r.campaign.excluded_emails || '[]');
            if (Array.isArray(stored)) setExcluded(new Set(stored.filter((e): e is string => typeof e === 'string')));
          } catch { /* ignore a malformed list */ }
          const { date, time } = toDatetimeLocal(r.campaign.scheduled_at);
          setScheduleDate(date);
          setScheduleTime(time);
          setLoading(false);
        })
        .catch((e) => {
          setError(e.message);
          setLoading(false);
        });
    }
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew && id && activeTab === 'stats' && !statsLoaded) {
      adminApi.getCampaignStats(parseInt(id, 10))
        .then((r) => {
          setSends(r.sends);
          setStatsLoaded(true);
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : tRef.current('statsFailed'));
          setStatsLoaded(true); // stop the spinner even on error
        });
    }
  }, [activeTab, id, isNew, statsLoaded]);

  useEffect(() => {
    if (isNew) return;
    let current = true;
    // All pages: page 1 alone is 50 subscribers, so the picker (and the
    // "send to N subscribers" confirmation) only ever knew the newest 50.
    adminApi.getAllNewsletterSubscribers()
      .then((subscribers) => {
        if (!current) return;
        setAllSubscribers(subscribers.map((sub) => sub.email));
        setSubscriberLangs(new Map(subscribers.map((sub) => [sub.email, sub.lang ?? null])));
      })
      .catch((e) => {
        if (current) setSubscribersError(e instanceof Error ? e.message : tRef.current('subscribersFailed'));
      });
    return () => { current = false; };
  }, [isNew, subscribersAttempt]);

  const retrySubscribers = () => {
    setSubscribersError('');
    setSubscribersAttempt((n) => n + 1);
  };

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const locked = !isNew && (form.status ? LOCKED_STATUSES.includes(form.status) : false);
  const subscribersReady = allSubscribers !== null;
  const selectedCount = (allSubscribers ?? []).filter((e) => !excluded.has(e)).length;
  // Same rule the server applies at send time (utils/campaignLanguage).
  const available = availableLanguages(form);
  const incomplete = incompleteLanguages(form);
  // Selected subscribers grouped by their own language, and what each
  // group will receive.
  const audience = (() => {
    const groups = new Map<LangKey | 'unknown', number>();
    for (const email of allSubscribers ?? []) {
      if (excluded.has(email)) continue;
      const own = normaliseSubscriberLang(subscriberLangs.get(email)) ?? 'unknown';
      groups.set(own, (groups.get(own) ?? 0) + 1);
    }
    return (['ar', 'en', 'tr', 'ru', 'unknown'] as const)
      .filter((own) => groups.get(own))
      .map((own) => ({
        own,
        count: groups.get(own) ?? 0,
        receives: languageForSubscriber(form, own === 'unknown' ? null : own, available),
      }));
  })();
  const receivingCount = (l: LangKey) =>
    audience.filter((g) => g.receives === l).reduce((sum, g) => sum + g.count, 0);
  const audienceSummary = audience
    .filter((g) => g.receives)
    .map((g) => t('audienceItem', { n: g.count, code: g.receives!.toUpperCase(), lang: langName(g.receives!) }))
    .join(t('listSep'));

  const applyTemplate = (type: Campaign['template_type']) => {
    if (locked) return;
    const tpl = TEMPLATE_DEFAULTS[type];
    if (tpl) {
      // The template replaces the English texts and clears every other
      // language and all B subjects; that used to happen without a word.
      const record = form as Record<string, string | undefined>;
      const losesWork =
        TEMPLATE_CLEARED_FIELDS.some((k) => (record[k] || '').trim()) ||
        (['subject_en', 'body_en'] as const).some((k) => {
          const value = (record[k] || '').trim();
          return value && !isTemplateText(value);
        });
      if (
        losesWork &&
        !confirm(t('confirmTemplate'))
      ) {
        return;
      }
      setForm((f) => ({
        ...f,
        template_type: type,
        subject_en: tpl.subject,
        body_en: tpl.body,
        subject_ar: '',
        body_ar: '',
        subject_tr: '',
        body_tr: '',
        subject_ru: '',
        body_ru: '',
        subject_b_ar: '',
        subject_b_en: '',
        subject_b_tr: '',
        subject_b_ru: '',
      }));
    } else {
      setForm((f) => ({ ...f, template_type: type }));
    }
  };

  const handleTranslated = (translations: Record<string, Record<string, string>>) => {
    setForm((f) => ({
      ...f,
      subject_ar: translations.subject?.ar || f.subject_ar || '',
      subject_en: translations.subject?.en || f.subject_en || '',
      subject_tr: translations.subject?.tr || f.subject_tr || '',
      subject_ru: translations.subject?.ru || f.subject_ru || '',
      body_ar: translations.body?.ar || f.body_ar || '',
      body_en: translations.body?.en || f.body_en || '',
      body_tr: translations.body?.tr || f.body_tr || '',
      body_ru: translations.body?.ru || f.body_ru || '',
    }));
  };

  const refreshCampaign = async () => {
    if (!id || isNew) return;
    const updated = await adminApi.getCampaign(parseInt(id, 10));
    setForm(updated.campaign);
    const { date, time } = toDatetimeLocal(updated.campaign.scheduled_at);
    setScheduleDate(date);
    setScheduleTime(time);
  };

  // The recipient selection is stored on the campaign with every save: a
  // later "Queue Send" from the list page (or the scheduler) mails exactly
  // the people ticked here.
  const saveCampaign = (campaignId: number) =>
    adminApi.updateCampaign(campaignId, { ...form, excludedEmails: [...excluded] });

  const save = async () => {
    if (!form.title?.trim()) {
      setError(t('titleRequired'));
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (isNew) {
        const r = await adminApi.createCampaign(form);
        navigate(`/admin/campaigns/${r.campaign.id}`, { replace: true });
        setSuccess(t('created'));
      } else {
        await saveCampaign(parseInt(id!, 10));
        await refreshCampaign();
        setSuccess(t('savedOk'));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const getPreviewImageUrl = (value?: string) => {
    if (!value) return '';
    return value.startsWith('/') ? buildApiUrl(value) : value;
  };

  const compressImage = (file: File, maxPx = 1400, quality = 0.82): Promise<CompressedImage> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round((height / width) * maxPx); width = maxPx; }
          else                 { width  = Math.round((width  / height) * maxPx); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) { reject(new Error(t('canvasUnsupported'))); return; }
        ctx2d.drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const extension = mime === 'image/png' ? 'png' : 'jpg';
        const originalBaseName = file.name.replace(/\.[^.]+$/, '').trim() || 'campaign-image';
        const dataUrl = canvas.toDataURL(mime, quality);
        resolve({
          base64: dataUrl.split(',')[1],
          fileName: `${originalBaseName}.${extension}`,
        });
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(t('imageLoadFailed'))); };
      img.src = objectUrl;
    });

  const handleImageUpload = async (file: File) => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t('unsupportedType'));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError(t('fileTooLarge'));
      return;
    }
    setUploading(true);
    setError('');
    try {
      const compressed = await compressImage(file);
      const data = await adminApi.uploadImage(compressed.base64, compressed.fileName);
      // Store the stable relative API path in the campaign record.
      // The server will expand it to the correct public URL when sending emails.
      set('image_url', data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const scheduleLater = async () => {
    if (isNew || !id) {
      setError(t('saveBeforeSchedule'));
      return;
    }
    if (!scheduleDate) {
      setError(t('chooseDate'));
      return;
    }
    // Local wall-clock time. The date picker's `min` only stops earlier
    // days, and the time defaults to 10:00, so "today" after 10:00 was a
    // time in the past (the server refuses those too).
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime || '10:00'}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      setError(t('invalidSchedule'));
      return;
    }
    if (scheduledAt.getTime() <= Date.now()) {
      setError(t('timePassed'));
      return;
    }
    setScheduling(true);
    setError('');
    setSuccess('');
    try {
      // Save first: scheduling/sending use the stored campaign, so edits
      // made since the last "Save" were silently left out of the e-mail.
      await saveCampaign(parseInt(id, 10));
      await adminApi.scheduleCampaign(parseInt(id, 10), scheduledAt.toISOString(), [...excluded]);
      await refreshCampaign();
      setSuccess(t('scheduledOk'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('scheduleFailed'));
    } finally {
      setScheduling(false);
    }
  };

  const sendNow = async () => {
    if (!subscribersReady) return;
    // Counted from the list, not `total − excluded`: the saved exclusions can
    // name people who have since unsubscribed.
    if (selectedCount === 0) {
      setError(allSubscribers.length === 0
        ? t('noActiveSubscribers')
        : t('noRecipientsSelected'));
      return;
    }
    if (!available.length) {
      setError(t('noCompleteLanguage'));
      return;
    }
    if (!confirm(t.plural('confirmSend', selectedCount, { summary: audienceSummary }))) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      await saveCampaign(parseInt(id!, 10));
      // Always the explicit list — [] means "everyone", not "use the saved one".
      const response = await adminApi.sendCampaign(parseInt(id!, 10), {
        excludedEmails: [...excluded],
      });
      if (response.alreadyQueued) {
        setSuccess(t('alreadyQueued'));
      } else {
        setSuccess(t.plural('queuedTo', selectedCount));
      }
      await refreshCampaign();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('sendFailed'));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loading label={tc('loading')} />;

  const formText = form as Record<string, string | undefined>;
  const headerDetails =
    form.status === 'sent' ? `${t.plural('sentCount', form.recipient_count ?? 0)} · ${t.plural('opensCount', form.open_count ?? 0)}`
      : form.status === 'queued' ? t('headerQueued')
        : form.status === 'sending' ? t('headerSending')
          : form.status === 'scheduled' && form.scheduled_at ? t('currentlyScheduled', { date: fmtDateTime(form.scheduled_at) })
            : undefined;
  const totalClicks = sends.reduce((sum, s) => sum + (s.click_count ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={isNew ? t('newCampaign') : <span dir="auto">{form.title || t('editCampaign')}</span>}
        back={{ to: '/admin/campaigns', label: t('backToCampaigns') }}
        meta={form.status ? <StatusBadge status={form.status} /> : undefined}
        subtitle={headerDetails}
        actions={!locked && (
          <Button variant="primary" icon="save" onClick={save} loading={saving}>
            {saving ? tc('saving') : t('saveCampaign')}
          </Button>
        )}
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}
      {locked && (
        <Alert tone="info">
          {form.status === 'sent' ? t('lockedSent') : form.status === 'sending' ? t('lockedSending') : t('lockedQueued')}
        </Alert>
      )}

      {!isNew && (
        <Tabs
          variant="underline"
          value={activeTab === 'stats' ? 'stats' : 'edit'}
          onChange={(tab) => navigate(`/admin/campaigns/${id}?tab=${tab}`, { replace: true })}
          items={[
            { value: 'edit', label: tc('edit'), icon: 'edit' },
            { value: 'stats', label: t('stats'), icon: 'insights' },
          ]}
        />
      )}

      {activeTab === 'edit' && (
        <div className="adm-stack">
          <Card title={t('settingsTitle')} icon="settings">
            <div className="adm-grid-2">
              <Field label={t('campaignTitle')} required>
                <input className="adm-input" dir="auto" value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder={t('campaignTitlePlaceholder')} readOnly={locked} />
              </Field>
              <div className="adm-field">
                <span className="adm-label">{t('templateType')}</span>
                <Tabs
                  variant="segmented"
                  ariaLabel={t('templateType')}
                  value={form.template_type ?? 'custom'}
                  onChange={applyTemplate}
                  items={TEMPLATES.map((tpl) => ({
                    value: tpl.value,
                    label: t(tpl.label),
                    icon: tpl.icon,
                    // Read-only: the chosen template stays readable, the others are off.
                    disabled: locked && form.template_type !== tpl.value,
                  }))}
                />
              </div>
            </div>
          </Card>

          <Card title={t('timingTitle')} icon="clock">
            {isNew ? (
              <Alert tone="info">{t('saveFirstToSchedule')}</Alert>
            ) : form.status === 'sent' ? (
              /* sent_at: a campaign sent with "Queue Send" has no scheduled_at. */
              <Alert tone="success">{t('sentOn', { date: fmtDateTime(form.sent_at || form.scheduled_at) })}</Alert>
            ) : form.status === 'queued' ? (
              <Alert tone="info">{t('queuedInfo')}</Alert>
            ) : form.status === 'sending' ? (
              <Alert tone="info">{t('sendingInfo')}</Alert>
            ) : (
              <>
                <div className="adm-grid-2">
                  <Field
                    label={t('date')}
                    hint={form.status === 'scheduled' && form.scheduled_at
                      ? t('currentlyScheduled', { date: fmtDateTime(form.scheduled_at) })
                      : undefined}
                  >
                    <input
                      className="adm-input"
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={getLocalDateInputMin()}
                    />
                  </Field>
                  <Field label={t('time')}>
                    <input
                      className="adm-input"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="adm-flex" style={{ flexWrap: 'wrap' }}>
                  <Button
                    variant="secondary"
                    icon="calendar"
                    onClick={scheduleLater}
                    loading={scheduling}
                    disabled={!subscribersReady}
                    title={subscribersReady ? undefined : t('waitingForList')}
                  >
                    {scheduling ? t('scheduling') : t('schedule')}
                  </Button>
                  <Button
                    variant="primary"
                    icon="send"
                    onClick={sendNow}
                    loading={sending}
                    disabled={!subscribersReady}
                    title={subscribersReady ? undefined : t('waitingForList')}
                  >
                    {sending ? t('queueing') : t('queueSend')}
                  </Button>
                </div>
              </>
            )}
          </Card>

          <Card
            title={t('imageTitle')}
            icon="image"
            subtitle={t('imageHint')}
            actions={!locked && (
              <Button
                size="sm"
                icon="upload"
                onClick={() => fileInputRef.current?.click()}
                loading={uploading}
              >
                {uploading ? tc('uploading') : tc('upload')}
              </Button>
            )}
          >
            <input
              className="adm-input"
              dir="ltr"
              aria-label={t('imageUrlLabel')}
              value={formText.image_url || ''}
              onChange={(e) => set('image_url', e.target.value)}
              placeholder={t('imageUrlPlaceholder')}
              readOnly={locked}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
                e.target.value = '';
              }}
            />
            {formText.image_url && (
              <img
                src={getPreviewImageUrl(formText.image_url)}
                alt={t('previewAlt')}
                style={{ display: 'block', marginTop: 12, maxHeight: 160, maxWidth: '100%', objectFit: 'contain' }}
              />
            )}
          </Card>

          {/* ── Subscriber Picker ─────────────────────────────────────────── */}
          {!isNew && !locked && (
            subscribersError ? (
              <Card title={t('recipients')} icon="cohorts">
                <Alert
                  tone="danger"
                  action={<Button size="sm" icon="refresh" onClick={retrySubscribers}>{tc('retry')}</Button>}
                >
                  {t('subscribersLoadFailed', { error: subscribersError })}
                </Alert>
              </Card>
            ) : allSubscribers === null ? (
              <Card title={t('recipients')} icon="cohorts">
                <Loading inline label={t('loadingSubscribers')} />
              </Card>
            ) : allSubscribers.length === 0 ? (
              <Card title={t('recipients')} icon="cohorts">
                <EmptyState icon="cohorts" title={t('noSubscribersYet')} compact />
              </Card>
            ) : (
              <Card
                title={t('recipients')}
                icon="cohorts"
                subtitle={(
                  <>
                    {t.plural('selectedOfTotal', selectedCount, { total: allSubscribers.length })}
                    {selectedCount < allSubscribers.length && (
                      <>
                        {' '}
                        <Badge tone="warning">{t.plural('excluded', allSubscribers.length - selectedCount)}</Badge>
                      </>
                    )}
                  </>
                )}
                actions={(
                  <Button
                    variant="ghost"
                    size="sm"
                    iconEnd={pickerOpen ? 'chevronUp' : 'chevronDown'}
                    aria-expanded={pickerOpen}
                    aria-controls="campaign-recipient-picker"
                    onClick={() => setPickerOpen(o => !o)}
                  >
                    {pickerOpen ? t('hideRecipients') : t('showRecipients')}
                  </Button>
                )}
              >
                {pickerOpen && (
                  <div id="campaign-recipient-picker">
                    <div className="adm-flex" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
                      <input
                        type="search"
                        className="adm-input adm-input-sm"
                        dir="ltr"
                        aria-label={t('filterLabel')}
                        placeholder={t('filterPlaceholder')}
                        value={pickerSearch}
                        onChange={e => setPickerSearch(e.target.value)}
                        style={{ flex: 1, minWidth: 160 }}
                      />
                      <Button variant="ghost" size="sm" icon="checkCircle" onClick={() => setExcluded(new Set())}>
                        {t('selectAll')}
                      </Button>
                      <Button variant="ghost" size="sm" icon="ban" onClick={() => setExcluded(new Set(allSubscribers))}>
                        {t('deselectAll')}
                      </Button>
                    </div>

                    <div className="adm-table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
                      <table className="adm-table">
                        <tbody>
                          {allSubscribers
                            .filter(email => !pickerSearch.trim() || email.toLowerCase().includes(pickerSearch.toLowerCase()))
                            .map(email => {
                              const isExcluded = excluded.has(email);
                              return (
                                <tr key={email}>
                                  <td>
                                    <label className="adm-check" style={{ display: 'flex' }}>
                                      <input
                                        type="checkbox"
                                        checked={!isExcluded}
                                        onChange={() => {
                                          setExcluded(prev => {
                                            const next = new Set(prev);
                                            if (next.has(email)) next.delete(email);
                                            else next.add(email);
                                            return next;
                                          });
                                        }}
                                      />
                                      <span
                                        className={`adm-mono adm-cell-ltr${isExcluded ? ' adm-text-muted' : ''}`}
                                        style={isExcluded ? { textDecoration: 'line-through' } : undefined}
                                      >
                                        {email}
                                      </span>
                                    </label>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            )
          )}

          <Card
            title={t('content')}
            icon="mail"
            actions={!locked && (
              <TranslationHelper
                fields={{
                  subject: form[`subject_${lang}`] || '',
                  body: form[`body_${lang}`] || '',
                }}
                sourceLang={lang}
                onTranslated={(translations) => handleTranslated(translations as Record<string, Record<string, string>>)}
              />
            )}
          >
            {/* Each subscriber gets their own language, or the closest one
                written. Show the outcome per group so a half-translated
                campaign doesn't reach anyone in a surprise language. */}
            <div className="adm-campaign-audience">
              <div className="adm-campaign-audience-title">{t('audienceTitle')}</div>
              {!available.length ? (
                <div className="adm-campaign-audience-warn adm-flex">
                  <AdminIcon name="alert" size="xs" />
                  <span>{t('noLanguageComplete')}</span>
                </div>
              ) : isNew ? (
                <div className="adm-text-muted">{t('saveToSeeAudience')}</div>
              ) : !subscribersReady ? (
                <div className="adm-text-muted">{t('loadingSubscribers')}</div>
              ) : audience.length === 0 ? (
                <div className="adm-text-muted">{t('noSubscribersSelected')}</div>
              ) : (
                <table className="adm-campaign-audience-table">
                  <thead>
                    <tr><th>{t('colSubscriberLang')}</th><th>{t('colSubscribers')}</th><th>{t('colReceives')}</th></tr>
                  </thead>
                  <tbody>
                    {audience.map((g) => (
                      <tr key={g.own}>
                        <td>{langName(g.own)}</td>
                        <td>{fmtNumber(g.count)}</td>
                        <td>
                          {g.receives === g.own ? (
                            <span className="adm-campaign-audience-ok adm-flex" style={{ gap: 5 }}>
                              <AdminIcon name="check" size="xs" />
                              <span>{langName(g.receives)}</span>
                            </span>
                          ) : g.own === 'unknown' ? (
                            <span>{langName(g.receives!)} <span className="adm-text-muted">{t('firstWritten')}</span></span>
                          ) : (
                            <span className="adm-campaign-audience-fallback">
                              {langName(g.receives!)} <span className="adm-text-muted">{t('noVersionYet', { lang: langName(g.own) })}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {incomplete.map((l) => (
                <div key={l} className="adm-campaign-audience-warn adm-flex">
                  <AdminIcon name="alert" size="xs" />
                  <span>{t((form[`subject_${l}`] || '').trim() ? 'incompleteSubjectOnly' : 'incompleteBodyOnly', { lang: langName(l) })}</span>
                </div>
              ))}
            </div>

            <div className="adm-mb-16">
              <Tabs
                variant="segmented"
                ariaLabel={t('content')}
                value={lang}
                onChange={setLang}
                items={LANGS.map((l) => ({
                  value: l.key,
                  label: <LangLabel lang={l.key} />,
                  badge: available.includes(l.key)
                    ? <AdminIcon name="check" size={12} label={t('langComplete')} />
                    : incomplete.includes(l.key)
                      ? <AdminIcon name="alert" size={12} label={t('langIncomplete')} />
                      : undefined,
                }))}
              />
            </div>

            {/* Direction follows the language being written, not the dashboard's. */}
            {LANGS.filter((l) => l.key === lang).map((l) => {
              const subjectB = formText[`subject_b_${l.key}`] || '';
              return (
                // Each box has the content language's direction; labels and
                // hints keep the dashboard's.
                <div key={l.key}>
                  <Field label={t('subjectA')}>
                    <input
                      className="adm-input"
                      value={formText[`subject_${l.key}`] || ''}
                      onChange={(e) => set(`subject_${l.key}`, e.target.value)}
                      placeholder={t('subjectAPlaceholder')}
                      dir={l.dir}
                      readOnly={locked}
                    />
                  </Field>
                  {/* The A/B split runs separately in each language, among the
                      subscribers who receive that language. */}
                  <Field
                    label={<>{t('subjectB')} <Badge tone="violet">{t('abBadge')}</Badge></>}
                    hint={subjectB.trim() ? (
                      subscribersReady && receivingCount(l.key) === 0 ? (
                        <span className="adm-campaign-audience-warn adm-flex" style={{ marginTop: 0 }}>
                          <AdminIcon name="alert" size="xs" />
                          <span>{t('abNoReceivers', { lang: langName(l.key) })}</span>
                        </span>
                      ) : (
                        <span className="adm-campaign-audience-ok adm-flex">
                          <AdminIcon name="check" size="xs" />
                          <span>{t('abActive', { lang: langName(l.key) })}</span>
                        </span>
                      )
                    ) : t('abOptional', { lang: langName(l.key) })}
                  >
                    <input
                      className="adm-input"
                      value={subjectB}
                      onChange={(e) => set(`subject_b_${l.key}`, e.target.value)}
                      placeholder={t('subjectBPlaceholder')}
                      dir={l.dir}
                      readOnly={locked}
                    />
                  </Field>
                  <Field label={t('body')} hint={t('bodyHint')}>
                    <textarea
                      className="adm-textarea"
                      rows={12}
                      value={formText[`body_${l.key}`] || ''}
                      onChange={(e) => set(`body_${l.key}`, e.target.value)}
                      placeholder={t('bodyPlaceholder')}
                      dir={l.dir}
                      readOnly={locked}
                    />
                  </Field>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {activeTab === 'stats' && !isNew && (
        <div className="adm-stack">
          {/* ── Summary cards ─────────────────────────────────────────────── */}
          <StatGrid min={150}>
            <StatCard icon="cohorts" label={t('recipients')} value={fmtNumber(form.recipient_count)} />
            <StatCard icon="eye" tone="success" label={t('opens')} value={fmtNumber(form.open_count)} />
            <StatCard
              icon="insights"
              tone="violet"
              label={t('openRate')}
              value={form.recipient_count ? `${Math.round((form.open_count! / form.recipient_count) * 100)}%` : '—'}
            />
            <StatCard icon="pointer" tone="warning" label={t('clicks')} value={fmtNumber(totalClicks)} />
          </StatGrid>

          {/* Per language: who got which version, and how each did. */}
          {sends.some(s => s.lang) && (() => {
            const langs = (['ar', 'en', 'tr', 'ru'] as const).filter((l) => sends.some((x) => x.lang === l));
            return (
              <Card title={t('byLanguage')} icon="language" flush>
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr><th>{t('colLanguageSent')}</th><th>{t('colRecipients')}</th><th>{t('colOpened')}</th><th>{t('colOpenRate')}</th><th>{t('colClicks')}</th></tr>
                    </thead>
                    <tbody>
                      {langs.map((l) => {
                        const group = sends.filter((x) => x.lang === l);
                        const opened = group.filter((x) => x.opened).length;
                        return (
                          <tr key={l}>
                            <td><span className="adm-flex"><LangTag lang={l} /> {langName(l)}</span></td>
                            <td>{fmtNumber(group.length)}</td>
                            <td>{fmtNumber(opened)}</td>
                            <td>{group.length ? `${Math.round((opened / group.length) * 100)}%` : '—'}</td>
                            <td>{fmtNumber(group.reduce((n, x) => n + (x.click_count ?? 0), 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })()}

          {/* ── A/B breakdown (shown only if variant data exists) ─────────── */}
          {sends.some(s => s.ab_variant === 'b') && (() => {
            const groupA = sends.filter(s => s.ab_variant !== 'b');
            const groupB = sends.filter(s => s.ab_variant === 'b');
            const rate = (group: typeof sends) =>
              group.length ? `${Math.round((group.filter(s => s.opened).length / group.length) * 100)}%` : '—';
            const clicks = (group: typeof sends) => group.reduce((n, s) => n + (s.click_count ?? 0), 0);
            const groups: Array<{ key: 'a' | 'b'; label: string; group: typeof sends; tone: Tone }> = [
              { key: 'a', label: t('groupA'), group: groupA, tone: 'info' },
              { key: 'b', label: t('groupB'), group: groupB, tone: 'violet' },
            ];
            return (
              <Card title={t('abResults')} icon="abtest">
                <div className="adm-grid-2">
                  {groups.map(({ key, label, group, tone }) => (
                    <Card
                      key={key}
                      title={label}
                      actions={<Badge tone={tone} title={t('openRate')}>{rate(group)}</Badge>}
                    >
                      <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 12px', margin: 0 }}>
                        <dt className="adm-text-muted">{t('recipients')}</dt>
                        <dd style={{ margin: 0 }}><strong>{fmtNumber(group.length)}</strong></dd>
                        <dt className="adm-text-muted">{t('opens')}</dt>
                        <dd style={{ margin: 0 }}><strong>{fmtNumber(group.filter(s => s.opened).length)}</strong></dd>
                        <dt className="adm-text-muted">{t('openRate')}</dt>
                        <dd style={{ margin: 0 }}><strong>{rate(group)}</strong></dd>
                        <dt className="adm-text-muted">{t('clicks')}</dt>
                        <dd style={{ margin: 0 }}><strong>{fmtNumber(clicks(group))}</strong></dd>
                      </dl>
                    </Card>
                  ))}
                </div>
              </Card>
            );
          })()}

          {/* ── Delivery table ─────────────────────────────────────────────── */}
          <Card title={t('deliveryDetails')} icon="mail" flush>
            {!statsLoaded ? (
              <Loading label={tc('loading')} />
            ) : !sends.length ? (
              <EmptyState icon="mail" title={t('noSends')} compact />
            ) : (() => {
              // Compute once — avoids O(n²) inside the row map
              const hasVariant = sends.some(s => s.ab_variant);
              return (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>{t('colEmail')}</th>
                        {hasVariant && <th>{t('colVariant')}</th>}
                        <th>{t('colSent')}</th>
                        <th>{t('colOpened')}</th>
                        <th>{t('colClicks')}</th>
                        <th>{t('colOpenTime')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sends.map((s) => (
                        <tr key={s.id}>
                          <td className="adm-mono adm-cell-ltr">{s.email}</td>
                          {hasVariant && (
                            <td>
                              <Badge tone={s.ab_variant === 'b' ? 'violet' : 'info'}>{s.ab_variant?.toUpperCase() ?? 'A'}</Badge>
                            </td>
                          )}
                          <td className="adm-cell-date">{fmtDateTime(s.created_at)}</td>
                          <td>
                            {s.opened ? (
                              <Badge tone="success" icon="checkCircle">{tc('yes')}</Badge>
                            ) : (
                              <span className="adm-text-muted">—</span>
                            )}
                          </td>
                          <td>
                            {(s.click_count ?? 0) > 0 ? (
                              <strong>{fmtNumber(s.click_count)}</strong>
                            ) : (
                              <span className="adm-text-muted">—</span>
                            )}
                          </td>
                          <td className="adm-cell-date">{fmtDateTime(s.opened_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </Card>
        </div>
      )}
    </div>
  );
};
