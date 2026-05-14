/**
 * §5.6.6 v0.7 — global test setup. Vendor OAuth client_id/secret are resolved
 * at runtime via process.env to keep wikey-core source string-free (GitHub
 * secret scanning push protection). All §5.6.6 unit tests use mock fetch, so
 * the actual values are never sent over the network — placeholder strings
 * suffice here.
 */
process.env.WIKEY_GEMINI_OAUTH_CLIENT_ID ??= 'test-gemini-client-id'
process.env.WIKEY_GEMINI_OAUTH_CLIENT_SECRET ??= 'test-gemini-client-secret'
process.env.WIKEY_OPENAI_OAUTH_CLIENT_ID ??= 'test-openai-client-id'
process.env.WIKEY_ANTHROPIC_OAUTH_CLIENT_ID ??= 'test-anthropic-client-id'
