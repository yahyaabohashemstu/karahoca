/**
 * Public entrypoint for the AI chat module.
 *
 * What's left on the client: the welcome bubble and the suggestion chips.
 * The knowledge base and the whole prompt are built on the server
 * (server/services/aiPrompt.mjs) — the chat sends only the conversation.
 */

export { generateSmartSuggestions, getStarterSuggestions } from './suggestions';
export { getAssistantWelcomeMessage } from './welcome';
