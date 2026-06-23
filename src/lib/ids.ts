// Stable id + unique-name helpers.

let counter = 0;

/** Generate a short unique id. Not cryptographic; only needs to be unique per session. */
export function makeId(prefix: string): string {
  counter += 1;
  const rand = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}${rand}`;
}

/** Return `base` if unused, otherwise `base_1`, `base_2`, ... not colliding with `taken`. */
export function uniqueName(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  let i = 1;
  while (set.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}
