import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Plus, Server, Pencil, Trash2, Download, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "../ui/input"
import {
  AddWorkspaceContainer,
  AddWorkspaceStepHeader,
  AddWorkspacePrimaryButton,
  AddWorkspaceSecondaryButton,
} from "./primitives"
import type {
  SshHostConfig,
  SshHostInput,
  SshConfigImportSuggestion,
  SshTunnelState,
} from "../../../shared/types"

interface AddWorkspaceStep_SshProps {
  onBack: () => void
  /** Called once a tunnel is connected; hands the forwarded ws url + token to the remote flow. */
  onConnected: (args: { url: string; token?: string; hostLabel: string }) => void
}

type TunnelStatus = SshTunnelState["status"]

const STATUS_COLOR: Record<TunnelStatus, string> = {
  disconnected: "bg-foreground/30",
  connecting: "bg-amber-400",
  connected: "bg-emerald-500",
  error: "bg-red-500",
}

function StatusDot({ status }: { status: TunnelStatus }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          STATUS_COLOR[status],
          status === "connecting" && "animate-pulse",
        )}
      />
      <span className="text-xs opacity-70">{t(`ssh.status.${status}`)}</span>
    </span>
  )
}

const EMPTY_FORM: SshHostInput = {
  label: "",
  host: "",
  user: "",
  identityFile: "",
  remoteServerCommand: "",
}

