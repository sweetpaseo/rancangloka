/**
 * RancangLoka — Human-Readable Age and Duration Formatters
 * Milestone: APPROVAL-INBOX-V1
 *
 * Requirements:
 * - Human-readable age: 'Baru saja', '18 menit', '2 jam', '1 hari', '3 hari'
 * - Informational only (no artificial SLA enforcement in V1).
 */

export function formatWaitingDuration(
  dateInput: string | Date | number,
  nowInput?: Date | number
): string {
  if (!dateInput) return 'Baru saja';

  const dateMs =
    typeof dateInput === 'string'
      ? new Date(dateInput).getTime()
      : dateInput instanceof Date
      ? dateInput.getTime()
      : Number(dateInput);

  if (isNaN(dateMs)) return 'Baru saja';

  const nowMs = nowInput
    ? nowInput instanceof Date
      ? nowInput.getTime()
      : Number(nowInput)
    : Date.now();

  const diffMs = Math.max(0, nowMs - dateMs);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 5) {
    return 'Baru saja';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} menit`;
  }
  if (diffHours < 24) {
    return `${diffHours} jam`;
  }
  return `${diffDays} hari`;
}
