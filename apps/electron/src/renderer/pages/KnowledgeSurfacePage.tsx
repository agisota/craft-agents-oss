/**
 * KnowledgeSurfacePage
 *
 * Host surface for an embedded SiYuan desktop instance panel (W2 Knowledge mode).
 * Mirrors pages/BrowserPanelPage.tsx point-for-point: the main process composites
 * a native WebContentsView (SiYuan web build) on top of this surface; this
 * component resolves/owns the instance via `siyuanEngine.createEmbedded` and
 * reports its DOM rect + focus state so main can position or hide the view.
 *
 * Instance identity: durableKey `siyuan:{kind}:{id}` — stable per document, so
 * the compositor dedups re-opens and restores surfaces across restarts. Surface
 * mode (editor/graph/…) is presentation-only and does not change the durable key.
 *
 * P4.1 surface modes: optional `mode` (editor|graph|global-graph|outline|backlinks)
 * drives URL query markers and a thin Craft toolbar. Non-editor modes evaluate
 * SIYUAN_OPEN_DOCK_SCRIPT once after load (~800ms) to open SiYuan docks. Toolbar
 * switches prefer in-page `location.href` evaluate + dock script over recreate.
 *
 * Compat view: `routes.view.siyuan({ kind: 'notebook', id: '__full__' })` (or the
 * `compat` prop) renders the same full-UI surface with a hint banner; the
 * sentinel id keeps its durableKey distinct from any real document instance.
 */

import * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { focusedPanelIdAtom } from '@/atoms/panel-stack'
import { useAppShellContext } from '@/context/AppShellContext'
import { isKnowledgeFeatureEnabled } from '@/lib/feature-flags'
import { cn } from '@/lib/utils'
import {
  buildSiyuanDurableKey,
  buildSiyuanSurfaceUrl,
  DEFAULT_BASE_URL,
  isSiyuanCompatRef,
  needsSiyuanDockOpen,
  SIYUAN_OPEN_DOCK_SCRIPT,
  type SiyuanSurfaceMode,
  type SiyuanSurfaceRef,
} from '@/knowledge/siyuan-url'

const DOCK_OPEN_DELAY_MS = 800

const SURFACE_TOOLBAR_MODES: Array<{
  mode: SiyuanSurfaceMode
  labelKey: string
}> = [
  { mode: 'outline', labelKey: 'knowledge.surface.toolbar.structure' },
  { mode: 'backlinks', labelKey: 'knowledge.surface.toolbar.backlinks' },
  { mode: 'graph', labelKey: 'knowledge.surface.toolbar.graph' },
  { mode: 'global-graph', labelKey: 'knowledge.surface.toolbar.globalGraph' },
  { mode: 'editor', labelKey: 'knowledge.surface.toolbar.editor' },
]

export interface KnowledgeSurfacePageProps {
  /** SiYuan ref kind from the knowledge route details (document/notebook/...), */
  kind: SiyuanSurfaceRef['kind']
  /** SiYuan ref id (document id; '__full__' sentinel = compat surface) */
  id: string
  /** Owning panel id in the panel stack (used to hide when unfocused) */
  panelId?: string
  /** Explicit compat full-interface surface (else auto-detected from id) */
  compat?: boolean
  /** Presentation mode — editor default; graph/outline/backlinks open docks */
  mode?: SiyuanSurfaceMode
}

