export function initialsOf(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

export function hueColor(hue: number): string {
  return `oklch(0.62 0.14 ${hue})`;
}
