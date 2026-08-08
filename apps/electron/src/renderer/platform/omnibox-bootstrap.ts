/**
 * Omnibox bootstrap (W3) — module-level singletons + provider/command registration.
 *
 * - CommandRegistry + ResourceProviderRegistry + ContextKeyService
 * - Bridges existing `actions` definitions as craft CommandContributions
 * - Registers minimal resource providers (sessions/settings/skills/sources/knowledge/automations)
 * - knowledge.search / knowledge.openHome commands
 *
 * Called once from OmniboxHost on mount. Safe to call multiple times (idempotent).
 */

import {
  createCommandRegistry,
  createContextKeyService,
  createResourceProviderRegistry,
  type CommandContribution,
  type CommandRegistry,
  type ContextKeyService,
  type ResourceProviderRegistry,
} from '@craft-agent/core/platform'
import { getDefaultStore } from 'jotai'
import { actions, type ActionId } from '@/actions/definitions'
import {
  sessionMetaMapAtom,
  windowWorkspaceIdAtom,
} from '@/atoms/sessions'
import { skillsAtom } from '@/atoms/skills'
import { sourcesAtom } from '@/atoms/sources'
import { automationsAtom } from '@/atoms/automations'
import { navigate, routes } from '@/lib/navigate'
import { SETTINGS_PAGES, type SettingsSubpage } from '../../shared/settings-registry'
import {
  searchKnowledge,
  resolveKnowledgeApi,
} from '@/knowledge/KnowledgeHome'
import {
  createAutomationsProvider,
  createKnowledgeProvider,
  createSessionsProvider,
  createSettingsProvider,
  createSkillsProvider,
  createSourcesProvider,
} from './omnibox-providers'

export interface OmniboxPlatform {
  commands: CommandRegistry
  resources: ResourceProviderRegistry
  contextKeys: ContextKeyService
}

let platform: OmniboxPlatform | null = null
let actionExecute: ((actionId: ActionId) => void) | null = null
let bootstrapped = false
const disposables: Array<{ dispose(): void }> = []

/** Access the shared omnibox platform (creates empty registries if needed). */
export function getOmniboxPlatform(): OmniboxPlatform {
  if (!platform) {
    platform = {
      commands: createCommandRegistry(),
      resources: createResourceProviderRegistry(),
      contextKeys: createContextKeyService(),
    }
  }
  return platform
}

/**
 * Provide the live ActionRegistry.execute so command contributions can dispatch
 * through the existing hotkey/handler system (no second executor).
 */
export function setOmniboxActionExecutor(execute: (actionId: ActionId) => void): void {
  actionExecute = execute
}

/** Optional i18n label resolver for settings pages (defaults to id). */
export type LabelResolver = (key: string, fallback: string) => string

/**
 * Idempotent bootstrap: register craft actions as commands + resource providers.
 * Pass `t` for localized settings labels when available.
 */
export function bootstrapOmnibox(options?: { t?: LabelResolver }): OmniboxPlatform {
  const p = getOmniboxPlatform()
  if (bootstrapped) return p
  bootstrapped = true

  registerActionCommands(p.commands)
  registerKnowledgeCommands(p.commands)
  registerResourceProviders(p.resources, options?.t)

  return p
}

/** Test-only reset. */
export function __resetOmniboxBootstrapForTests(): void {
  for (const d of disposables.splice(0)) {
    try {
      d.dispose()
    } catch {
      /* ignore */
    }
  }
  platform = null
  actionExecute = null
  bootstrapped = false
}

function track(d: { dispose(): void }): void {
  disposables.push(d)
}

function scopeToWhen(scope: string | undefined): string | undefined {
  if (!scope || scope === 'global') return undefined
  if (scope === 'chat') return 'chatFocus'
  if (scope === 'navigator') return 'navigatorFocus'
  if (scope === 'sidebar') return 'sidebarFocus'
  return undefined
}

function registerActionCommands(commands: CommandRegistry): void {
  for (const def of Object.values(actions)) {
    const action = def as {
      id: string
      label: string
      category: string
      description?: string
      defaultHotkey: string | null
      scope?: string
      when?: string
    }
    const actionId = action.id as ActionId
    const whenParts = [action.when, scopeToWhen(action.scope)].filter(Boolean) as string[]
    const when = whenParts.length === 0 ? undefined : whenParts.join(' && ')

    const contribution: CommandContribution = {
      id: action.id,
      title: action.label,
      category: action.category,
      source: 'craft',
      when,
      keywords: action.description ? [action.description] : undefined,
      defaultHotkey: action.defaultHotkey ?? undefined,
      async execute() {
        actionExecute?.(actionId)
      },
    }
    try {
      track(commands.register(contribution))
    } catch (err) {
      console.error('[omnibox] failed to register action command', action.id, err)
    }
  }
}

function registerKnowledgeCommands(commands: CommandRegistry): void {
  const openHome: CommandContribution = {
    id: 'knowledge.openHome',
    title: 'Open Knowledge',
    category: 'Knowledge',
    source: 'craft',
    keywords: ['knowledge', 'siyuan', 'notes', 'docs'],
    async execute() {
      navigate(routes.view.knowledge())
    },
  }
  const search: CommandContribution = {
    id: 'knowledge.search',
    title: 'Search Knowledge',
    category: 'Knowledge',
    source: 'craft',
    keywords: ['knowledge', 'search', 'find', 'docs'],
    async execute() {
      navigate(routes.view.knowledge())
    },
  }
  try {
    track(commands.register(openHome))
    track(commands.register(search))
  } catch (err) {
    console.error('[omnibox] failed to register knowledge commands', err)
  }
}

function registerResourceProviders(
  resources: ResourceProviderRegistry,
  t?: LabelResolver,
): void {
  const store = getDefaultStore()

  track(
    resources.register(
      createSessionsProvider(
        () => Array.from(store.get(sessionMetaMapAtom).values()),
        (id) => routes.view.allSessions(id),
      ),
    ),
  )

  const pages = SETTINGS_PAGES.map((page) => ({
    id: page.id,
    label: t ? t(page.labelKey, page.id) : page.id,
    description: t ? t(page.descriptionKey, '') : undefined,
  }))
  track(
    resources.register(
      createSettingsProvider(pages, (id) => routes.view.settings(id as SettingsSubpage)),
    ),
  )

  track(
    resources.register(
      createSkillsProvider(
        () => store.get(skillsAtom),
        (slug) => routes.view.skills(slug),
      ),
    ),
  )

  track(
    resources.register(
      createSourcesProvider(
        () => store.get(sourcesAtom),
        (slug) => routes.view.sources({ sourceSlug: slug }),
      ),
    ),
  )

  track(
    resources.register(
      createAutomationsProvider(
        () => store.get(automationsAtom),
        (id) => routes.view.automations({ automationId: id }),
      ),
    ),
  )

  track(
    resources.register(
      createKnowledgeProvider(async (query, signal) => {
        if (signal?.aborted) return null
        const api = resolveKnowledgeApi()
        const ws = store.get(windowWorkspaceIdAtom)
        if (!ws) return null
        if (signal?.aborted) return null
        const hits = await searchKnowledge(api, ws, query)
        if (!hits) return null
        return hits.map((hit) => ({
          ref: { kind: hit.ref.kind, id: hit.ref.id },
          title: hit.title,
          snippet: hit.snippet,
          notebookPath: hit.notebookPath,
          score: hit.score,
        }))
      }),
    ),
  )
}
