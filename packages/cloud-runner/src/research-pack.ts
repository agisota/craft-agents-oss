/**
 * buildResearchSpec — deep-research prompt-pack generator.
 *
 * Turns a user's topic into the prepared subtask pack that a "Провести
 * доп. рисёрч" run executes in the cloud (PRD docs/cloud-runs-prd.md).
 * Product logic, provider-agnostic; subtask ids are stable for resume.
 */
import type { RunSpec } from './types.ts';

export interface ResearchPackOptions {
  /** Run id from the caller (idempotency key); default derived from topic+time. */
  id?: string;
  /** Session/session-context metadata merged into spec.metadata. */
  metadata?: Record<string, string>;
  model?: { connectionSlug?: string; modelId?: string };
  limits?: RunSpec['limits'];
  language?: 'en' | 'ru';
}

interface SubtaskTemplate {
  id: string;
  title: { en: string; ru: string };
  prompt: { en: string; ru: string };
}

const RESEARCH_SUBTASKS: SubtaskTemplate[] = [
  {
    id: 'landscape',
    title: { en: 'Topic landscape', ru: 'Общая карта темы' },
    prompt: {
      en: 'Map the landscape of this topic: key concepts, taxonomy, main players/projects, and how they relate. Topic: "%s". Output structured markdown.',
      ru: 'Составь карту темы: ключевые понятия, таксономия, основные игроки/проекты и их взаимосвязи. Тема: "%s". Результат — структурированный markdown на русском.',
    },
  },
  {
    id: 'state-of-the-art',
    title: { en: 'State of the art', ru: 'Текущее состояние' },
    prompt: {
      en: 'What is the current state of the art on this topic as of 2025-2026: recent developments, benchmarks, notable releases. Topic: "%s". Be specific with dates and versions where known.',
      ru: 'Каково текущее состояние темы на 2025-2026: свежие разработки, бенчмарки, заметные релизы. Тема: "%s". Конкретика: даты и версии, где известны.',
    },
  },
  {
    id: 'tradeoffs',
    title: { en: 'Tradeoffs and criticism', ru: 'Компромиссы и критика' },
    prompt: {
      en: 'Analyze tradeoffs, limitations, and criticism around this topic: known failure modes, costs, risks, counterarguments. Topic: "%s".',
      ru: 'Проанализируй компромиссы, ограничения и критику по теме: известные сбои, издержки, риски, контраргументы. Тема: "%s".',
    },
  },
  {
    id: 'alternatives',
    title: { en: 'Alternatives and comparisons', ru: 'Альтернативы и сравнения' },
    prompt: {
      en: 'Compare the main alternatives/competitors for this topic: decision matrix, when to choose which. Topic: "%s".',
      ru: 'Сравни основные альтернативы/конкурентов по теме: матрица решений, когда что выбирать. Тема: "%s".',
    },
  },
  {
    id: 'outlook',
    title: { en: 'Outlook and open questions', ru: 'Перспективы и открытые вопросы' },
    prompt: {
      en: 'Outline the outlook for this topic: trends, unresolved questions, what to watch next. Topic: "%s".',
      ru: 'Опиши перспективы темы: тренды, нерешённые вопросы, за чем следить дальше. Тема: "%s".',
    },
  },
];

export function buildResearchSpec(topic: string, opts: ResearchPackOptions = {}): RunSpec {
  const trimmed = topic.trim();
  if (!trimmed) throw new Error('research topic must not be empty');
  const lang = opts.language ?? 'ru';
  return {
    id: opts.id ?? `research-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: lang === 'ru' ? `Рисёрч: ${trimmed.slice(0, 60)}` : `Research: ${trimmed.slice(0, 60)}`,
    subtasks: RESEARCH_SUBTASKS.map((t) => ({
      id: t.id,
      title: t.title[lang],
      prompt: t.prompt[lang].replace('%s', trimmed),
    })),
    model: opts.model,
    limits: opts.limits,
    metadata: { kind: 'deep-research', topic: trimmed, ...opts.metadata },
  };
}
