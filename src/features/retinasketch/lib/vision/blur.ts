/** Flou moyenneur séparable (fenêtre glissante), bords répliqués. Pur, O(n). */
export function boxBlur(
  src: Float32Array,
  w: number,
  h: number,
  r: number,
): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const win = 2 * r + 1;
  const clamp = (v: number, hi: number) => (v < 0 ? 0 : v > hi ? hi : v);

  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + clamp(x, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / win;
      acc += src[y * w + clamp(x + r + 1, w - 1)] - src[y * w + clamp(x - r, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win;
      acc += tmp[clamp(y + r + 1, h - 1) * w + x] - tmp[clamp(y - r, h - 1) * w + x];
    }
  }
  return out;
}
