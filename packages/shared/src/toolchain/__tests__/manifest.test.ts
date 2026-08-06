import { describe, expect, it } from 'bun:test';

import { MANIFEST_DATA, TOOL_PLATFORM_MATRIX } from '../manifest-data';
import { currentPlatform, loadManifest, TOOLCHAIN_MANIFEST, toolchainPaths } from '../manifest';

const HEX_64 = /^[0-9a-f]{64}$/;

describe('manifest validation', () => {
  it('каждый артефакт имеет непустые url/sha256/size/binPaths', () => {
    expect(TOOLCHAIN_MANIFEST.length).toBeGreaterThan(0);
    for (const entry of TOOLCHAIN_MANIFEST) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.displayName.length).toBeGreaterThan(0);
      for (const [platform, artifact] of Object.entries(entry.artifacts)) {
        expect(platform).toMatch(/^(darwin-arm64|darwin-x64|linux-x64|win32-x64)$/);
        expect(artifact).toBeDefined();
        if (!artifact) continue;
        // uv-python артефакты ставятся вендорным `uv python install` — прямой
        // загрузки нет, url/sha256/size не применяются (контракт manifest-data).
        if (artifact.archive === 'uv-python') {
          expect(artifact.binPaths.length).toBeGreaterThan(0);
          continue;
        }
        expect(artifact.url.length).toBeGreaterThan(0);
        expect(artifact.url).toMatch(/^https:\/\//);
        expect(artifact.sha256).toMatch(HEX_64);
        expect(artifact.size).toBeGreaterThan(0);
        expect(artifact.binPaths.length).toBeGreaterThan(0);
        for (const binPath of artifact.binPaths) {
          expect(binPath.length).toBeGreaterThan(0);
          expect(binPath.startsWith('/')).toBe(false);
        }
      }
    }
  });

  it('git публикуется только под win32-x64 согласно матрице', () => {
    expect(TOOL_PLATFORM_MATRIX.git).toEqual(['win32-x64']);
  });

  it('loadManifest возвращает собранный манифест (jq присутствует)', () => {
    const manifest = loadManifest();
    expect(manifest).toBe(TOOLCHAIN_MANIFEST);
    const jq = manifest.find((e) => e.name === 'jq');
    expect(jq).toBeDefined();
    expect(MANIFEST_DATA.jq?.version).toBe(jq?.version);
  });

  it('toolchainPaths собирает пути от config-dir', () => {
    const paths = toolchainPaths('/tmp/craft-test');
    expect(paths.toolchainDir).toBe('/tmp/craft-test/toolchain');
    expect(paths.downloadsDir).toBe('/tmp/craft-test/downloads');
    expect(paths.stateFile).toBe('/tmp/craft-test/toolchain/state.json');
  });

  it('currentPlatform возвращает валидную платформу манифеста', () => {
    expect(['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64']).toContain(currentPlatform());
  });
});
