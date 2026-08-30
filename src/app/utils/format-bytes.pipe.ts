import { Pipe, PipeTransform } from '@angular/core';
import { formatBytes } from './format';

/** `1234567` → `1.18 MB` — wraps the base-1024 `formatBytes` helper. */
@Pipe({ name: 'formatBytes' })
export class FormatBytesPipe implements PipeTransform {
  transform(bytes: number | null | undefined, decimals?: number): string {
    if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '--';
    return formatBytes(bytes, decimals);
  }
}
