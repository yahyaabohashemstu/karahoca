/**
 * Shared types for the AI chat module.
 *
 * These used to live inline in `src/data/aiKnowledge.ts` (1,125 lines of
 * mixed data + logic). Phase 3 extricates the static data to SQLite and
 * reorganises the rest into `src/lib/aiChat/`.
 */

export interface KnowledgeSection {
  /** Section title (short, human-readable). */
  title: string;
  /** Full content — multi-paragraph, may be bilingual. */
  content: string;
  /** Free-form tags used by the ranking heuristic. */
  tags?: string[];
}

/** Shape of the `/api/ai/context` response consumed by `context.ts`. */
export interface AiContextPayload {
  sections: KnowledgeSection[];
  toneGuidelines: string;
}
