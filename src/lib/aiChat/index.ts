/**
 * Public entrypoint for the AI chat module.
 *
 * Previously: `src/data/aiKnowledge.ts` was a 1,125-line file that mixed
 * static knowledge data, ranking logic, and suggestion heuristics. Phase 3
 * split it into five focused files and moved the static data to SQLite.
 * Consumers import from here; internal modules import each other directly.
 */

export type { KnowledgeSection, AiContextPayload } from './types';
export { buildKnowledgeBase } from './knowledge';
export { generateSmartSuggestions } from './suggestions';
export { getAssistantWelcomeMessage } from './welcome';
export { loadAiContext, getCachedAiContext, clearAiContextCache } from './context';
