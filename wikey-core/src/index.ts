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
} from './types.js'

// Phase 5 §5.10.3 + §5.10.4 D-wide: schema gate public surface 폐기. canonicalizer 내부
// alias normalization (SLUG_ALIASES + .wikey/schema.yaml `aliases:` parser) 만 잔존.

export { parseWikeyConf, loadConfig, resolveProvider, getSearchTopN } from './config.js'
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
export { LLMClient, fetchModelList, SubscriptionFallbackError } from './llm-client.js'
export type { SubscriptionDeps } from './llm-client.js'
// §5.6.4 — auth-mode types surfaced for plugin Settings UI + Notice wiring.
export type {
  AuthMode,
  AuthPath,
  AuthFallbackInfo,
  SubscriptionProvider,
} from './types.js'
export { createPage, updateIndex, appendLog, extractWikilinks } from './wiki-ops.js'
export {
  computeGapScore,
  appendQueryLogEntry,
  loadQueryLogEntries,
  rankKnowledgeGaps,
  renderGapReportMarkdown,
  extractCreatedFromFrontmatter,
  validateClusterResultShape,
  computeGapStatistics,
  parseQueryLogRange,
  queryLogPathForYear,
} from './knowledge-gap.js'
export type {
  QueryLogEntry,
  KnowledgeGap,
  ClusterResult,
  TopicClusterer,
  GapStatistics,
  QueryLogRange,
} from './knowledge-gap.js'
export {
  query,
  buildCitationFromContent,
  collectCitationsWithWikiFS,
  collectCitationsFromFS,
  appendOriginalLinks,
} from './query-pipeline.js'
export type {
  QueryOptions,
  AppendOriginalLinksOptions,
  OriginalLinkMode,
} from './query-pipeline.js'
export {
  resolveSource,
  resolveSourceSync,
  resolvedAbsoluteFileUri,
} from './source-resolver.js'
export type {
  ResolvedSource,
  ResolveSourceOptions,
  SourceIdKind,
} from './source-resolver.js'
export {
  ingest,
  generateBrief,
  injectGuideHint,
  loadEffectiveIngestPrompt,
  loadEffectiveStage1Prompt,
  loadEffectiveStage2Prompt,
  loadEffectiveStage3Prompt,
  INGEST_PROMPT_PATH,
  STAGE1_SUMMARY_PROMPT_PATH,
  STAGE2_MENTION_PROMPT_PATH,
  STAGE3_CANONICALIZE_PROMPT_PATH,
  BUNDLED_INGEST_PROMPT,
  BUNDLED_STAGE2_MENTION_PROMPT,
  PlanRejectedError,
  IngestCancelledByUserError,
  IngestProtectionFailedError,
  assertNotWikiPath,
} from './ingest-pipeline.js'
export type {
  IngestOptions,
  PromptLoadResult,
  SkippedIngestResult,
} from './ingest-pipeline.js'
// Phase 5 §5.10.1 — pure conversion entry (PDF/HWP/DOCX/PPTX/md/txt 5 분기 통합).
export { convertSourceToMarkdown } from './conversion.js'
export type { ConversionResult, ConvertOpts } from './conversion.js'
// §5.3.1/§5.3.2 — incremental reingest helpers + types.
export {
  decideReingest,
  USER_MARKER_HEADERS,
  protectSidecarTargetPath,
  computeSidecarHash,
  IngestProtectionPathExhaustedError,
} from './incremental-reingest.js'
export type { ReingestDecision, ConflictInfo } from './incremental-reingest.js'
export type { ReingestAction, ConflictKind } from './source-registry.js'
export {
  classifyFile,
  classifyFileAsync,
  classifyWithLLM,
  loadClassifyRules,
  clearClassifyRulesCache,
  moveFile,
  movePair,
} from './classify.js'
export type { ClassifyResult, ClassifyLLMDeps, ClassifyFileOptions, MovePairResult, MovePairOptions } from './classify.js'
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
  pairedSidecarSet,
  hasSidecar,
  filterOutPairedSidecars,
  recountAuditAfterPairedExclude,
} from './paired-sidecar.js'
export type { AuditCountInput, AuditCountResult } from './paired-sidecar.js'
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
  reconcileAfterIngest,
  findRestoredIds,
  REGISTRY_PATH,
} from './source-registry.js'
export type { SourceRecord, SourceRegistry, PathHistoryEntry, WalkerEntry } from './source-registry.js'
export {
  injectSourceFrontmatter,
  rewriteSourcePageMeta,
  appendDeletedSourceBanner,
  injectProvenance,
} from './wiki-ops.js'
export type { SourceFrontmatter } from './wiki-ops.js'
export type { Citation, ProvenanceType, ProvenanceEntry } from './types.js'

