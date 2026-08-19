/**
 * Credential Storage Module
 *
 * Provides secure credential storage using AES-256-GCM encrypted file.
 * All methods auto-initialize, so explicit initialize() calls are optional.
 *
 * Usage:
 *   import { getCredentialManager } from './credentials';
 *
 *   const manager = getCredentialManager();
 *
 *   // Get/set API key
 *   const apiKey = await manager.getApiKey();
 *   await manager.setApiKey('sk-ant-...');
 *
 *   // Get/set workspace OAuth
 *   const oauth = await manager.getWorkspaceOAuth(workspaceId);
 *   await manager.setWorkspaceOAuth(workspaceId, { accessToken, refreshToken, ... });
 *
 *   // Get/set agent MCP/API credentials
 *   const mcpCreds = await manager.getMcpOAuth(wsId, agentId, serverName);
 *   const apiKey = await manager.getApiKeyForAgent(wsId, agentId, apiName);
 */

export { CredentialManager, getCredentialManager } from './manager.ts';
export type { CredentialId, CredentialType, StoredCredential } from './types.ts';
export {
  credentialIdToAccount,
  accountToCredentialId,
  openClawGatewayCredentialId,
  SOURCE_CREDENTIAL_TYPES,
} from './types.ts';
export type { CredentialBackend } from './backends/types.ts';
export {
  CREDENTIAL_ENVELOPE_CODEC,
  CREDENTIAL_ENVELOPE_FORMAT,
  CREDENTIAL_ENVELOPE_VERSION,
  credentialPayloadFingerprint,
  decodeCredentialEnvelope,
  decodeCredentialEnvelopeOrLegacy,
  encodeCredentialEnvelope,
} from './envelope.ts';
export type { CredentialEnvelopeInput, CredentialEnvelopeV1 } from './envelope.ts';
export type {
  CredentialImporter,
  ImportCandidate,
  ImportCommitInput,
  ImportPreview,
  ProviderCredentialMetadata,
  ProviderMaterialization,
  SecretProvider,
} from './fabric/types.ts';
export { LocalFileSecretProvider } from './fabric/local-file-provider.ts';
export { CredentialsEncImporter, EnvFileImporter } from './fabric/importers.ts';
export { createProviderMaterialization, maskSecret } from './fabric/materialization.ts';
export { BrokerDenial, InProcessCredentialBroker } from './fabric/broker.ts';
export type {
  AccessGrant,
  AcquireLeaseInput,
  BrokerAuditEvent,
  ConsumerIdentity,
  CredentialBrokerOptions,
  CredentialLease,
} from './fabric/broker.ts';
export { JsonAccessGrantStore, MemoryAccessGrantStore } from './fabric/grant-store.ts';
export type { AccessGrantStore } from './fabric/grant-store.ts';
export { DELIVERY_MECHANISM_RANK, selectDeliveryMechanism } from './fabric/delivery.ts';
export type { DeliveryMechanism } from './fabric/delivery.ts';
