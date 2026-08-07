/**
 * Skills Module
 *
 * Workspace skills are specialized instructions that extend Claude's capabilities.
 */

export * from './types.ts';
export {
  GLOBAL_AGENT_SKILLS_DIR,
  PROJECT_AGENT_SKILLS_DIR,
  loadSkill,
  loadAllSkills,
  invalidateSkillsCache,
  getDisabledBundledSkillSlugsFromDisk,
  loadSkillBySlug,
  getSkillIconPath,
  deleteSkill,
  skillExists,
  listSkillSlugs,
  skillNeedsIconDownload,
  downloadSkillIcon,
} from './storage.ts';
export {
  OMP_GLOBAL_SKILLS_DIR,
  OMP_WORKSPACE_SKILLS_DIR,
  listOmpSkills,
  isOmpSkillPath,
  invalidateOmpSkillsCache,
  type OmpSkillInfo,
} from './omp-discovery.ts';
export {
  ensureBundledSkills,
  listBundledSkillPacks,
  resetBundledSkillsInitialized,
  type BundledSkillPackStatus,
  type EnsureBundledSkillsOptions,
  type EnsureBundledSkillsResult,
} from './bundled.ts';
