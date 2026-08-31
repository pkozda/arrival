export type { HttpRequest, HttpResponse, HttpTransport, MockHttpHandler } from './http-transport.js';
export {
  createFetchHttpTransport,
  createMockHttpTransport,
} from './http-transport.js';

export type { ProductionSearchAdapterConfig } from './search/brave-search-adapter.js';
export {
  BRAVE_SEARCH_PROVIDER_ID,
  buildBraveQueryText,
  createBraveSearchAdapter,
  createProductionSearchAdapter,
} from './search/brave-search-adapter.js';

export type { ProductionFetchAdapterConfig } from './fetch/http-fetch-adapter.js';
export {
  HTTP_FETCH_PROVIDER_ID,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_ALLOWED_CONTENT_TYPES,
  createHttpFetchAdapter,
  createProductionFetchAdapter,
} from './fetch/http-fetch-adapter.js';

export type { ProductionContentExtractorConfig } from './extract/html-content-extractor.js';
export {
  DEFAULT_EXTRACT_ALLOWED_CONTENT_TYPES,
  DEFAULT_EXTRACT_MAX_RAW_BYTES,
  DEFAULT_MAX_VISIBLE_TEXT_CHARS,
  DEFAULT_MAX_LINKS,
  DEFAULT_MAX_HEADINGS,
  DEFAULT_MAX_JSON_LD_BLOCKS,
  createHtmlContentExtractor,
  createProductionContentExtractor,
} from './extract/html-content-extractor.js';

export type { ProductionVerificationAdapterConfig } from './verify/http-verification-adapter.js';
export {
  VERIFY_HTTP_PROVIDER_ID,
  createHttpVerificationAdapter,
  createProductionVerificationAdapter,
} from './verify/http-verification-adapter.js';

export type { ProductionAiAdapterConfig } from './ai/http-ai-adapter.js';
export {
  OPENAI_AI_PROVIDER_ID,
  createOpenAiAdapter,
  createProductionAiAdapter,
  parseProviderResponse,
  buildAiUserPayloadForTests,
  AI_SYSTEM_PROMPT_FOR_TESTS,
} from './ai/http-ai-adapter.js';

export type {
  ProductionEmailNotificationConfig,
  EmailNotificationConfig,
} from './notifications/email/resend-email-notification-adapter.js';
export {
  RESEND_EMAIL_PROVIDER_ID,
  RESEND_EMAIL_RATE_LIMIT_KEY,
  createProductionEmailNotificationAdapter,
  createResendEmailNotificationAdapter,
  createProductionEmailNotificationAdapterFromConfig,
} from './notifications/email/resend-email-notification-adapter.js';
export type { RenderedDiscoveryEmail } from './notifications/email/render-discovery-email.js';
export {
  renderDiscoveryEmail,
  escapeHtml,
  safeHttpUrl,
} from './notifications/email/render-discovery-email.js';

export type {
  ProductionTelegramNotificationConfig,
  TelegramNotificationConfig,
} from './notifications/telegram/telegram-notification-adapter.js';
export {
  TELEGRAM_PROVIDER_ID,
  TELEGRAM_RATE_LIMIT_KEY,
  createProductionTelegramNotificationAdapter,
  createTelegramNotificationAdapter,
  createProductionTelegramNotificationAdapterFromConfig,
  isValidTelegramChatId,
} from './notifications/telegram/telegram-notification-adapter.js';
export type { RenderedDiscoveryTelegram } from './notifications/telegram/render-discovery-telegram.js';
export {
  TELEGRAM_MAX_MESSAGE_LENGTH,
  renderDiscoveryTelegram,
} from './notifications/telegram/render-discovery-telegram.js';

export type {
  DiscoveryProductionConfig,
  DiscoveryProductionConfigValidation,
  LoadDiscoveryProductionConfigOptions,
  ProductionDiscoveryAdapters,
  RedactedDiscoveryProductionConfig,
} from './production/production-composition.js';
export {
  createProductionDiscoveryAdapters,
  loadDiscoveryProductionConfig,
  redactDiscoveryProductionConfig,
  validateDiscoveryProductionConfig,
} from './production/production-composition.js';

export type {
  DiscoveryResultRecordV1,
} from './persistence/index.js';
export {
  DISCOVERY_RESULT_RECORD_SCHEMA_VERSION,
  serializeDiscoveryResult,
  deserializeDiscoveryResult,
  createSqliteResultPersistence,
} from './persistence/index.js';
export type {
  SqliteResultPersistenceConfig,
  SqliteResultPersistence,
  SqliteSchedulerPersistenceConfig,
  SqliteSchedulerPersistence,
  SqliteNotificationPersistenceConfig,
  SqliteNotificationPersistence,
} from './persistence/index.js';
export {
  DISCOVERY_SCHEDULER_SCHEMA_VERSION,
  createSqliteSchedulerPersistence,
  DISCOVERY_NOTIFICATION_SCHEMA_VERSION,
  createSqliteNotificationPersistence,
} from './persistence/index.js';
