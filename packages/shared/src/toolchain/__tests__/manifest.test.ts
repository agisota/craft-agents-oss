import { describe, expect, it } from 'bun:test';

import { getGitLock } from '../git-locks';
import { MANIFEST_DATA, TOOL_PLATFORM_MATRIX } from '../manifest-data';
import { currentPlatform, loadManifest, TOOLCHAIN_MANIFEST, toolchainPaths } from '../manifest';
import { getNpmLock } from '../npm-locks';
import type { ToolName } from '../types';

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

  it('каждый ToolName из TOOL_PLATFORM_MATRIX имеет запись в MANIFEST_DATA; npm/git-npm — pinned lock', () => {
    // Регрессия (MAJOR): gbrain был в ToolName union, TOOL_PLATFORM_MATRIX и
    // git-locks.ts, но ЗАПИСИ В MANIFEST_DATA не было — buildManifest молча его
    // не собирал, и инструмент был недостижим ни в ensureAll, ни в status/update.
    // Документированные «особые» записи ТОЖЕ обязаны присутствовать в манифесте:
    // git (на darwin/linux — системный бинарник, артефакт только под win32-x64)
    // и python (artifacts-заглушки uv-managed, ставится `uv python install`).
    // Матрица типизирована Record<ToolName, ...> — её ключи исчерпывают union.
    const matrixNames = Object.keys(TOOL_PLATFORM_MATRIX) as ToolName[];
    expect(matrixNames.length).toBeGreaterThan(0);

    const missingInManifest = matrixNames.filter((name) => !MANIFEST_DATA[name]);
    expect(missingInManifest).toEqual([]);

    // kind npm: установка fail-closed по npm-locks.ts — lock обязан существовать.
    const npmWithoutLock = matrixNames.filter((name) => {
      const data = MANIFEST_DATA[name];
      return data && (data.kind ?? 'binary') === 'npm' && getNpmLock(name, data.version) === null;
    });
    expect(npmWithoutLock).toEqual([]);

    // kind git-npm: установка fail-closed по git-locks.ts — lock обязан существовать.
    const gitNpmWithoutLock = matrixNames.filter((name) => {
      const data = MANIFEST_DATA[name];
      return data && data.kind === 'git-npm' && getGitLock(name, data.version) === undefined;
    });
    expect(gitNpmWithoutLock).toEqual([]);
  });

  it('gbrain виден ensureAll как default-on git-npm инструмент (регрессия MAJOR)', () => {
    // ensureAll перебирает TOOLCHAIN_MANIFEST (собран из MANIFEST_DATA + матрицы):
    // tier default-on без disabled-пометки => gbrain ОБЯЗАН попадать в план установки.
    const gbrain = TOOLCHAIN_MANIFEST.find((e) => e.name === 'gbrain');
    expect(gbrain).toBeDefined();
    expect(gbrain?.kind).toBe('git-npm');
    expect(gbrain?.tier).toBe('default-on');
    expect(gbrain?.version).toBe('15b9863d1363');
    expect(gbrain?.dependsOn).toEqual(['bun']);
    // Платформенная матрица покрывает текущую платформу — иначе ensureAll пропустил бы его.
    expect(gbrain?.platforms).toContain(currentPlatform());
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
