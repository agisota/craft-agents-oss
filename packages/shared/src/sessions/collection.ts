/**
 * Browser-safe session collection contracts and query helpers.
 *
 * This surface deliberately excludes session storage, JSONL, bundles,
 * validation, and collection-display persistence.
 */

export type {
  SessionPriority,
  CollectionViewMode,
  CollectionGroupBy,
  CollectionOrderBy,
  CollectionOrderDir,
  CollectionProperty,
  CollectionDisplay,
  DueRange,
  CollectionFilters,
} from './collection-types.ts'
export {
  DEFAULT_COLLECTION_DISPLAY,
  DEFAULT_COLLECTION_FILTERS,
  COLLECTION_GROUP_BY_VALUES,
  COLLECTION_ORDER_BY_VALUES,
  COLLECTION_PROPERTY_VALUES,
} from './collection-types.ts'

export type {
  CollectionSessionMeta,
  FilterSessionMetaOptions,
  DueBucket,
} from './collection-query.ts'
export {
  priorityWeight,
  localDayBounds,
  dueBucket,
  filterSessionMeta,
  compareSessions,
  querySessionMetas,
} from './collection-query.ts'

export {
  LEXORANK_MAX_LENGTH,
  lexorankValidate,
  lexorankBetween,
  lexorankN,
  backfillRanks,
} from './lexorank.ts'
