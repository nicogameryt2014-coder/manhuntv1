// Malla de navegación + A* con suavizado de línea de visión.
// Sin imports del motor para evitar ciclos de módulos.

export const CELL = 32;

export type NavRect = { x: number; y: number; w: number; h: number };
export type Grid = {
  cols: number;
  rows: number;
  bloqueado: Uint8Array;
  coste: Float32Array;
};

function rectColisiona(cx: number, cy: number, r: number, w: NavRect) {
  const px = Math.max(w.x, Math.min(cx, w.x + w.w));
  const py = Math.max(w.y, Math.min(cy, w.y + w.h));
  const dx = cx - px;
  const dy = cy - py;
  return dx * dx + dy * dy < r * r;
}

export function construirGrid(
  walls: NavRect[],
  worldW: number,
  worldH: number,
  radio = 17,
): Grid {
  const cols = Math.floor(worldW / CELL);
  const rows = Math.floor(worldH / CELL);
  const bloqueado = new Uint8Array(cols * rows);
  const coste = new Float32Array(cols * rows).fill(1);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cx = x * CELL + CELL / 2;
      const cy = y * CELL + CELL / 2;
      let bloq = false;
      for (const w of walls) {
        if (rectColisiona(cx, cy, radio, w)) {
          bloq = true;
          break;
        }
      }
      bloqueado[y * cols + x] = bloq ? 1 : 0;
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (bloqueado[y * cols + x]) continue;
      let vecinos = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (bloqueado[ny * cols + nx]) vecinos++;
        }
      }
      coste[y * cols + x] = 1 + vecinos * 0.6;
    }
  }
  return { cols, rows, bloqueado, coste };
}

export function celdaLibre(g: Grid, x: number, y: number) {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return false;
  return !g.bloqueado[cy * g.cols + cx];
}

function masCercanaLibre(g: Grid, x: number, y: number): number {
  const cx = Math.max(0, Math.min(g.cols - 1, Math.floor(x / CELL)));
  const cy = Math.max(0, Math.min(g.rows - 1, Math.floor(y / CELL)));
  if (!g.bloqueado[cy * g.cols + cx]) return cy * g.cols + cx;
  for (let r = 1; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
        if (!g.bloqueado[ny * g.cols + nx]) return ny * g.cols + nx;
      }
    }
  }
  return cy * g.cols + cx;
}

export function lineaLibre(g: Grid, x1: number, y1: number, x2: number, y2: number) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const pasos = Math.ceil(d / (CELL * 0.4));
  for (let i = 1; i < pasos; i++) {
    const t = i / pasos;
    if (!celdaLibre(g, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  return true;
}

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const;

/** A* sobre la malla. Devuelve puntos de mundo ya suavizados. */
export function buscarCamino(
  g: Grid,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  maxNodos = 3500,
): { x: number; y: number }[] {
  const cols = g.cols;
  const inicio = masCercanaLibre(g, sx, sy);
  const fin = masCercanaLibre(g, tx, ty);
  if (inicio === fin) return [{ x: tx, y: ty }];

  const n = cols * g.rows;
  const gScore = new Float32Array(n).fill(Infinity);
  const padre = new Int32Array(n).fill(-1);
  const cerrado = new Uint8Array(n);
  const f = new Float32Array(n).fill(Infinity);
  gScore[inicio] = 0;
  const fx = fin % cols;
  const fy = (fin / cols) | 0;
  f[inicio] = Math.hypot((inicio % cols) - fx, ((inicio / cols) | 0) - fy);

  const heap: number[] = [inicio];
  const push = (idx: number) => {
    heap.push(idx);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[heap[p]!]! <= f[heap[i]!]!) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && f[heap[l]!]! < f[heap[m]!]!) m = l;
        if (r < heap.length && f[heap[r]!]! < f[heap[m]!]!) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };

  let visitados = 0;
  let encontrado = false;
  while (heap.length && visitados < maxNodos) {
    const cur = pop();
    if (cerrado[cur]) continue;
    cerrado[cur] = 1;
    visitados++;
    if (cur === fin) {
      encontrado = true;
      break;
    }
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    for (const [dx, dy, w] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= g.rows) continue;
      const ni = ny * cols + nx;
      if (g.bloqueado[ni]) continue;
      if (dx !== 0 && dy !== 0 && (g.bloqueado[cy * cols + nx] || g.bloqueado[ny * cols + cx]))
        continue;
      const tent = gScore[cur]! + w * g.coste[ni]!;
      if (tent < gScore[ni]!) {
        gScore[ni] = tent;
        padre[ni] = cur;
        f[ni] = tent + Math.hypot(nx - fx, ny - fy) * 1.05;
        push(ni);
      }
    }
  }
  if (!encontrado) return [];

  const puntos: { x: number; y: number }[] = [];
  let cur = fin;
  while (cur !== -1) {
    puntos.push({ x: (cur % cols) * CELL + CELL / 2, y: ((cur / cols) | 0) * CELL + CELL / 2 });
    cur = padre[cur]!;
  }
  puntos.reverse();
  puntos.push({ x: tx, y: ty });

  const suave: { x: number; y: number }[] = [];
  let i = 0;
  let desdeX = sx;
  let desdeY = sy;
  while (i < puntos.length) {
    let j = puntos.length - 1;
    for (; j > i; j--) {
      if (lineaLibre(g, desdeX, desdeY, puntos[j]!.x, puntos[j]!.y)) break;
    }
    suave.push(puntos[j]!);
    desdeX = puntos[j]!.x;
    desdeY = puntos[j]!.y;
    if (j === puntos.length - 1) break;
    i = j + 1;
  }
  return suave;
}
