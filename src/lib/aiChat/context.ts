import { apiFetch } from '../../utils/apiFetch';
import type { AiContextPayload, KnowledgeSection } from './types';

/**
 * Minimal inline fallback used if `/api/ai/context` is unreachable on first
 * load. We keep a tiny, company-level description + pricing pointer so the
 * LLM still has SOMETHING structural to anchor on instead of an empty prompt.
 *
 * The canonical source of truth is the DB; this is a last-resort resilience
 * net, not a duplicated catalog.
 */
const FALLBACK_CONTEXT: AiContextPayload = {
  sections: [
    {
      title: 'هوية الشركة',
      content:
        'KARAHOCA KIMYA شركة تركية تصنّع منتجات التنظيف المنزلية والصناعية تحت علامتَي DİOX و AYLUX، وتلتزم بمعايير الجودة الصارمة وتُصدّر إلى أكثر من 15 دولة.',
      tags: ['company', 'identity'],
    },
    {
      title: 'قنوات التواصل',
      content:
        'للاستفسار مباشرة: البريد info@karahoca.com أو الواتساب +905305914990.',
      tags: ['contact', 'support'],
    },
  ],
  toneGuidelines:
    'Respond in the SAME language as the customer question. Be professional and concise. Refer customers to info@karahoca.com or WhatsApp +90 530 591 4990 for offers and custom quotes.',
};

let cachedPayload: AiContextPayload | null = null;
let inFlight: Promise<AiContextPayload> | null = null;

/**
 * Fetch (or return cached) AI assistant context from the server. The payload
 * contains the seven base knowledge sections + the system-prompt tone
 * guidelines — previously hardcoded in `src/data/aiKnowledge.ts`, now
 * served from SQLite via `/api/ai/context`.
 *
 * Idempotent: concurrent callers share the same in-flight request, and
 * subsequent calls after a successful fetch return synchronously from cache.
 *
 * Resilience: on fetch failure (offline, 5xx, timeout) we return the
 * inline `FALLBACK_CONTEXT` so the chat widget degrades gracefully rather
 * than blocking. The cache is NOT populated on failure so a retry can
 * refetch on the next user action.
 */
export const loadAiContext = async (): Promise<AiContextPayload> => {
  if (cachedPayload) return cachedPayload;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      let response: Response;
      try {
        response = await apiFetch('/api/ai/context', {
          method: 'GET',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) throw new Error(`context request failed: ${response.status}`);
      const payload = await response.json();

      if (!Array.isArray(payload?.sections) || typeof payload?.toneGuidelines !== 'string') {
        throw new Error('context response malformed');
      }

      const sanitised: AiContextPayload = {
        sections: payload.sections
          .filter((section: unknown): section is KnowledgeSection =>
            !!section &&
            typeof section === 'object' &&
            typeof (section as KnowledgeSection).title === 'string' &&
            typeof (section as KnowledgeSection).content === 'string',
          )
          .map((section: KnowledgeSection) => ({
            title: section.title,
            content: section.content,
            tags: Array.isArray(section.tags)
              ? section.tags.map(String).filter(Boolean)
              : [],
          })),
        toneGuidelines: payload.toneGuidelines,
      };

      cachedPayload = sanitised;
      return sanitised;
    } catch {
      // Degrade to the inline fallback — chat still works, just with a much
      // shorter base knowledge footprint than the full DB-seeded version.
      return FALLBACK_CONTEXT;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};

/** Synchronous read for code paths that NEED content immediately and can't
 *  await (e.g. module-level fallbacks). Returns the cached payload if loaded,
 *  otherwise the inline fallback — never null. */
export const getCachedAiContext = (): AiContextPayload =>
  cachedPayload ?? FALLBACK_CONTEXT;

/** Testing / manual-refresh helper. Resets the memoised payload so the next
 *  call to `loadAiContext` refetches. */
export const clearAiContextCache = () => {
  cachedPayload = null;
  inFlight = null;
};
