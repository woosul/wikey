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
  QueryResult,
  SearchResult,
} from './types.js'

export { parseWikeyConf, loadConfig, resolveProvider } from './config.js'
export { LLMClient, fetchModelList } from './llm-client.js'
export { createPage, updateIndex, appendLog, extractWikilinks } from './wiki-ops.js'
export { query } from './query-pipeline.js'
export type { QueryOptions } from './query-pipeline.js'
export { ingest } from './ingest-pipeline.js'
export type { IngestOptions } from './ingest-pipeline.js'
export { classifyFile, moveFile } from './classify.js'
export type { ClassifyResult } from './classify.js'
export {
  validateWiki,
  checkPii,
  reindex as reindexWiki,
  reindexCheck,
  costTrackerSummary,
  costTrackerAdd,
} from './scripts-runner.js'
export type { ScriptResult } from './scripts-runner.js'
