/**
 * OmniboxHost — mounts the palette, bootstraps registries, wires app.omnibox.
 *
 * Place near DismissibleLayerProvider in App.tsx (inside ActionRegistryProvider
 * so useAction / useActionRegistry are available).
 *
 * Residual (documented, out of W3 exit scope): embedded SiYuan webContents
 * ⌘K interception via main global-input-router — renderer ⌘K is enough for exit.
 */

import { useEffect, useMemo } from 'react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { useAction, useActionRegistry } from '@/actions'
import { omniboxOpenAtom } from '@/atoms/omnibox'
import {
  bootstrapOmnibox,
  getOmniboxPlatform,
  setOmniboxActionExecutor,
} from './omnibox-bootstrap'
import { Omnibox } from './Omnibox'

export function OmniboxHost() {
  const { t } = useTranslation()
  const [open, setOpen] = useAtom(omniboxOpenAtom)
  const { execute, getHotkeyDisplay } = useActionRegistry()

  // Bridge ActionRegistry.execute into command contributions
  useEffect(() => {
    setOmniboxActionExecutor(execute)
  }, [execute])

  // Idempotent registry bootstrap (localized settings labels)
  const platform = useMemo(() => {
    return bootstrapOmnibox({
      t: (key, fallback) => {
        const value = t(key, { defaultValue: fallback })
        return typeof value === 'string' ? value : fallback
      },
    })
  }, [t])

  // Ensure platform exists even if memo skipped
  useEffect(() => {
    void getOmniboxPlatform()
  }, [])

  // ⌘K / mod+k via existing action hotkey system (definitions: app.omnibox)
  useAction('app.omnibox', () => {
    setOpen(true)
  })

  return (
    <Omnibox
      open={open}
      onOpenChange={setOpen}
      commands={platform.commands}
      resources={platform.resources}
      contextKeys={platform.contextKeys}
      getHotkeyDisplay={getHotkeyDisplay}
    />
  )
}
