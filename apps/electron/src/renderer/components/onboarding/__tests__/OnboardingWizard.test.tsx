import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type {
  OnboardingState,
  OnboardingWizard as OnboardingWizardComponent,
} from '../OnboardingWizard'

// Onboarding imports the UI package, whose PDF viewer uses Vite's ?url suffix.
// Mock that browser-only asset before importing the wizard under Bun.
mock.module('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }))
mock.module('pdfjs-dist', () => ({ GlobalWorkerOptions: { workerSrc: '' }, getDocument: () => ({}) }))
mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

let OnboardingWizard: typeof OnboardingWizardComponent

beforeAll(async () => {
  // This test must dynamically import after the Vite-only asset mock above.
  ({ OnboardingWizard } = await import('../OnboardingWizard'))
})

const roxConnectState: OnboardingState = {
  step: 'rox-connect',
  loginStatus: 'idle',
  credentialStatus: 'idle',
  completionStatus: 'saving',
  apiSetupMethod: null,
  isExistingUser: false,
}

describe('OnboardingWizard', () => {
  test('renders the Rox Connect gate', () => {
    const html = renderToStaticMarkup(
      <OnboardingWizard
        state={roxConnectState}
        onContinue={() => {}}
        onBack={() => {}}
        onSelectApiSetupMethod={() => {}}
        onSubmitCredential={() => {}}
        onFinish={() => {}}
        roxConnectStatus="idle"
        onStartRoxConnect={() => {}}
        onOpenRoxConnectBrowser={() => {}}
      />,
    )

    expect(html).toContain('Sign in to Rox')
    expect(html).toContain('Connect with Rox')
  })
})
