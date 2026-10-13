/**
 * Standard fuzzy membership functions
 */

export function triangular(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

export function trapezoidal(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

export function shoulderLeft(x: number, a: number, b: number): number {
  if (x <= a) return 1;
  if (x >= b) return 0;
  return (b - x) / (b - a);
}

export function shoulderRight(x: number, a: number, b: number): number {
  if (x >= b) return 1;
  if (x <= a) return 0;
  return (x - a) / (b - a);
}