export default function KnowledgeSurfacePage({
  kind,
  id,
  panelId,
  compat,
  mode: modeProp = 'editor',
}: KnowledgeSurfacePageProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const baseUrlRef = useRef(DEFAULT_BASE_URL)
  const surfaceModeRef = useRef<SiyuanSurfaceMode>(modeProp)
  const dockOpenedForKeyRef = useRef<string | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)
  const [surfaceMode, setSurfaceMode] = useState<SiyuanSurfaceMode>(modeProp)
  const focusedPanelId = useAtomValue(focusedPanelIdAtom)
  const { activeWorkspaceId } = useAppShellContext()
  // Evaluated once at hook scope (P1-9): when the feature is off, effects
  // early-return — no listConnections, no createEmbedded, no registry entries
  // — and the render below shows the disabled copy instead of the surface.
  const [knowledgeEnabled] = useState(() => isKnowledgeFeatureEnabled())
  // Without a panelId (rendered outside the panel stack) assume focused.
  const isFocused = panelId === undefined || focusedPanelId === panelId

  const ref = useMemo<SiyuanSurfaceRef>(() => ({ kind, id }), [kind, id])
  const isCompat = compat === true || isSiyuanCompatRef(ref)

  surfaceModeRef.current = surfaceMode

  const runDockOpen = useCallback(async (targetInstanceId: string, mode: SiyuanSurfaceMode) => {
    if (!needsSiyuanDockOpen(mode)) {
      dockOpenedForKeyRef.current = `${targetInstanceId}:editor`
      return
    }
    const openKey = `${targetInstanceId}:${mode}`
    if (dockOpenedForKeyRef.current === openKey) return
    dockOpenedForKeyRef.current = openKey
    try {
      await window.electronAPI.siyuanEngine.evaluate({
        instanceId: targetInstanceId,
        expression: SIYUAN_OPEN_DOCK_SCRIPT,
      })
    } catch {
      // Dock open is best-effort — SiYuan DOM may not be ready / selectors may miss.
      dockOpenedForKeyRef.current = null
    }
  }, [])

  const navigateToMode = useCallback(
    async (targetInstanceId: string, next: SiyuanSurfaceMode) => {
      const nextUrl = buildSiyuanSurfaceUrl(baseUrlRef.current, ref, { mode: next })
      await window.electronAPI.siyuanEngine.evaluate({
        instanceId: targetInstanceId,
        expression: `window.location.href = ${JSON.stringify(nextUrl)}`,
      })
      dockOpenedForKeyRef.current = null
      if (needsSiyuanDockOpen(next)) {
        window.setTimeout(() => {
          void runDockOpen(targetInstanceId, next)
        }, DOCK_OPEN_DELAY_MS)
      }
    },
    [ref, runDockOpen],
  )

  // Controlled mode prop (session graph/mindmap tabs) — navigate in-place when live.
  useEffect(() => {
    if (modeProp === surfaceModeRef.current) return
    setSurfaceMode(modeProp)
    const liveId = instanceId
    if (!liveId) return
    void navigateToMode(liveId, modeProp).catch(() => {
      // Best-effort; next create path still carries mode via URL if remounted.
    })
  }, [modeProp, instanceId, navigateToMode])

  // Resolve the base URL and create (or re-attach to) the durable instance once per ref.
  useEffect(() => {
    if (!knowledgeEnabled) return
    let cancelled = false
    // P1-7: the instance id is captured locally so it can be destroyed even
    // when React never hands it to state (unmount/re-key racing the async
    // create). `released` guards against double-destroy with the [instanceId]
    // destroy effect below, which owns cleanup once the id is handed off.
    let createdId: string | null = null
    let released = false
    const releaseOrphan = () => {
      if (createdId === null || released) return
      released = true
      const orphanId = createdId
      void (async () => {
        try {
          await window.electronAPI.siyuanEngine.syncBounds({ instanceId: orphanId, rect: null })
        } catch {
          // Best-effort hide; instance cleanup continues regardless
        }
        try {
          await window.electronAPI.siyuanEngine.destroy({ instanceId: orphanId })
        } catch {
          // Instance may already be gone (window teardown)
        }
      })()
    }
    void (async () => {
      try {
        const connections = await window.electronAPI.knowledge.listConnections()
        if (cancelled) return
        const baseUrl = connections.find((c) => c.baseUrl)?.baseUrl ?? DEFAULT_BASE_URL
        baseUrlRef.current = baseUrl
        const url = buildSiyuanSurfaceUrl(baseUrl, ref, { mode: surfaceModeRef.current })
        createdId = await window.electronAPI.siyuanEngine.createEmbedded({
          durableKey: buildSiyuanDurableKey(ref),
          url,
          workspaceId: activeWorkspaceId,
        })
        if (cancelled) {
          // Unmounted (or re-keyed) while main was creating the native view —
          // the destroy effect never saw this id, so release it here.
          releaseOrphan()
          return
        }
        released = true // ownership moves to the [instanceId] destroy effect
        setInstanceId(createdId)
        setError(null)
        setRemoved(false)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
      releaseOrphan()
    }
  }, [knowledgeEnabled, ref, activeWorkspaceId])

  // After createEmbedded, open the dock once for non-editor modes.
  useEffect(() => {
    if (!instanceId || !needsSiyuanDockOpen(surfaceMode)) return
    const timer = window.setTimeout(() => {
      void runDockOpen(instanceId, surfaceMode)
    }, DOCK_OPEN_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [instanceId, surfaceMode, runDockOpen])

  const handleModeChange = useCallback(
    (next: SiyuanSurfaceMode) => {
      if (next === surfaceMode) return
      setSurfaceMode(next)
      const liveId = instanceId
      if (!liveId) return
      void navigateToMode(liveId, next).catch(() => {
        // Ignore evaluate failures — toolbar state already updated.
      })
    },
    [surfaceMode, instanceId, navigateToMode],
  )

  // Push current bounds (or null when hidden) to the main process
  const syncBounds = useCallback(() => {
    if (!instanceId) return
    const el = containerRef.current
    if (!el || !isFocused || removed) {
      window.electronAPI.siyuanEngine.syncBounds({ instanceId, rect: null })
      return
    }
    const rect = el.getBoundingClientRect()
    window.electronAPI.siyuanEngine.syncBounds({
      instanceId,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    })
  }, [instanceId, isFocused, removed])

  // rAF-throttled bounds sync
  const scheduleSync = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      syncBounds()
    })
  }, [syncBounds])

  // Observe geometry changes: element resize, window resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(scheduleSync)
    observer.observe(el)
    window.addEventListener('resize', scheduleSync)
    scheduleSync()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scheduleSync)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
  }, [scheduleSync])

  // Re-sync when focus or removal state flips (hide when unfocused, restore when focused)
  useEffect(() => {
    scheduleSync()
  }, [isFocused, removed, scheduleSync])

  // Track instance lifecycle: show placeholder if main reports this id removed
  useEffect(() => {
    if (!instanceId) return
    const offRemoved = window.electronAPI.siyuanEngine.onRemoved((removedId) => {
      if (removedId === instanceId) setRemoved(true)
    })
    const offStateChanged = window.electronAPI.siyuanEngine.onStateChanged((state) => {
      if (state.instanceId === instanceId) setRemoved(false)
    })
    return () => {
      offRemoved()
      offStateChanged()
    }
  }, [instanceId])

  // Unmount: hide the composited view, then destroy the embedded instance
  // (mirrors BrowserPanelPage: panel close semantics own instance lifetime).
  useEffect(() => {
    return () => {
      if (!instanceId) return
      void (async () => {
        try {
          await window.electronAPI.siyuanEngine.syncBounds({ instanceId, rect: null })
        } catch {
          // Best-effort hide; instance cleanup continues regardless
        }
        try {
          await window.electronAPI.siyuanEngine.destroy({ instanceId })
        } catch {
          // Instance may already be gone (window teardown)
        }
      })()
    }
  }, [instanceId])

  const fullSurface = <div ref={containerRef} className="h-full w-full bg-background" />

  const toolbar =
    knowledgeEnabled && instanceId ? (
      <div
        className="flex items-center gap-1 border-b border-border px-2 py-1"
        role="toolbar"
        aria-label={t('knowledge.surface.toolbar.label')}
      >
        {SURFACE_TOOLBAR_MODES.map(({ mode: m, labelKey }) => {
          const active = surfaceMode === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => handleModeChange(m)}
              className={cn(
                'rounded-md px-2 py-0.5 text-xs transition-colors',
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
              aria-pressed={active}
            >
              {t(labelKey)}
            </button>
          )
        })}
      </div>
    ) : null

  if (!knowledgeEnabled) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-background px-6 text-center text-muted-foreground">
        <p className="text-sm font-medium">{t('knowledge.featureDisabled.title')}</p>
        <p className="text-sm">{t('knowledge.featureDisabled.body')}</p>
        <p className="text-xs">{t('knowledge.featureDisabled.envHint')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-background text-muted-foreground">
        <p className="text-sm">{t('knowledge.surface.error', { defaultValue: 'Failed to open knowledge surface' })}</p>
      </div>
    )
  }

  if (removed) {
    // Deliberate teardown (main broadcast REMOVED), not a load failure.
    return (
      <div className="flex items-center justify-center h-full w-full bg-background text-muted-foreground">
        <p className="text-sm">{t('knowledge.surface.removed')}</p>
      </div>
    )
  }

  if (!instanceId) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-background text-muted-foreground">
        <p className="text-sm">{t('knowledge.surface.loading')}</p>
      </div>
    )
  }

  if (isCompat) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <div className="border-b border-border px-3 py-1 text-xs text-muted-foreground">
          {t('knowledge.surface.compatHint')}
        </div>
        {toolbar}
        <div className="relative min-h-0 flex-1">{fullSurface}</div>
      </div>
    )
  }

  // Full-size surface for the native view to cover (+ optional mode toolbar)
  if (toolbar) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        {toolbar}
        <div className="relative min-h-0 flex-1">{fullSurface}</div>
      </div>
    )
  }

  return fullSurface
}
