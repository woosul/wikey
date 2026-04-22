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
export { stripEmbeddedImages, countEmbeddedImages } from './rag-preprocess.js'
export { scoreConvertOutput, hasMissingKoreanWhitespace } from './convert-quality.js'
export type { QualityResult, QualityOptions } from './convert-quality.js'
export {
  computeCacheKey,
  getCached,
  setCached,
  invalidate as invalidateConvertCache,
  cleanup as cleanupConvertCache,
  stats as convertCacheStats,
} from './convert-cache.js'
export type { CacheKeyInput, CacheIndexEntry } from './convert-cache.js'
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
  movePair,
} from './classify.js'
export type { ClassifyResult, ClassifyLLMDeps, MovePairResult, MovePairOptions } from './classify.js'
export {
  computeFileId,
  computeBundleId,
  computeExternalId,
  computeFullHash,
  buildObsidianOpenUri,
  buildFileUri,
  formatDisplayPath,
  verifyFullHash,
  sidecarVaultPath,
} from './uri.js'
export type { BundleEntry } from './uri.js'
export {
  loadRegistry,
  saveRegistry,
  findById as registryFindById,
  findByIdPrefix as registryFindByIdPrefix,
  findByPath as registryFindByPath,
  findByHash as registryFindByHash,
  upsert as registryUpsert,
  recordMove as registryRecordMove,
  recordDelete as registryRecordDelete,
  restoreTombstone as registryRestoreTombstone,
  reconcile as registryReconcile,
  REGISTRY_PATH,
} from './source-registry.js'
export type { SourceRecord, SourceRegistry, PathHistoryEntry, WalkerEntry } from './source-registry.js'
export { injectSourceFrontmatter, rewriteSourcePageMeta } from './wiki-ops.js'
export type { SourceFrontmatter } from './wiki-ops.js'
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
