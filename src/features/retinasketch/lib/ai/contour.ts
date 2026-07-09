/**
 * Masque binaire (sortie SAM) → polygone fidèle (pixels image).
 *
 * 1) plus grande composante connexe (4-connexité), 2) suivi de contour
 * Moore-Neighbor (boucle ordonnée, gère les formes concaves), 3) simplification
 * Douglas–Peucker. Renvoie un polygone fermé en coordonnées du masque.
 */

// Voisinage 8-connexe, sens horaire : E, SE, S, SO, O, NO, N, NE
const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

export function maskToPolygon(
  mask: Uint8Array,
  W: number,
  H: number,
  epsilon = 2,
): number[] {
  const n = W * H;

  // 1) plus grande composante connexe (BFS itératif, 4-connexité)
  const labels = new Int32Array(n);
  let best: number[] = [];
  const stack: number[] = [];
  let label = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i] || labels[i]) continue;
    label++;
    stack.length = 0;
    stack.push(i);
    labels[i] = label;
    const comp: number[] = [];
    while (stack.length) {
      const p = stack.pop()!;
      comp.push(p);
      const x = p % W;
      const y = (p / W) | 0;
      if (y > 0 && mask[p - W] && !labels[p - W]) (labels[p - W] = label), stack.push(p - W);
      if (y < H - 1 && mask[p + W] && !labels[p + W]) (labels[p + W] = label), stack.push(p + W);
      if (x > 0 && mask[p - 1] && !labels[p - 1]) (labels[p - 1] = label), stack.push(p - 1);
      if (x < W - 1 && mask[p + 1] && !labels[p + 1]) (labels[p + 1] = label), stack.push(p + 1);
    }
    if (comp.length > best.length) best = comp;
  }
  if (best.length < 12) return [];

  const inComp = new Uint8Array(n);
  for (const p of best) inComp[p] = 1;
  const fg = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && inComp[y * W + x] === 1;

  // 2) point de départ = premier pixel (haut→bas, gauche→droite) de la composante
  let start = best[0];
  for (const p of best) if (p < start) start = p;
  const sx = start % W;
  const sy = (start / W) | 0;

  // suivi Moore-Neighbor (sens horaire), entrée depuis l'Ouest (index 4)
  const boundary: Array<[number, number]> = [[sx, sy]];
  let px = sx;
  let py = sy;
  let backtrack = 4;
  const maxIter = best.length * 8 + 16;
  for (let it = 0; it < maxIter; it++) {
    let found = -1;
    for (let i = 1; i <= 8; i++) {
      const dir = (backtrack + i) % 8;
      if (fg(px + DX[dir], py + DY[dir])) {
        found = dir;
        break;
      }
    }
    if (found < 0) break; // pixel isolé
    px += DX[found];
    py += DY[found];
    backtrack = (found + 4) % 8; // direction de retour vers la cellule précédente
    if (px === sx && py === sy) break; // boucle bouclée
    boundary.push([px, py]);
  }
  if (boundary.length < 6) return [];

  // 3) simplification Douglas–Peucker
  const simplified = rdp(boundary, epsilon);
  const out: number[] = [];
  for (const [x, y] of simplified) out.push(x, y);
  return out;
}

function rdp(pts: Array<[number, number]>, eps: number): Array<[number, number]> {
  if (pts.length < 3) return pts;
  let maxD = 0;
  let idx = 0;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], ax, ay, bx, by);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [pts[0], pts[pts.length - 1]];
  const left = rdp(pts.slice(0, idx + 1), eps);
  const right = rdp(pts.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

function perpDist(
  [x, y]: [number, number],
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1e-6;
  return Math.abs((x - ax) * dy - (y - ay) * dx) / len;
}
