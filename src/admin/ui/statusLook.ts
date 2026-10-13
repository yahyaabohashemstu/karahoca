import type { IconName } from '../components/iconPaths';
import type { Tone } from './Feedback';

// One look per status everywhere: the same colour and icon for
// "published" on a product, an article and a blog post (words in
// StatusBadge.tsx).

export type Status =
  | 'published' | 'live' | 'active' | 'draft' | 'scheduled' | 'hidden' | 'inactive' | 'deleted'
  | 'queued' | 'sending' | 'sent' | 'failed'
  | 'running' | 'stopped' | 'done'
  | 'new' | 'reviewed' | 'ignored';

export const STATUS_LOOK: Record<Status, { tone: Tone; icon: IconName }> = {
  published: { tone: 'success', icon: 'checkCircle' },
  live: { tone: 'success', icon: 'eye' },
  active: { tone: 'success', icon: 'check' },
  draft: { tone: 'warning', icon: 'draft' },
  scheduled: { tone: 'info', icon: 'clock' },
  hidden: { tone: 'neutral', icon: 'eyeOff' },
  inactive: { tone: 'neutral', icon: 'ban' },
  deleted: { tone: 'danger', icon: 'trash' },
  queued: { tone: 'info', icon: 'hourglass' },
  sending: { tone: 'info', icon: 'send' },
  sent: { tone: 'success', icon: 'checkCircle' },
  failed: { tone: 'danger', icon: 'alert' },
  running: { tone: 'success', icon: 'play' },
  stopped: { tone: 'neutral', icon: 'stop' },
  done: { tone: 'info', icon: 'checkCircle' },
  new: { tone: 'accent', icon: 'flame' },
  reviewed: { tone: 'success', icon: 'check' },
  ignored: { tone: 'neutral', icon: 'ban' },
};

export const STATUSES = Object.keys(STATUS_LOOK) as Status[];
export const isStatus = (value: unknown): value is Status => typeof value === 'string' && value in STATUS_LOOK;
