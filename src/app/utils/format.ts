/** `1.5 MB` — the base-1024 helper the uploader page has always used. */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/** `M:SS`, or `H:MM:SS` once it runs past an hour. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [
    h > 0 ? String(h) : null,
    h > 0 ? String(m).padStart(2, '0') : String(m),
    String(s).padStart(2, '0'),
  ]
    .filter((part) => part !== null)
    .join(':');
}
