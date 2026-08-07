/**
 * Pinned pip requirements locks (kind: 'pip').
 *
 * FAIL-CLOSED (зеркалит npm-locks.ts / git-locks.ts): записи нет →
 * updatePipTool падает с понятной ошибкой; pip-инструмент без lock-записи
 * НЕ устанавливается никогда.
 *
 * Ключ: '<tool>@<version>'. Значение — содержимое requirements.txt
 * (pinned + --hash=sha256:… для `uv pip install --require-hashes`).
 *
 * Обновление: добавлять запись вручную вместе с MANIFEST_DATA pip-tool в одном PR.
 * Генерация: `uv pip compile --generate-hashes - <<< 'pkg==ver'`.
 */

const PIP_LOCKS: Record<string, string> = {
  // pip-packaging 24.2 — proof opt-in pip tool (library packaging; no console script).
  // wheel + sdist hashes from `uv pip compile --generate-hashes` (PyPI 2026-08-08).
  'pip-packaging@24.2':
    'packaging==24.2 \\\n' +
    '    --hash=sha256:09abb1bccd265c01f4a3aa3f7a7db064b36514d2cba19a2f694fe6150451a759 \\\n' +
    '    --hash=sha256:c228a6dc5e932d346bc5739379109d49e8853dd8223571c7c5b55260edc0b97f\n',
};

/**
 * Вернуть requirements.txt для '<name>@<version>' или null.
 * null → установка запрещена (fail-closed).
 */
export function getPipRequirements(tool: string, version: string): string | null {
  return PIP_LOCKS[`${tool}@${version}`] ?? null;
}
