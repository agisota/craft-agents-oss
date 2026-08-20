/**
 * Identity Center domain contracts (S-07).
 *
 * Federated model: Profile is the root; external accounts (including SiYuan
 * Cloud) attach as ServiceConnection via credentialRef. Secrets never live here.
 */

export type ProfileMode = 'local' | 'cloud';

export type ProfilePlan = 'standard' | 'pro' | 'team' | 'max';

export const PROFILE_PLANS: readonly ProfilePlan[] = ['standard', 'pro', 'team', 'max'];

const PROFILE_PLAN_SET = new Set<string>(PROFILE_PLANS);

export function isProfilePlan(value: unknown): value is ProfilePlan {
  return typeof value === 'string' && PROFILE_PLAN_SET.has(value);
}

const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Empty/whitespace clears email. Invalid values throw. */
export function normalizeProfileEmail(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error('Invalid profile email');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > EMAIL_MAX || !EMAIL_RE.test(trimmed)) {
    throw new Error('Invalid profile email');
  }
  return trimmed;
}

const AVATAR_MAX = 400_000;
const AVATAR_RE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i;

function avatarLooksUnsafe(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes('image/svg') ||
    lower.includes('text/html') ||
    lower.includes('<svg') ||
    lower.includes('<html') ||
    lower.includes('<script') ||
    lower.includes('javascript:')
  );
}

/** Empty/whitespace clears avatar. Invalid values throw. */
export function normalizeProfileAvatar(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error('Invalid profile avatar');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > AVATAR_MAX) {
    throw new Error('Invalid profile avatar');
  }
  if (avatarLooksUnsafe(trimmed) || !AVATAR_RE.test(trimmed)) {
    throw new Error('Invalid profile avatar');
  }
  return trimmed;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export type ServiceProvider =
  | 'siyuan-local'
  | 'siyuan-cloud'
  | 'github'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'slack'
  | 'custom';

export type ServiceConnectionStatus =
  | 'connected'
  | 'expired'
  | 'syncing'
  | 'error'
  | 'disconnected';

export type EntitlementStatus = 'active' | 'expired' | 'trial';

export interface Profile {
  id: string;
  displayName: string;
  avatar?: string;
  email?: string;
  plan: ProfilePlan;
  mode: ProfileMode;
}

/** Types-only contract for team/remote workspaces (server outside W4 scope). */
export interface WorkspaceMembership {
  workspaceId: string;
  profileId: string;
  role: WorkspaceRole;
}

export interface ServiceConnection {
  id: string;
  workspaceId: string;
  provider: ServiceProvider;
  accountLabel?: string;
  /** Opaque ref into CredentialManager — never a secret value. */
  credentialRef?: string;
  status: ServiceConnectionStatus;
  /**
   * When true, this row is a read-only reflection of an LLM connection owned
   * by AI Settings. Disconnect is disabled / links out.
   */
  readOnly?: boolean;
}

export interface Entitlement {
  provider: ServiceProvider | string;
  product: string;
  status: EntitlementStatus;
  expiresAt?: number;
}

export interface IdentityState {
  profile: Profile;
  connections: ServiceConnection[];
  entitlements: Entitlement[];
}

export interface IdentityFile {
  version: 1;
  profile: Profile;
  connections: ServiceConnection[];
  entitlements: Entitlement[];
}

export interface UpdateProfileInput {
  displayName?: string;
  avatar?: string;
  email?: string;
  plan?: ProfilePlan;
  mode?: ProfileMode;
}

export interface ConnectServiceInput {
  provider: ServiceProvider;
  workspaceId: string;
  accountLabel?: string;
  /** When set for oauth-style providers, stored as service_oauth secret. */
  credentialValue?: string;
  /** Optional stable id; otherwise generated. */
  connectionId?: string;
}

export interface DisconnectServiceInput {
  connectionId: string;
}
