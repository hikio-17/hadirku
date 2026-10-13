/** Helper baca FormData di server action (tanpa client JS). */
export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

/** Checkbox HTML: "on" bila dicentang. */
export function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}
