// wikey-core public API

export type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  WikiFS,
  WikeyConfig,
  LLMProvider,
  LLMCallOptions,
  WikiPage,
  IngestResult,
  IngestProgress,
  IngestProgressCallback,
  BriefMode,
  IngestBrief,
  IngestPlan,
  IngestPlanGate,
  QueryResult,
  SearchResult,
  SchemaCustomType,
  SchemaOverride,
} from './types.js'

export {
  ENTITY_TYPES,
  CONCEPT_TYPES,
  getEntityTypes,
  getConceptTypes,
  parseSchemaOverrideYaml,
  loadSchemaOverride,
  buildSchemaPromptBlock,
} from './schema.js'

export { parseWikeyConf, loadConfig, resolveProvider } from './config.js'
export { LLMClient, fetchModelList } from './llm-client.js'
export { createPage, updateIndex, appendLog, extractWikilinks } from './wiki-ops.js'
export { query } from './query-pipeline.js'
export type { QueryOptions } from './query-pipeline.js'
export {
  ingest,
  generateBrief,
  injectGuideHint,
  loadEffectiveIngestPrompt,
  INGEST_PROMPT_PATH,
  BUNDLED_INGEST_PROMPT,
  PlanRejectedError,
  assertNotWikiPath,
} from './ingest-pipeline.js'
export type { IngestOptions } from './ingest-pipeline.js'
export {
  classifyFile,
  classifyFileAsync,
  classifyWithLLM,
  loadClassifyRules,
  clearClassifyRulesCache,
  moveFile,
} from './classify.js'
export type { ClassifyResult, ClassifyLLMDeps } from './classify.js'
export {
  validateWiki,
  checkPii,
  reindex as reindexWiki,
  reindexCheck,
  costTrackerSummary,
  costTrackerAdd,
} from './scripts-runner.js'
export type { ScriptResult } from './scripts-runner.js'
export {
  PROVIDER_CHAT_DEFAULTS,
  PROVIDER_VISION_DEFAULTS,
  CONTEXTUAL_DEFAULT_MODEL,
  DEFAULT_BASIC_PROVIDER,
  ANTHROPIC_PING_MODEL,
} from './provider-defaults.js'
