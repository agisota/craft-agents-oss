/**
 * Данные манифеста toolchain — PURE DATA, без логики.
 *
 * ВЛАДЕЛЕЦ: Collector-агент перезаписывает этот файл при сборе/бампе версий.
 * Все записи проверены: каждый артефакт скачан 2026-08-06 и sha256/size
 * вычислены локально; где вендор публикует checksums (nodejs SHASUMS256.txt,
 * jqlang/jq sha256sum.txt, cli/cli checksums.txt, mikefarah/yq checksums,
 * BtbN checksums.sha256) — локальный sha256 сверен с опубликованным.
 * Если платформы нет в artifacts — инструмент на ней недоступен (пропускается менеджером).
 */

import type { ToolArtifact, ToolName, ToolchainPlatform } from './types';

export interface ManifestToolData {
  version: string;
  displayName: string;
  critical?: boolean;
  dependsOn?: ToolName[];
  artifacts: Partial<Record<ToolchainPlatform, ToolArtifact>>;
}

/** Матрица «инструмент → целевые платформы». git — только win32-x64 (на mac/linux git системный). */
export const TOOL_PLATFORM_MATRIX: Record<ToolName, ToolchainPlatform[]> = {
  omp: ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'],
  python: ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'],
  node: ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'],
  ffmpeg: ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'],
  pandoc: ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'],
  gh: ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'],
  jq: ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'],
  yq: ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'],
  git: ['win32-x64'],
  bun: ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'],
  uv: ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'],
};

function uvPython(binPaths: string[]): ToolArtifact {
  return {
    url: '',
    sha256: 'uv-managed',
    size: 0,
    archive: 'uv-python',
    binPaths,
  };
}

