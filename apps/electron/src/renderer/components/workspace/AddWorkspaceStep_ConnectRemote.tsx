import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, CheckCircle, XCircle, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { prepareRemoteWorkspace, type RemoteServerBinding } from "./remote-workspace-create"
import { needsRemoteTlsInspect, tlsTrustFromDecision } from "./remote-tls-connect"
import type { RemoteTlsTrust } from "../../../shared/types"
import { Input } from "../ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { AddWorkspaceContainer, AddWorkspaceStepHeader, AddWorkspacePrimaryButton, AddWorkspaceSecondaryButton } from "./primitives"

const CREATE_NEW_VALUE = '__create_new__'


interface AddWorkspaceStep_ConnectRemoteProps {
  onBack: () => void
  onCreate: (folderPath: string, name: string, remoteServer: RemoteServerBinding) => Promise<void>
  isCreating: boolean
  /** Pre-fill the server URL (for reconnect flow) */
  initialUrl?: string
  /** Pre-fill the token (for reconnect flow) */
  initialToken?: string
  /** Durable SSH host id, set when reconnecting an SSH-backed workspace (persisted
   * so restarts resolve a fresh tunnel instead of dialing the ephemeral url). */
  sshHostId?: string
  /** When set, updating an existing workspace's remote config instead of creating */
  reconnectWorkspace?: { id: string; name: string; remoteWorkspaceId: string }
  /** Called when reconnect updates the remote server config */
  onUpdate?: (workspaceId: string, remoteServer: RemoteServerBinding) => Promise<void>
}

/**
 * AddWorkspaceStep_ConnectRemote - Connect to a remote Craft Agent Server
 *
 * Two paths:
 * 1. Connect to existing workspace — select from dropdown, no name needed, auto-resolve local slug
 * 2. Create new workspace — type a name, creates on server, then connects
 */