// §5.19 — Wiki maintenance suite (status / check / recovery / refactoring).
export {
  getWikiStatus,
  runWikiCheck,
  applyWikiRecovery,
  getRefactoringSuggestions,
  slugSimilarity,
  // §5.19 v0.4 (R6/R10) — health predicates.
  isWikiHealthy,
  isRefactoringHealthy,
  // §5.19 v0.4 Batch 5 (R8 / G1) — broken wikilink fix (mode a).
  detectBrokenWikilinks,
  applyBrokenWikilinkFix,
  // §5.19 v0.5 R4/R6 — 5 카테고리 fix path 추가 (stale-tombstone / refactoring archive).
  applyStaleTombstoneCleanup,
  applyRefactoringArchive,
} from './wiki/maintenance.js'
export type {
  WikiStatus,
  WikiCheckReport,
  WikiRecoveryReport,
  RefactoringSuggestions,
  DuplicatePair,
  LowUtilityEntry,
  Finding,
  GetWikiStatusOptions,
  RunWikiCheckOptions,
  ApplyWikiRecoveryOptions,
  GetRefactoringSuggestionsOptions,
  BrokenWikilinkFixCandidate,
  BrokenWikilinkFixKind,
  BrokenWikilinkCandidate,
  BrokenWikilinkFixRequest,
  BrokenWikilinkFixReport,
  // §5.19 v0.5 R4/R6 — new apply option/report types.
  ApplyStaleTombstoneCleanupOptions,
  StaleTombstoneCleanupReport,
  ApplyRefactoringArchiveOptions,
  RefactoringArchiveReport,
} from './wiki/maintenance.js'
// §5.10.4 D-wide: §5.4 self-extending (suggestion / self-declaration / convergence) 메커니즘 폐기.
export {
  RenameGuard,
  reconcileExternalRename,
  handleExternalDelete,
} from './vault-events.js'
export type {
  ReconcileRenameOptions,
  ReconcileRenameResult,
  HandleDeleteOptions,
  HandleDeleteResult,
} from './vault-events.js'
export {
  computeDeletionImpact,
  previewReset,
  QMD_INDEX_MARKER,
  SETTINGS_MARKER,
} from './reset.js'
export type {
  DeletionTarget,
  DeletionImpact,
  ComputeDeletionImpactOptions,
  ResetScope,
  PreviewResetOptions,
  ResetPreview,
} from './reset.js'
export {
  validateWiki,
  checkPii,
  reindex as reindexWiki,
  reindexCheck,
  reindexQuick,
  reindexCheckJson,
  waitUntilFresh,
  costTrackerSummary,
  costTrackerAdd,
} from './scripts-runner.js'
export type { ScriptResult, ReindexCheckResult, ReindexFreshness } from './scripts-runner.js'
export {
  PROVIDER_CHAT_DEFAULTS,
  PROVIDER_VISION_DEFAULTS,
  CONTEXTUAL_DEFAULT_MODEL,
  DEFAULT_BASIC_PROVIDER,
  ANTHROPIC_PING_MODEL,
} from './provider-defaults.js'
export {
  detectPii,
  redactPii,
  applyPiiGate,
  PiiIngestBlockedError,
} from './pii-redact.js'
export type {
  PiiKind,
  PiiMatch,
  PiiRedactionMode,
  PiiGateOptions,
  PiiGateResult,
} from './pii-redact.js'
export {
  buildCapabilityMap,
  dumpCapabilityMap,
  defaultCapabilityCachePath,
} from './capability-map.js'
export type {
  SupportedExtensionMap,
  BuildCapabilityInput,
} from './capability-map.js'

// §5.15.D — wikilink-safe filename normalization (whitelist 정책).
export { sanitizeWikilinkTarget, needsWikilinkSanitize } from './wikilink-safe.js'

// §5.7.4 — Orama 검색 backend (production query path 의 tokenizer + 인덱스 lifecycle).
export { createKoreanTokenizer } from './search/orama-korean-tokenizer.js'
export type { KoreanTokenizerOptions, KoreanTokenizerHandle } from './search/orama-korean-tokenizer.js'
export { execOramaSearch } from './query-pipeline.js'
export {
  getOramaIndex,
  defaultOramaCachePath,
  resetOramaIndexForTest,
  disposeOramaIndex,
} from './search/orama-index-singleton.js'
export type {
  OramaIndexHandle,
  OramaWikiDoc,
  OramaSearchOptions,
  SearchResultWithMetadata,
} from './search/orama-index.js'

