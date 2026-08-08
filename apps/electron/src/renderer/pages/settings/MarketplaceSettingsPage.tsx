/**
 * Legacy Marketplace settings entry — redirects to Extension Center (S-05 / W5).
 * Kept so deep-links and imports of MarketplaceSettingsPage remain stable.
 */

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate, routes } from '@/lib/navigate'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import ExtensionsSettingsPage from './ExtensionsSettingsPage'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'marketplace',
}

/** Thin redirect: prefer Settings → Extensions. */
export default function MarketplaceSettingsPage() {
  const { t } = useTranslation()

  useEffect(() => {
    navigate(routes.view.settings('extensions'))
  }, [])

  // Render Extensions immediately so flash is content-full, not empty.
  return (
    <div className="contents" data-legacy-marketplace-redirect="1" title={t('settings.marketplace.redirect', { defaultValue: 'Redirecting to Extensions…' })}>
      <ExtensionsSettingsPage />
    </div>
  )
}