export function AddWorkspaceStep_ConnectRemote({
  onBack,
  onCreate,
  isCreating,
  initialUrl,
  initialToken,
  sshHostId,
  reconnectWorkspace,
  onUpdate,
}: AddWorkspaceStep_ConnectRemoteProps) {
  const { t } = useTranslation()
  const isReconnectMode = !!reconnectWorkspace
  const [serverUrl, setServerUrl] = useState(initialUrl ?? '')
  const [token, setToken] = useState(initialToken ?? '')
  const [homeDir, setHomeDir] = useState('')
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [remoteWorkspaces, setRemoteWorkspaces] = useState<Array<{ id: string; name: string }>>([])
  const [selectedValue, setSelectedValue] = useState<string | null>(null) // workspace ID or CREATE_NEW_VALUE
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [serverVersion, setServerVersion] = useState<string | null>(null)
  const [tlsGate, setTlsGate] = useState<'none' | 'inspecting' | 'review' | 'rollover'>('none')
  const [pendingInspect, setPendingInspect] = useState<{ nonce: string; origin: string; spkiSha256: string } | null>(null)
  const [tlsTrust, setTlsTrust] = useState<RemoteTlsTrust | undefined>(undefined)
  const selectPortalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.getHomeDir().then(setHomeDir)
  }, [])

  const isCreateNew = selectedValue === CREATE_NEW_VALUE
  const selectedWorkspace = !isCreateNew ? remoteWorkspaces.find(w => w.id === selectedValue) : null
  // Fresh server (no workspaces at all) — always in create mode
  const isFreshServer = testState === 'ok' && remoteWorkspaces.length === 0

  // Reset test state when URL or token changes
  useEffect(() => {
    setTestState('idle')
    setTestError(null)
    setRemoteWorkspaces([])
    setSelectedValue(null)
    setNewWorkspaceName('')
    setServerVersion(null)
    setTlsGate('none')
    setPendingInspect(null)
    setTlsTrust(undefined)
  }, [serverUrl, token])

  const applyTestResult = (result: Awaited<ReturnType<typeof window.electronAPI.testRemoteConnection>>) => {
    if (result.ok) {
      setTestState('ok')
      setServerVersion(result.serverVersion ?? null)
      if (result.needsWorkspace) {
        setRemoteWorkspaces([])
        setSelectedValue(null)
      } else {
        const workspaces = result.remoteWorkspaces ?? []
        setRemoteWorkspaces(workspaces)
        if (workspaces.length === 1) {
          setSelectedValue(workspaces[0]!.id)
        }
      }
    } else {
      setTestState('error')
      setTestError(result.error || 'Connection failed')
    }
  }

  const runTokenBearingTest = useCallback(async () => {
    if (!serverUrl || !token) return
    setTestState('testing')
    setTestError(null)
    try {
      const result = await window.electronAPI.testRemoteConnection(serverUrl, token)
      applyTestResult(result)
    } catch (err) {
      setTestState('error')
      setTestError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [serverUrl, token])

  const handleTestConnection = useCallback(async () => {
    if (!serverUrl || !token) return
    setTestError(null)
    setTlsTrust(undefined)
    setPendingInspect(null)
    if (needsRemoteTlsInspect(serverUrl, sshHostId)) {
      setTlsGate('inspecting')
      setTestState('testing')
      try {
        const { nonce, result } = await window.electronAPI.remoteTlsInspect(serverUrl)
        setPendingInspect({ nonce, origin: result.origin, spkiSha256: result.spkiSha256 })
        setTlsGate('review')
        setTestState('idle')
      } catch (err) {
        setTlsGate('none')
        setTestState('error')
        setTestError(err instanceof Error ? err.message : t('workspace.tlsInspectFailed'))
      }
      return
    }
    setTlsGate('none')
    await runTokenBearingTest()
  }, [serverUrl, token, sshHostId, runTokenBearingTest, t])

  const handleTlsDecide = useCallback(async (action: 'accept' | 'reject' | 'confirm-rollover') => {
    if (!pendingInspect) return
    try {
      const decision = await window.electronAPI.remoteTlsDecide({
        nonce: pendingInspect.nonce,
        action,
        workspaceId: reconnectWorkspace?.id,
      })
      if (action === 'reject') {
        setTlsGate('none')
        setPendingInspect(null)
        setTlsTrust(undefined)
        setTestState('error')
        setTestError(t('workspace.tlsRejected'))
        return
      }
      if (decision.requireSecondDecision) {
        setTlsGate('rollover')
        return
      }
      const persist = tlsTrustFromDecision(decision.persist)
      setTlsTrust(persist)
      setTlsGate('none')
      setPendingInspect(null)
      await runTokenBearingTest()
    } catch (err) {
      setTlsGate('none')
      setTestState('error')
      setTestError(err instanceof Error ? err.message : t('workspace.tlsDecideFailed'))
    }
  }, [pendingInspect, reconnectWorkspace, runTokenBearingTest, t])

  const handleConnect = useCallback(async () => {
    if (!serverUrl || !token) return

    // Reconnect mode — update existing workspace config
    if (isReconnectMode && onUpdate) {
      try {
        await onUpdate(reconnectWorkspace!.id, {
          url: serverUrl,
          token,
          remoteWorkspaceId: reconnectWorkspace!.remoteWorkspaceId,
          ...(sshHostId ? { sshHostId } : {}),
          ...(tlsTrust ? { tlsTrust } : {}),
        })
        return
      } catch (err) {
        setTestState('error')
        setTestError(err instanceof Error ? err.message : 'Failed to reconnect workspace')
        return
      }
    }

    if (!homeDir) return

    if (isCreateNew || isFreshServer) {
      // Create new workspace on remote server via direct RPC, then connect locally
      const name = newWorkspaceName.trim()
      if (!name) return

      try {
        const prepared = await prepareRemoteWorkspace({ url: serverUrl, token, name, homeDir, sshHostId, tlsTrust })
        await onCreate(prepared.folderPath, prepared.name, prepared.remoteServer)
      } catch (err) {
        setTestState('error')
        setTestError(err instanceof Error ? err.message : 'Failed to create workspace on remote server')
        return
      }
    } else if (selectedWorkspace) {
      // Connect to existing workspace — auto-resolve local slug
      const prepared = await prepareRemoteWorkspace({
        url: serverUrl,
        token,
        name: selectedWorkspace.name,
        homeDir,
        remoteWorkspaceId: selectedWorkspace.id,
        sshHostId,
        tlsTrust,
      })
      await onCreate(prepared.folderPath, prepared.name, prepared.remoteServer)
    }
  }, [serverUrl, token, homeDir, isCreateNew, isFreshServer, newWorkspaceName, selectedWorkspace, onCreate, isReconnectMode, onUpdate, reconnectWorkspace, sshHostId, tlsTrust])

  const canConnect = testState === 'ok' && !isCreating && (
    isReconnectMode ? true :
    (isFreshServer || isCreateNew) ? !!newWorkspaceName.trim() : !!selectedWorkspace
  )

  const showCreateMode = !isReconnectMode && (isCreateNew || isFreshServer)
  const buttonLabel = isReconnectMode ? 'Reconnect' : showCreateMode ? 'Create and Connect' : 'Connect'
  const buttonLoadingLabel = isReconnectMode ? 'Reconnecting...' : showCreateMode ? 'Creating...' : 'Connecting...'

  return (
    <AddWorkspaceContainer>
      {/* Back button */}
      <button
        onClick={onBack}
        disabled={isCreating}
        className={cn(
          "self-start flex items-center gap-1 text-sm text-muted-foreground",
          "hover:text-foreground transition-colors mb-4",
          isCreating && "opacity-50 cursor-not-allowed"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <AddWorkspaceStepHeader
        title={isReconnectMode ? t("workspace.reconnect", { name: reconnectWorkspace!.name }) : "Connect to remote server"}
        description={isReconnectMode
          ? "Update the server URL or token to restore the connection."
          : "Connect to a remote Craft Agent Server for this workspace."}
      />

      <div className="mt-6 w-full space-y-5">
        {/* Server URL */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Server URL
          </label>
          <div className="bg-background shadow-minimal rounded-lg">
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="ws://192.168.1.100:9100"
              disabled={isCreating}
              autoFocus
              className="border-0 bg-transparent shadow-none font-mono text-sm"
            />
          </div>
        </div>

        {/* Token */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Token
          </label>
          <div className="bg-background shadow-minimal rounded-lg">
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t("workspace.serverAuthToken")}
              disabled={isCreating}
              className="border-0 bg-transparent shadow-none"
            />
          </div>
        </div>

        {/* Test Connection */}
        <div className="flex items-center gap-3">
          <AddWorkspaceSecondaryButton
            onClick={handleTestConnection}
            disabled={!serverUrl || !token || testState === 'testing' || isCreating}
          >
            {tlsGate === 'inspecting' || testState === 'testing' ? (tlsGate === 'inspecting' ? t('workspace.tlsInspecting') : 'Testing...') : 'Test Connection'}
          </AddWorkspaceSecondaryButton>
          {testState === 'ok' && !isFreshServer && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="h-3.5 w-3.5" />
              Connected{serverVersion ? ` — v${serverVersion}` : ''}
            </span>
          )}
          {testState === 'ok' && isFreshServer && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="h-3.5 w-3.5" />
              Connected{serverVersion ? ` — v${serverVersion}` : ''} — no workspaces yet
            </span>
          )}
          {testState === 'error' && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              {testError || 'Failed'}
            </span>
          )}
        </div>

        {(tlsGate === 'review' || tlsGate === 'rollover') && pendingInspect && (
          <div className="space-y-3 rounded-lg border border-border px-3 py-3 text-sm">
            <div className="space-y-1">
              <div className="font-medium text-foreground">
                {tlsGate === 'rollover' ? t('workspace.tlsRolloverTitle') : t('workspace.tlsReviewTitle')}
              </div>
              {tlsGate === 'rollover' && (
                <p className="text-xs text-muted-foreground">
                  {t('workspace.tlsRolloverHint')}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{t('workspace.tlsOrigin')}</p>
              <p className="font-mono text-xs break-all text-muted-foreground">{pendingInspect.origin}</p>
              <p className="text-xs text-muted-foreground">{t('workspace.tlsFingerprint')}</p>
              <p className="font-mono text-xs break-all text-muted-foreground">{pendingInspect.spkiSha256}</p>
            </div>
            <div className="flex items-center gap-2">
              {tlsGate === 'review' ? (
                <AddWorkspacePrimaryButton onClick={() => void handleTlsDecide('accept')}>
                  {t('workspace.tlsAccept')}
                </AddWorkspacePrimaryButton>
              ) : (
                <AddWorkspacePrimaryButton onClick={() => void handleTlsDecide('confirm-rollover')}>
                  {t('workspace.tlsConfirmPin')}
                </AddWorkspacePrimaryButton>
              )}
              <AddWorkspaceSecondaryButton onClick={() => void handleTlsDecide('reject')}>
                {t('workspace.tlsReject')}
              </AddWorkspaceSecondaryButton>
            </div>
          </div>
        )}

        {/* Old server warning */}
        {testState === 'ok' && !serverVersion && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-700 dark:text-yellow-400">
            <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{t("workspace.olderServerWarning")}</span>
          </div>
        )}

        {/* Portal container for Select — must be inside the Dialog to receive pointer events */}
        <div ref={selectPortalRef} />

        {/* Workspace selector — pick existing or create new (hidden in reconnect mode) */}
        {!isReconnectMode && testState === 'ok' && remoteWorkspaces.length > 0 && !isCreateNew && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Workspace
            </label>
            <div className="bg-background shadow-minimal rounded-lg">
              <Select
                value={selectedValue ?? ''}
                onValueChange={setSelectedValue}
                disabled={isCreating}
              >
                <SelectTrigger className="border-0 bg-transparent shadow-none">
                  <SelectValue placeholder={t("workspace.selectWorkspacePlaceholder")} />
                </SelectTrigger>
                <SelectContent container={selectPortalRef.current}>
                  {remoteWorkspaces.map(ws => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              onClick={() => setSelectedValue(CREATE_NEW_VALUE)}
              disabled={isCreating}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" />
              Create new workspace on server
            </button>
          </div>
        )}

        {/* New workspace name — shown for fresh servers or "Create new" selection (hidden in reconnect mode) */}
        {!isReconnectMode && testState === 'ok' && showCreateMode && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Workspace name
            </label>
            <div className="bg-background shadow-minimal rounded-lg">
              <Input
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder={t("workspace.myRemoteWorkspace")}
                disabled={isCreating}
                className="border-0 bg-transparent shadow-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A workspace will be created on the remote server with this name.
            </p>
            {isCreateNew && remoteWorkspaces.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedValue(remoteWorkspaces.length === 1 ? remoteWorkspaces[0]!.id : null)
                  setNewWorkspaceName('')
                }}
                disabled={isCreating}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Use existing workspace
              </button>
            )}
          </div>
        )}

        {/* Connect / Create and Connect */}
        <AddWorkspacePrimaryButton
          onClick={handleConnect}
          disabled={!canConnect}
          loading={isCreating}
          loadingText={buttonLoadingLabel}
        >
          {buttonLabel}
        </AddWorkspacePrimaryButton>
      </div>
    </AddWorkspaceContainer>
  )
}