// §5.7.8 — LLM per-query dynamic stopword paradigm (filter + rewrite + expand + analyzer +
// vault customise). Public surface for wikey-obsidian to inject the layers into the
// existing search call path.
export {
  QueryIntentFilter,
  parseFilterResponse,
  DEFAULT_FILTER_TIMEOUT_MS,
  BUNDLED_QUERY_INTENT_FILTER_PROMPT,
} from './search/query-intent-filter.js'
export type {
  FilterDecision,
  TokenDecision,
  TokenRole,
  FilterFallback,
  QueryIntentFilterOptions,
  FilterLLM,
} from './search/query-intent-filter.js'

export {
  QueryRewriter,
  parseRewriteResponse,
  tokenEditRatio,
  DEFAULT_REWRITE_TIMEOUT_MS,
  MAX_REWRITE_EDIT_RATIO,
  BUNDLED_QUERY_REWRITER_PROMPT,
} from './search/query-rewriter.js'
export type {
  RewriteDecision,
  RewriteChange,
  RewriteFallback,
  QueryRewriterOptions,
} from './search/query-rewriter.js'

export {
  QueryExpander,
  parseExpandResponse,
  clampHydeLength,
  DEFAULT_EXPAND_TIMEOUT_MS,
  HYDE_MIN_CHARS,
  HYDE_MAX_CHARS,
  MULTI_QUERY_DEFAULT_N,
  BUNDLED_QUERY_EXPANDER_PROMPT,
} from './search/query-expander.js'
export type {
  ExpandDecision,
  ExpandFallback,
  QueryExpanderOptions,
} from './search/query-expander.js'

export {
  QueryAnalyzer,
  parseAnalyzerResponse,
  appendEntriesToSuite,
  AUTO_EXTENDED_SOURCE,
  DEFAULT_ANALYZER_TIMEOUT_MS,
  BUNDLED_QUERY_ANALYZER_PROMPT,
} from './search/query-analyzer.js'
export type {
  QueryAnswerPair,
  AutoExtendedEntry,
  AnalyzeResult,
  QueryAnalyzerOptions,
} from './search/query-analyzer.js'

export {
  QueryFilterCache,
  normalizeCacheKey,
  DEFAULT_CACHE_CAPACITY,
} from './search/query-filter-cache.js'
export type {
  CacheNamespace,
  QueryFilterCacheOptions,
} from './search/query-filter-cache.js'

export {
  parseVaultQueryHintYaml,
  buildVaultHintPromptBlock,
  loadVaultQueryConfig,
  EMPTY_VAULT_QUERY_HINT,
  VAULT_QUERY_CONFIG_PATH,
  VAULT_FILTER_PROMPT_PATH,
  VAULT_REWRITER_PROMPT_PATH,
  VAULT_EXPANDER_PROMPT_PATH,
} from './config/vault-query-config.js'
export type {
  VaultQueryHint,
  VaultFileReader,
  LoadVaultQueryConfigResult,
} from './config/vault-query-config.js'

// §5.7.5 — upstream update detect (재시작 1회) + LLM 분석 ([분석] 버튼).
export { detectUpstreamUpdates } from './update/upstream-checker.js'
export type {
  UpdateItemKind,
  UpdateItemDescriptor,
  UpdateCheckResult,
  DetectUpstreamUpdatesOptions,
} from './update/upstream-checker.js'
export { analyzeUpdate } from './update/update-analyzer.js'
export type { UpdateAnalysis, AnalyzeUpdateOptions } from './update/update-analyzer.js'

// §5.7.7 — Qwen3-Embedding loader + RRF fusion + dimension lock constants.
export { createQwen3Loader } from './embeddings/qwen3-loader.js'
export type { Qwen3Loader, Qwen3LoaderOptions, Qwen3InstallStatus } from './embeddings/qwen3-loader.js'
export {
  EMBEDDING_DIM,
  EMBEDDING_MODEL_DEFAULT,
  QWEN3_LICENSE,
} from './embeddings/embedding-config.js'
export { rrfFuse } from './search/rrf-fusion.js'
export type { RrfFuseOptions } from './search/rrf-fusion.js'
export type { EmbedderFn } from './search/orama-index.js'