export function AddWorkspaceStep_Ssh({ onBack, onConnected }: AddWorkspaceStep_SshProps) {
  const { t } = useTranslation()
  const [hosts, setHosts] = useState<SshHostConfig[]>([])
  const [statuses, setStatuses] = useState<Record<string, SshTunnelState>>({})
  const [editing, setEditing] = useState<SshHostConfig | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SshHostInput>(EMPTY_FORM)
  const [portStr, setPortStr] = useState("22")
  const [remotePortStr, setRemotePortStr] = useState("9100")
  const [busyHostId, setBusyHostId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SshConfigImportSuggestion[]>([])

  const refresh = useCallback(async () => {
    setHosts(await window.electronAPI.sshListHosts())
  }, [])

  useEffect(() => {
    void refresh()
    const off = window.electronAPI.onSshTunnelState((state) => {
      setStatuses((prev) => ({ ...prev, [state.hostId]: state }))
    })
    return off
  }, [refresh])

  const statusOf = (id: string): TunnelStatus => statuses[id]?.status ?? "disconnected"

  const openAddForm = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setPortStr("22")
    setRemotePortStr("9100")
    setShowForm(true)
  }

  const openEditForm = (host: SshHostConfig) => {
    setEditing(host)
    setForm({
      label: host.label,
      host: host.host,
      user: host.user,
      identityFile: host.identityFile ?? "",
      remoteServerCommand: host.remoteServerCommand ?? "",
    })
    setPortStr(String(host.port))
    setRemotePortStr(String(host.remotePort))
    setShowForm(true)
  }

  const saveForm = async () => {
    const payload: SshHostInput = {
      ...form,
      port: parseInt(portStr, 10) || 22,
      remotePort: parseInt(remotePortStr, 10) || 9100,
      identityFile: form.identityFile?.trim() || undefined,
      remoteServerCommand: form.remoteServerCommand?.trim() || undefined,
    }
    if (editing) {
      await window.electronAPI.sshUpdateHost(editing.id, payload)
    } else {
      await window.electronAPI.sshAddHost(payload)
    }
    setShowForm(false)
    await refresh()
  }

  const removeHost = async (id: string) => {
    await window.electronAPI.sshDeleteHost(id)
    await refresh()
  }

  const importFromConfig = async () => {
    const found = await window.electronAPI.sshImportFromConfig()
    // Filter out hosts already saved (by host+user).
    const existing = new Set(hosts.map((h) => `${h.user}@${h.host}:${h.port}`))
    setSuggestions(
      found.filter((s) => !existing.has(`${s.user ?? ""}@${s.host}:${s.port}`)),
    )
  }

  const addSuggestion = async (s: SshConfigImportSuggestion) => {
    await window.electronAPI.sshAddHost({
      id: s.alias,
      label: s.alias,
      host: s.host,
      user: s.user ?? "",
      port: s.port,
      identityFile: s.identityFile,
      imported: true,
    })
    setSuggestions((prev) => prev.filter((x) => x !== s))
    await refresh()
  }

  const connect = async (host: SshHostConfig) => {
    setError(null)
    setBusyHostId(host.id)
    try {
      const { url, token } = await window.electronAPI.sshConnect(host.id)
      if (!url) throw new Error(t("ssh.error.noUrl"))
      onConnected({ url, token, hostLabel: host.label })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyHostId(null)
    }
  }

  const startRemoteServer = async (host: SshHostConfig) => {
    setBusyHostId(host.id)
    try {
      await window.electronAPI.sshStartRemoteServer(host.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyHostId(null)
    }
  }

  if (showForm) {
    const valid = form.label.trim() && form.host.trim() && form.user.trim()
    return (
      <AddWorkspaceContainer>
        <BackHeader
          onBack={() => setShowForm(false)}
          title={editing ? t("ssh.editHost") : t("ssh.addHost")}
        />
        <div className="mt-6 w-full space-y-3">
          <Field label={t("ssh.field.label")}>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="My server"
            />
          </Field>
          <div className="flex gap-2">
            <Field label={t("ssh.field.host")} className="flex-1">
              <Input
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="example.com"
              />
            </Field>
            <Field label={t("ssh.field.port")} className="w-24">
              <Input value={portStr} onChange={(e) => setPortStr(e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Field label={t("ssh.field.user")} className="flex-1">
              <Input
                value={form.user}
                onChange={(e) => setForm({ ...form, user: e.target.value })}
                placeholder="deploy"
              />
            </Field>
            <Field label={t("ssh.field.remotePort")} className="w-28">
              <Input value={remotePortStr} onChange={(e) => setRemotePortStr(e.target.value)} />
            </Field>
          </div>
          <Field label={t("ssh.field.identityFile")}>
            <Input
              value={form.identityFile ?? ""}
              onChange={(e) => setForm({ ...form, identityFile: e.target.value })}
              placeholder="~/.ssh/id_ed25519"
            />
          </Field>
          <Field label={t("ssh.field.remoteCommand")}>
            <Input
              value={form.remoteServerCommand ?? ""}
              onChange={(e) => setForm({ ...form, remoteServerCommand: e.target.value })}
              placeholder="cd ~/craft && ./start.sh"
            />
          </Field>
        </div>
        <div className="mt-6 w-full">
          <AddWorkspacePrimaryButton onClick={saveForm} disabled={!valid}>
            {t("common.save")}
          </AddWorkspacePrimaryButton>
        </div>
      </AddWorkspaceContainer>
    )
  }

  return (
    <AddWorkspaceContainer>
      <BackHeader onBack={onBack} title={t("ssh.title")} />
      <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
        {t("ssh.description")}
      </p>

      {error && (
        <div className="mt-4 w-full rounded-[10px] bg-red-500/10 p-3 text-xs text-red-500">
          {error}
        </div>
      )}

      <div className="mt-6 w-full space-y-2">
        {hosts.length === 0 && (
          <div className="rounded-[10px] bg-foreground/5 p-4 text-center text-xs opacity-70">
            {t("ssh.empty")}
          </div>
        )}
        {hosts.map((host) => {
          const status = statusOf(host.id)
          const busy = busyHostId === host.id
          return (
            <div
              key={host.id}
              className="flex items-center gap-3 rounded-[10px] bg-foreground/5 p-3"
            >
              <Server className="h-4 w-4 shrink-0 opacity-60" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{host.label}</div>
                <div className="truncate text-xs opacity-70">
                  {host.user}@{host.host}
                  {host.port !== 22 ? `:${host.port}` : ""}
                </div>
                <div className="mt-1">
                  <StatusDot status={status} />
                </div>
              </div>
              <div className="flex items-center gap-1">
                {host.remoteServerCommand && status === "error" && (
                  <IconBtn
                    title={t("ssh.startServer")}
                    onClick={() => startRemoteServer(host)}
                    disabled={busy}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </IconBtn>
                )}
                <IconBtn title={t("common.edit")} onClick={() => openEditForm(host)}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title={t("common.delete")} onClick={() => removeHost(host.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
                <AddWorkspaceSecondaryButton onClick={() => connect(host)} disabled={busy}>
                  {busy ? t("ssh.connecting") : t("ssh.connect")}
                </AddWorkspaceSecondaryButton>
              </div>
            </div>
          )
        })}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4 w-full">
          <div className="mb-1 text-xs opacity-70">{t("ssh.importSuggestions")}</div>
          <div className="space-y-1">
            {suggestions.map((s) => (
              <button
                key={`${s.alias}-${s.host}`}
                onClick={() => addSuggestion(s)}
                className="flex w-full items-center gap-2 rounded-[10px] bg-foreground/5 p-2 text-left hover:bg-foreground/10"
              >
                <Plus className="h-3.5 w-3.5 opacity-60" />
                <span className="text-sm">{s.alias}</span>
                <span className="text-xs opacity-70">
                  {s.user ? `${s.user}@` : ""}
                  {s.host}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex w-full gap-2">
        <AddWorkspaceSecondaryButton className="flex-1" onClick={openAddForm}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("ssh.addHost")}
        </AddWorkspaceSecondaryButton>
        <AddWorkspaceSecondaryButton className="flex-1" onClick={importFromConfig}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t("ssh.importFromConfig")}
        </AddWorkspaceSecondaryButton>
      </div>
    </AddWorkspaceContainer>
  )
}

function BackHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex w-full items-center">
      <button
        onClick={onBack}
        className="flex h-8 w-8 items-center justify-center rounded-[10px] hover:bg-foreground/5"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <AddWorkspaceStepHeader title={title} />
      </div>
      <div className="w-8" />
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs opacity-70">{label}</span>
      {children}
    </label>
  )
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-[10px] text-foreground/60 hover:bg-foreground/10 hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  )
}
