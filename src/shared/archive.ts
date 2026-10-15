/**
 * Formats Drop.it can open up: anything built on the zip container. Only these
 * get a browsable entry list, and only these can be hosted as a site — tarballs
 * and the like would have to be unpacked front to back to find a single file.
 */
const ZIP_SUFFIXES = ['.zip', '.jar', '.war', '.apk'] as const;

export function isZipArchive(filename: string): boolean {
  const normalized = filename.trim().toLowerCase();
  return ZIP_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}
