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
export { LLMClient } from './llm-client.js'
export { createPage, updateIndex, appendLog, extractWikilinks } from './wiki-ops.js'
export { query } from './query-pipeline.js'
export { ingest } from './ingest-pipeline.js'
