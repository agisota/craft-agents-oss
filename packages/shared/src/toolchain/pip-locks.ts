/**
 * Pinned pip requirements locks (kind: 'pip').
 *
 * FAIL-CLOSED (зеркалит npm-locks.ts / git-locks.ts): записи нет →
 * updatePipTool падает с понятной ошибкой; pip-инструмент без lock-записи
 * НЕ устанавливается никогда. Полный pip install пока не реализован —
 * только gate.
 *
 * Ключ: '<tool>@<version>'. Значение — содержимое requirements.txt (pinned).
 *
 * Обновление: добавлять запись вручную вместе с MANIFEST_DATA pip-tool в одном PR.
 */

const PIP_LOCKS: Record<string, string> = {
  // empty until first pip tool ships with embedded requirements
};

/**
 * Вернуть requirements.txt для '<name>@<version>' или null.
 * null → установка запрещена (fail-closed).
 */
export function getPipRequirements(tool: string, version: string): string | null {
  return PIP_LOCKS[`${tool}@${version}`] ?? null;
}