export const MANIFEST_DATA: Partial<Record<ToolName, ManifestToolData>> = {
  // omp 17.2.10 — npm tarball @oh-my-pi/pi-coding-agent (платформонезависимый JS).
  // sha256 скачанного tarball; npm integrity (sha512) сверен.
  // binPaths — именованные лончеры, которые installer генерирует из package.json "bin" (bin/omp + bin/omp.cmd).
  omp: {
    version: '17.2.10',
    displayName: 'omp (Oh My Pi)',
    critical: true,
    // npm-тарболл + bun-рантайм wrapper + npm ci --locked deps (pi-natives) —
    // bun и node обязаны стоять первыми волнами.
    dependsOn: ['bun', 'node'],
    artifacts: {
      'darwin-arm64': {
        url: 'https://registry.npmjs.org/@oh-my-pi/pi-coding-agent/-/pi-coding-agent-17.2.10.tgz',
        sha256: 'e2789960126f237842ec735af6f39a89ea4c2b1792bddc8bb78e9d148477aa85',
        size: 10202985,
        archive: 'tar.gz',
        binPaths: ['bin/omp'],
      },
      'darwin-x64': {
        url: 'https://registry.npmjs.org/@oh-my-pi/pi-coding-agent/-/pi-coding-agent-17.2.10.tgz',
        sha256: 'e2789960126f237842ec735af6f39a89ea4c2b1792bddc8bb78e9d148477aa85',
        size: 10202985,
        archive: 'tar.gz',
        binPaths: ['bin/omp'],
      },
      'linux-x64': {
        url: 'https://registry.npmjs.org/@oh-my-pi/pi-coding-agent/-/pi-coding-agent-17.2.10.tgz',
        sha256: 'e2789960126f237842ec735af6f39a89ea4c2b1792bddc8bb78e9d148477aa85',
        size: 10202985,
        archive: 'tar.gz',
        binPaths: ['bin/omp'],
      },
      'win32-x64': {
        url: 'https://registry.npmjs.org/@oh-my-pi/pi-coding-agent/-/pi-coding-agent-17.2.10.tgz',
        sha256: 'e2789960126f237842ec735af6f39a89ea4c2b1792bddc8bb78e9d148477aa85',
        size: 10202985,
        archive: 'tar.gz',
        binPaths: ['bin/omp.cmd'],
      },
    },
  },

  // python 3.12 — ставится через `uv python install`; url/sha256/size не применимы.
  python: {
    version: '3.12',
    displayName: 'Python 3.12',
    // ставится только через toolchain uv — строго после него (волны dependsOn).
    dependsOn: ['uv'],
    artifacts: {
      'darwin-arm64': uvPython(['.pyinstall/bin/python3', '.pyinstall/bin/python3.12']),
      'darwin-x64': uvPython(['.pyinstall/bin/python3', '.pyinstall/bin/python3.12']),
      'linux-x64': uvPython(['.pyinstall/bin/python3', '.pyinstall/bin/python3.12']),
      'win32-x64': uvPython(['.pyinstall/python.exe']),
    },
  },

  // node 22.23.2 (LTS) — nodejs.org/dist. sha256 сверены с SHASUMS256.txt релиза.
  // binPaths включают корневую директорию архива (у archives нет stripComponents).
  node: {
    version: '22.23.2',
    displayName: 'Node.js 22 LTS',
    critical: true,
    artifacts: {
      'darwin-arm64': {
        url: 'https://nodejs.org/dist/v22.23.2/node-v22.23.2-darwin-arm64.tar.gz',
        sha256: '61130f394c1630d211dd50aecc4353d379480f36d3ac913cd85dbba1aed585c6',
        size: 50068815,
        archive: 'tar.gz',
        binPaths: ['node-v22.23.2-darwin-arm64/bin/node', 'node-v22.23.2-darwin-arm64/bin/npx'],
      },
      'darwin-x64': {
        url: 'https://nodejs.org/dist/v22.23.2/node-v22.23.2-darwin-x64.tar.gz',
        sha256: '58e99022c2ff89395576cc7fd4d98cea24bb68081475d5f88b801ee8729fb026',
        size: 51246936,
        archive: 'tar.gz',
        binPaths: ['node-v22.23.2-darwin-x64/bin/node', 'node-v22.23.2-darwin-x64/bin/npx'],
      },
      'linux-x64': {
        url: 'https://nodejs.org/dist/v22.23.2/node-v22.23.2-linux-x64.tar.gz',
        sha256: 'b294a556e639d64338823920e5866c21c02741742d2e1529ee1a225c1ec9252a',
        size: 56851233,
        archive: 'tar.gz',
        binPaths: ['node-v22.23.2-linux-x64/bin/node', 'node-v22.23.2-linux-x64/bin/npx'],
      },
      'win32-x64': {
        url: 'https://nodejs.org/dist/v22.23.2/node-v22.23.2-win-x64.zip',
        sha256: '1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97',
        size: 35683585,
        archive: 'zip',
        binPaths: ['node-v22.23.2-win-x64/node.exe', 'node-v22.23.2-win-x64/npx.cmd'],
      },
    },
  },

  // jq 1.8.1 — голые бинарники ('raw' кладёт файл как toolchain/<tool>/<version>/bin/jq).
  // sha256 сверены с опубликованным jqlang/jq sha256sum.txt.
  jq: {
    version: '1.8.1',
    displayName: 'jq',
    artifacts: {
      'darwin-arm64': {
        url: 'https://github.com/jqlang/jq/releases/download/jq-1.8.1/jq-macos-arm64',
        sha256: 'a9fe3ea2f86dfc72f6728417521ec9067b343277152b114f4e98d8cb0e263603',
        size: 841408,
        archive: 'raw',
        binPaths: ['bin/jq'],
      },
      'darwin-x64': {
        url: 'https://github.com/jqlang/jq/releases/download/jq-1.8.1/jq-macos-amd64',
        sha256: 'e80dbe0d2a2597e3c11c404f03337b981d74b4a8504b70586c354b7697a7c27f',
        size: 855272,
        archive: 'raw',
        binPaths: ['bin/jq'],
      },
      'linux-x64': {
        url: 'https://github.com/jqlang/jq/releases/download/jq-1.8.1/jq-linux-amd64',
        sha256: '020468de7539ce70ef1bceaf7cde2e8c4f2ca6c3afb84642aabc5c97d9fc2a0d',
        size: 2255816,
        archive: 'raw',
        binPaths: ['bin/jq'],
      },
      'win32-x64': {
        url: 'https://github.com/jqlang/jq/releases/download/jq-1.8.1/jq-windows-amd64.exe',
        sha256: '23cb60a1354eed6bcc8d9b9735e8c7b388cd1fdcb75726b93bc299ef22dd9334',
        size: 1026560,
        archive: 'raw',
        binPaths: ['bin/jq.exe'],
      },
    },
  },

  // yq 4.53.3 — голые бинарники. sha256 сверены с опубликованным mikefarah/yq checksums.
  yq: {
    version: '4.53.3',
    displayName: 'yq',
    artifacts: {
      'darwin-arm64': {
        url: 'https://github.com/mikefarah/yq/releases/download/v4.53.3/yq_darwin_arm64',
        sha256: '877de31753a4dd2401aa048937aa9a7fc4d5f6ce858cf31508c5802954297213',
        size: 13045874,
        archive: 'raw',
        binPaths: ['bin/yq'],
      },
      'darwin-x64': {
        url: 'https://github.com/mikefarah/yq/releases/download/v4.53.3/yq_darwin_amd64',
        sha256: 'b4ba1ecce3c47f00803f4f964de38394326c7a32eb6540616e04fb2935a0f08d',
        size: 13973184,
        archive: 'raw',
        binPaths: ['bin/yq'],
      },
      'linux-x64': {
        url: 'https://github.com/mikefarah/yq/releases/download/v4.53.3/yq_linux_amd64',
        sha256: 'fa52a4e758c63d38299163fbdd1edfb4c4963247918bf9c1c5d31d84789eded4',
        size: 13750434,
        archive: 'raw',
        binPaths: ['bin/yq'],
      },
      'win32-x64': {
        url: 'https://github.com/mikefarah/yq/releases/download/v4.53.3/yq_windows_amd64.exe',
        sha256: 'e279bc506a452eeafcdf364f91a025455e402a8001169083caf01f4b64a544e2',
        size: 14235136,
        archive: 'raw',
        binPaths: ['bin/yq.exe'],
      },
    },
  },

  // gh 2.97.0 — sha256 сверены с gh_2.97.0_checksums.txt.
  // macOS zip содержит top-level dir (gh_2.97.0_macOS_arm64/bin/gh); windows zip — БЕЗ top-level dir (bin/gh.exe).
  gh: {
    version: '2.97.0',
    displayName: 'GitHub CLI',
    artifacts: {
      'darwin-arm64': {
        url: 'https://github.com/cli/cli/releases/download/v2.97.0/gh_2.97.0_macOS_arm64.zip',
        sha256: 'a58b8fd77b417a38f47a0b54d1370c59b0fcdb324ccc9ca002b0998f7c4c999e',
        size: 13845290,
        archive: 'zip',
        binPaths: ['gh_2.97.0_macOS_arm64/bin/gh'],
      },
      'darwin-x64': {
        url: 'https://github.com/cli/cli/releases/download/v2.97.0/gh_2.97.0_macOS_amd64.zip',
        sha256: '63298c998cc2a924c9e254c6af6a1caad6ece281122687a91f079bc0a462700e',
        size: 15418698,
        archive: 'zip',
        binPaths: ['gh_2.97.0_macOS_amd64/bin/gh'],
      },
      'linux-x64': {
        url: 'https://github.com/cli/cli/releases/download/v2.97.0/gh_2.97.0_linux_amd64.tar.gz',
        sha256: 'a2c9b8497e1f85b1ad0dfcb78b5a622e098801b8e461e459e88e1ee12f018112',
        size: 14770812,
        archive: 'tar.gz',
        binPaths: ['gh_2.97.0_linux_amd64/bin/gh'],
      },
      'win32-x64': {
        url: 'https://github.com/cli/cli/releases/download/v2.97.0/gh_2.97.0_windows_amd64.zip',
        sha256: '35d7fe05c4dd1411ffda1e73dfc7c6f44b75c936ca51fa6595c657fdc0350cec',
        size: 14938517,
        archive: 'zip',
        // У этого zip нет корневой директории — bin/ на верхнем уровне.
        binPaths: ['bin/gh.exe'],
      },
    },
  },

  // pandoc 3.10.1 — vendor checksums не публикует; sha256/size вычислены локально.
  pandoc: {
    version: '3.10.1',
    displayName: 'Pandoc',
    artifacts: {
      'darwin-arm64': {
        url: 'https://github.com/jgm/pandoc/releases/download/3.10.1/pandoc-3.10.1-arm64-macOS.zip',
        sha256: '8607160694a70ed9aa63776caa44acef3afb729c379c7c283724b7e27455bfda',
        size: 41741911,
        archive: 'zip',
        binPaths: ['pandoc-3.10.1-arm64/bin/pandoc'],
      },
      'darwin-x64': {
        url: 'https://github.com/jgm/pandoc/releases/download/3.10.1/pandoc-3.10.1-x86_64-macOS.zip',
        sha256: '76430dd0ce5305fc4b91d8c0d5c22a00c8d2197ad3cef3937f65048f087164f7',
        size: 26096585,
        archive: 'zip',
        binPaths: ['pandoc-3.10.1-x86_64/bin/pandoc'],
      },
      'linux-x64': {
        url: 'https://github.com/jgm/pandoc/releases/download/3.10.1/pandoc-3.10.1-linux-amd64.tar.gz',
        sha256: '72948bf5784f560d5ad1876709daca27e0667f262da727bb33f77b58e52df2f5',
        size: 34873851,
        archive: 'tar.gz',
        binPaths: ['pandoc-3.10.1/bin/pandoc'],
      },
      'win32-x64': {
        url: 'https://github.com/jgm/pandoc/releases/download/3.10.1/pandoc-3.10.1-windows-x86_64.zip',
        sha256: '4725a1883e2171c2e181e6fd45003acb59ca4e9cbe031fdd3b79ef0d697d36aa',
        size: 41675076,
        archive: 'zip',
        // pandoc.exe лежит в корне top-level dir, bin/ нет.
        binPaths: ['pandoc-3.10.1/pandoc.exe'],
      },
    },
  },

  // git 2.55.0.3 — ТОЛЬКО win32-x64: MinGit busybox zip (на mac/linux git считаем системным).
  git: {
    version: '2.55.0.3',
    displayName: 'Git for Windows (MinGit)',
    artifacts: {
      'win32-x64': {
        url: 'https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.3/MinGit-2.55.0.3-busybox-64-bit.zip',
        sha256: 'cbb2ade2bf690b62f0d692ec64733cb26c6b4ea294b0b9752a705446f011b41f',
        size: 34275238,
        archive: 'zip',
        binPaths: ['cmd/git.exe'],
      },
    },
  },

  // ffmpeg — darwin: статические сборки martin-riedl.de (single-binary zip, версия 9.0);
  // linux/win: BtbN FFmpeg-Builds autobuild-2026-08-06-13-39, sha256 сверены с checksums.sha256.
  ffmpeg: {
    version: '9.0',
    displayName: 'FFmpeg',
    critical: true,
    artifacts: {
      'darwin-arm64': {
        url: 'https://ffmpeg.martin-riedl.de/download/macos/arm64/1785863997_9.0/ffmpeg.zip',
        sha256: '5267ef149ee0d208057a1b316aac079b661b0476574dee5da7d225769773c603',
        size: 28440078,
        archive: 'zip',
        // Zip содержит единственный бинарник ffmpeg в корне (без директории).
        binPaths: ['ffmpeg'],
      },
      'darwin-x64': {
        url: 'https://ffmpeg.martin-riedl.de/download/macos/amd64/1785871427_9.0/ffmpeg.zip',
        sha256: '79d14663d8b078dbbc38de18d63a30f8a5bfc860af5dfee7f8cf3e387cf1c02c',
        size: 33842767,
        archive: 'zip',
        binPaths: ['ffmpeg'],
      },
      'linux-x64': {
        url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-08-06-13-39/ffmpeg-N-125978-g95c43d7df7-linux64-lgpl.tar.xz',
        sha256: '97d4b95d33da6f0d3102e252eaa7a4778a673ebf2434a0bf15f409a37e3afeb1',
        size: 114391856,
        archive: 'tar.xz',
        binPaths: ['ffmpeg-N-125978-g95c43d7df7-linux64-lgpl/bin/ffmpeg'],
      },
      'win32-x64': {
        url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-08-06-13-39/ffmpeg-N-125978-g95c43d7df7-win64-lgpl.zip',
        sha256: '79ab2838ff13a71df85ba452d633b964fe5cc681f7eccb1f3e873649974fbe1f',
        size: 148267877,
        archive: 'zip',
        binPaths: ['ffmpeg-N-125978-g95c43d7df7-win64-lgpl/bin/ffmpeg.exe'],
      },
    },
  },

  // bun 1.3.14 — oven-sh/bun GitHub releases. sha256 сверены с SHASUMS256.txt релиза;
  // darwin-aarch64 дополнительно скачан и перепроверен локально.
  // Non-baseline сборки (для M1+/современных CPU). binPaths включают top-level dir zip'а.
  bun: {
    version: '1.3.14',
    displayName: 'Bun',
    artifacts: {
      'darwin-arm64': {
        url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-darwin-aarch64.zip',
        sha256: 'd8b96221828ad6f97ac7ac0ab7e95872341af763001e8803e8267652c2652620',
        size: 23586433,
        archive: 'zip',
        binPaths: ['bun-darwin-aarch64/bun'],
      },
      'darwin-x64': {
        url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-darwin-x64.zip',
        sha256: '4183df3374623e5bab315c547cfa0974533cd457d86b73b639f7a87974cd6633',
        size: 26509109,
        archive: 'zip',
        binPaths: ['bun-darwin-x64/bun'],
      },
      'linux-x64': {
        url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-linux-x64.zip',
        sha256: '951ee2aee855f08595aeec6225226a298d3fea83a3dcd6465c09cbccdf7e848f',
        size: 35969274,
        archive: 'zip',
        binPaths: ['bun-linux-x64/bun'],
      },
      'win32-x64': {
        url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-windows-x64.zip',
        sha256: '0a0620930b6675d7ba440e81f4e0e00d3cfbe096c4b140d3fff02205e9e18922',
        size: 38366737,
        archive: 'zip',
        binPaths: ['bun-windows-x64/bun.exe'],
      },
    },
  },

  // uv 0.12.2 — astral-sh/uv GitHub releases. sha256 сверены с опубликованными
  // <asset>.sha256 файлами релиза; darwin-aarch64 дополнительно скачан и перепроверен локально.
  uv: {
    version: '0.12.2',
    displayName: 'uv (Astral)',
    artifacts: {
      'darwin-arm64': {
        url: 'https://github.com/astral-sh/uv/releases/download/0.12.2/uv-aarch64-apple-darwin.tar.gz',
        sha256: 'fa909fea3bc06f460db79017030a221fdbc43ec4478f089cb554d8335c090817',
        size: 17676261,
        archive: 'tar.gz',
        binPaths: ['uv-aarch64-apple-darwin/uv'],
      },
      'darwin-x64': {
        url: 'https://github.com/astral-sh/uv/releases/download/0.12.2/uv-x86_64-apple-darwin.tar.gz',
        sha256: 'a6e6506a9109801222d65d17461abf4ed13bdecc5d2b13af0495418a82972c6b',
        size: 19517927,
        archive: 'tar.gz',
        binPaths: ['uv-x86_64-apple-darwin/uv'],
      },
      'linux-x64': {
        url: 'https://github.com/astral-sh/uv/releases/download/0.12.2/uv-x86_64-unknown-linux-gnu.tar.gz',
        sha256: 'd66e96b5f1ca3b99806eee283a8125d33a0bd669e6e6d9bc4ab7ffda63c41bf4',
        size: 21700643,
        archive: 'tar.gz',
        binPaths: ['uv-x86_64-unknown-linux-gnu/uv'],
      },
      'win32-x64': {
        url: 'https://github.com/astral-sh/uv/releases/download/0.12.2/uv-x86_64-pc-windows-msvc.zip',
        sha256: '01442d8ce5c7124151a73e697c836d252c6da853c18c73206d3cc4c2378a91d2',
        size: 18977266,
        archive: 'zip',
        binPaths: ['uv-x86_64-pc-windows-msvc/uv.exe'],
      },
    },
  },
};
