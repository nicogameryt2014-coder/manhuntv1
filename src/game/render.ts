import {
  WORLD_W,
  WORLD_H,
  SUFRIMIENTO,
  focoCamara,
  type Entity,
  type GameState,
  ITEM_INFO,
} from "./engine";

const COL = {
  suelo: "#151a22",
  baldosa: "#1b222c",
  pared: "#39465a",
  paredTop: "#4d5c74",
  surv: "#7fd1c0",
  killer: "#e05b6b",
  player: "#f2c14e",
};

export function render(
  ctx: CanvasRenderingContext2D,
  st: GameState,
  vw: number,
  vh: number,
  debug: boolean,
) {
  const jugadorReal = st.entities.find((e) => e.isPlayer)!;
  const foco = focoCamara(st);
  const fantasma = !jugadorReal.vivo;
  const jugador = foco;
  const camX = Math.max(0, Math.min(WORLD_W - vw, foco.x - vw / 2));
  const camY = Math.max(0, Math.min(WORLD_H - vh, foco.y - vh / 2));

  ctx.save();
  ctx.fillStyle = COL.suelo;
  ctx.fillRect(0, 0, vw, vh);
  ctx.translate(-camX, -camY);

  ctx.strokeStyle = COL.baldosa;
  ctx.lineWidth = 2;
  for (let x = 0; x <= WORLD_W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_H);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD_H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }

  for (const s of st.sangre) {
    const edad = Math.min(1, (st.t - s.nacida) / 8);
    ctx.fillStyle = `rgba(${Math.round(168 - edad * 60)}, 18, 28, ${0.75 - edad * 0.15})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of st.puddles) {
    const grad = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r);
    grad.addColorStop(0, "rgba(178, 245, 196, 0.75)");
    grad.addColorStop(1, "rgba(178, 245, 196, 0.15)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    if (debug) {
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  for (const p of st.pickups) {
    if (p.tomado) continue;
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(st.t * 3 + p.id) * 3);
    if (p.kind === "botiquin") {
      ctx.fillStyle = "#f4f6fb";
      ctx.fillRect(-12, -9, 24, 18);
      ctx.fillStyle = "#e05b6b";
      ctx.fillRect(-2.5, -6, 5, 12);
      ctx.fillRect(-7, -2.5, 14, 5);
    } else if (p.kind === "antidoto") {
      ctx.fillStyle = "#8ef0c6";
      ctx.beginPath();
      ctx.moveTo(-5, -10);
      ctx.lineTo(5, -10);
      ctx.lineTo(9, 10);
      ctx.lineTo(-9, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#2f6b52";
      ctx.fillRect(-5, -13, 10, 4);
      ctx.fillStyle = "#f4f6fb";
      ctx.fillRect(-2, 0, 4, 7);
      ctx.fillRect(-5, 2, 10, 3);
    } else {
      ctx.fillStyle = "#c1553c";
      ctx.fillRect(-7, -11, 14, 22);
      ctx.fillStyle = "#f4f6fb";
      ctx.fillRect(-7, -3, 14, 5);
    }
    ctx.restore();
    if (debug) {
      ctx.strokeStyle = "#00ff88";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (Math.hypot(p.x - jugador.x, p.y - jugador.y) < 60) {
      ctx.fillStyle = "#f2c14e";
      ctx.font = "12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`E · ${ITEM_INFO[p.kind].nombre}`, p.x, p.y - 22);
    }
  }

  for (const w of st.walls) {
    ctx.fillStyle = COL.pared;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = COL.paredTop;
    ctx.fillRect(w.x, w.y, w.w, 4);
    if (debug) {
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    }
  }

  if (st.salida) {
    const s = st.salida;
    const pulso = 0.5 + 0.5 * Math.sin(st.t * 3);
    const g = ctx.createRadialGradient(s.x, s.y, 6, s.x, s.y, s.r);
    g.addColorStop(0, `rgba(242, 233, 160, ${0.75 + pulso * 0.25})`);
    g.addColorStop(1, "rgba(120, 220, 160, 0.12)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 236, 130, ${0.6 + pulso * 0.4})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r + 10 + pulso * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#151a22";
    ctx.font = "bold 16px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("SALIDA", s.x, s.y + 5);
  }

  for (const s of st.swings) {
    const cx = s.x + s.fx * ATACANTE_ALCANCE;
    const cy = s.y + s.fy * ATACANTE_ALCANCE;
    ctx.beginPath();
    ctx.arc(cx, cy, ATACANTE_RADIO, 0, Math.PI * 2);

    ctx.fillStyle = "rgba(242, 193, 78, 0.35)";
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.fill();
    if (debug) {
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }
  }

  for (const b of st.bubbles) {
    ctx.fillStyle = `rgba(168, 85, 247, ${Math.max(0, b.vida) * 0.6})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3 + b.vida * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const k of st.knives) {
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(Math.atan2(k.vy, k.vx));
    ctx.fillStyle = "#dfe6f2";
    ctx.fillRect(-9, -2, 18, 4);
    ctx.fillStyle = "#8b6b3f";
    ctx.fillRect(-11, -3, 5, 6);
    ctx.restore();
  }

  if (debug) dibujarCaminos(ctx, st);

  for (const e of st.entities) dibujarEntidad(ctx, st, e, debug);

  if (fantasma) dibujarFantasma(ctx, st, foco);

  ctx.restore();

  indicadoresBorde(ctx, st, jugador, camX, camY, vw, vh);
  if (st.salida) indicadorSalida(ctx, st, camX, camY, vw, vh);
  if (!fantasma) efectosVidaBaja(ctx, st, jugadorReal, vw, vh);
}

/** Gran marcador en el borde apuntando hacia la salida. */
function indicadorSalida(
  ctx: CanvasRenderingContext2D,
  st: GameState,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
) {
  const s = st.salida!;
  const sx = s.x - camX;
  const sy = s.y - camY;
  if (sx > 0 && sx < vw && sy > 0 && sy < vh) return;
  const cx = vw / 2;
  const cy = vh / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const margen = 54;
  const hw = vw / 2 - margen;
  const hh = vh / 2 - margen;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const t = Math.min(Math.abs(hw / (cos || 1e-6)), Math.abs(hh / (sin || 1e-6)));
  const px = cx + cos * t;
  const py = cy + sin * t;
  const pulso = 0.5 + 0.5 * Math.sin(st.t * 4);

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = `rgba(255, 224, 110, ${0.65 + pulso * 0.35})`;
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(8, -24);
  ctx.lineTo(8, 24);
  ctx.closePath();
  ctx.fill();
  ctx.rotate(-ang);
  ctx.fillStyle = "rgba(12,14,18,0.9)";
  ctx.strokeStyle = "#ffe06e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffe06e";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("SALIDA", 0, -1);
  const dist = Math.round(Math.hypot(s.x - (camX + vw / 2), s.y - (camY + vh / 2)) / 10);
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillText(`${dist} m`, 0, 12);
  ctx.restore();
}

/** Espíritu del jugador muerto flotando junto a quien observa. */
function dibujarFantasma(ctx: CanvasRenderingContext2D, st: GameState, foco: Entity) {
  const x = foco.x - 30;
  const y = foco.y - 34 + Math.sin(st.t * 2) * 5;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#dfe6f2";
  ctx.beginPath();
  ctx.arc(x, y, 12, Math.PI, 0);
  ctx.lineTo(x + 12, y + 12);
  for (let i = 0; i < 3; i++) {
    ctx.quadraticCurveTo(x + 8 - i * 8, y + 18, x + 4 - i * 8, y + 12);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#151a22";
  ctx.beginPath();
  ctx.arc(x - 4, y - 2, 2, 0, Math.PI * 2);
  ctx.arc(x + 4, y - 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function dibujarCaminos(ctx: CanvasRenderingContext2D, st: GameState) {
  for (const e of st.entities) {
    if (!e.vivo || e.isPlayer || e.caminoIdx >= e.camino.length) continue;
    ctx.strokeStyle = e.team === "killer" ? "rgba(224,91,107,0.5)" : "rgba(127,209,192,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    for (let i = e.caminoIdx; i < e.camino.length; i++) ctx.lineTo(e.camino[i]!.x, e.camino[i]!.y);
    ctx.stroke();
    ctx.fillStyle = "#00ff88";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(e.rol, e.x, e.y - e.r - 26);
  }
}

/** Burbujas con flecha en los bordes para quien está fuera de cámara. */
function indicadoresBorde(
  ctx: CanvasRenderingContext2D,
  st: GameState,
  jugador: Entity,
  camX: number,
  camY: number,
  vw: number,
  vh: number,
) {
  const margen = 26;
  type Marca = {
    e: Entity;
    px: number;
    py: number;
    ang: number;
    alpha: number;
    esAsesino: boolean;
    color: string;
    R: number;
    dist: number;
  };
  const marcas: Marca[] = [];

  for (const e of st.entities) {
    if (!e.vivo || e.isPlayer) continue;
    const sx = e.x - camX;
    const sy = e.y - camY;
    if (sx > -10 && sx < vw + 10 && sy > -10 && sy < vh + 10) continue;

    const cx = vw / 2;
    const cy = vh / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const hw = vw / 2 - margen;
    const hh = vh / 2 - margen;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const t = Math.min(Math.abs(hw / (cos || 1e-6)), Math.abs(hh / (sin || 1e-6)));
    const dist = Math.hypot(e.x - jugador.x, e.y - jugador.y);
    const esAsesino = e.team === "killer";
    marcas.push({
      e,
      px: cx + cos * t,
      py: cy + sin * t,
      ang,
      alpha: Math.max(0.32, Math.min(0.95, 1 - dist / 1700)),
      esAsesino,
      color: e.sufriendo ? "#f5c518" : esAsesino ? "#e05b6b" : "#7fd1c0",
      R: e.sufriendo ? 16 : esAsesino ? 12 : 10,
      dist,
    });
  }

  // prioriza lo cercano y lo peligroso, y limita la cantidad para no tapar la pantalla
  marcas.sort((a, b) => a.dist - b.dist - (a.esAsesino ? 250 : 0) + (b.esAsesino ? 250 : 0));
  const visibles = marcas.slice(0, 12);

  // separa las burbujas que se solapan, deslizándolas por el borde
  for (let iter = 0; iter < 6; iter++) {
    for (let i = 0; i < visibles.length; i++) {
      for (let j = i + 1; j < visibles.length; j++) {
        const a = visibles[i]!;
        const b = visibles[j]!;
        const dx = b.px - a.px;
        const dy = b.py - a.py;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.R + b.R + 8;
        if (d < min) {
          const emp = ((min - d) / 2) * 1.02;
          a.px -= (dx / d) * emp;
          a.py -= (dy / d) * emp;
          b.px += (dx / d) * emp;
          b.py += (dy / d) * emp;
        }
      }
    }
    for (const m of visibles) {
      m.px = Math.max(margen, Math.min(vw - margen, m.px));
      m.py = Math.max(margen, Math.min(vh - margen, m.py));
      // vuelve a pegar la burbuja al borde más próximo
      const dIzq = m.px - margen;
      const dDer = vw - margen - m.px;
      const dArr = m.py - margen;
      const dAba = vh - margen - m.py;
      const menor = Math.min(dIzq, dDer, dArr, dAba);
      if (menor === dIzq) m.px = margen;
      else if (menor === dDer) m.px = vw - margen;
      else if (menor === dArr) m.py = margen;
      else m.py = vh - margen;
    }
  }

  for (const { e, px, py, ang, alpha, esAsesino, color, R } of visibles) {


    ctx.save();
    ctx.globalAlpha = alpha;

    // flecha apuntando hacia afuera
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(R + 10, 0);
    ctx.lineTo(R + 1, -6);
    ctx.lineTo(R + 1, 6);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-ang);

    // burbuja: círculo = sobreviviente, rombo = asesino
    ctx.fillStyle = "rgba(10,12,16,0.85)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (esAsesino) {
      ctx.moveTo(0, -R - 2);
      ctx.lineTo(R + 2, 0);
      ctx.lineTo(0, R + 2);
      ctx.lineTo(-R - 2, 0);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, R, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // anillo de vida
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.strokeStyle = esAsesino ? "#ff8a95" : "#6ee7a8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, R + 5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();

    // símbolo interior: ✚ sobreviviente, ✕ asesino
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (esAsesino) {
      ctx.moveTo(-4, -4);
      ctx.lineTo(4, 4);
      ctx.moveTo(4, -4);
      ctx.lineTo(-4, 4);
    } else {
      ctx.moveTo(0, -4.5);
      ctx.lineTo(0, 4.5);
      ctx.moveTo(-4.5, 0);
      ctx.lineTo(4.5, 0);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function efectosVidaBaja(
  ctx: CanvasRenderingContext2D,
  st: GameState,
  jugador: Entity,
  vw: number,
  vh: number,
) {
  const frac = jugador.hp / jugador.maxHp;
  if (frac >= 0.5 && !jugador.veneno) return;
  const grave = Math.max(0, 1 - frac / 0.5); // 0 -> 1 según gravedad
  const pulso = 0.5 + 0.5 * Math.sin(st.t * (3 + grave * 5));
  const intensidad = grave * (0.45 + pulso * 0.55);

  const grad = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.25, vw / 2, vh / 2, vh * 0.78);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, `rgba(150, 12, 30, ${0.18 + intensidad * 0.55})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);

  if (jugador.veneno) {
    const gp = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.3, vw / 2, vh / 2, vh * 0.8);
    gp.addColorStop(0, "rgba(0,0,0,0)");
    gp.addColorStop(1, "rgba(120, 40, 190, 0.35)");
    ctx.fillStyle = gp;
    ctx.fillRect(0, 0, vw, vh);
  }

  if (grave > 0.6) {
    ctx.strokeStyle = `rgba(220, 60, 80, ${0.25 * intensidad})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = ((st.t * 60 + i * 137) % vh) | 0;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(vw, y);
      ctx.stroke();
    }
  }
}

function dibujarEntidad(
  ctx: CanvasRenderingContext2D,
  st: GameState,
  e: Entity,
  debug: boolean,
) {
  if (!e.vivo) {
    ctx.fillStyle = "rgba(120,130,150,0.35)";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const base = e.sufriendo
    ? "#b3364a"
    : e.isPlayer
      ? COL.player
      : e.team === "killer"
        ? COL.killer
        : COL.surv;

  if (e.sufriendo) {
    const radio = SUFRIMIENTO.radioRevivir + e.r;
    ctx.strokeStyle = "rgba(96, 165, 250, 0.55)";
    ctx.setLineDash([8, 7]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, radio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (e.escudo && st.t < e.escudo.hasta) {
    ctx.strokeStyle = "rgba(126, 178, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(e.x + e.fx * (e.r + 8), e.y + e.fy * (e.r + 8));
  ctx.stroke();

  accesorio(ctx, e);

  if (e.veneno) {
    ctx.fillStyle = "rgba(168,85,247,0.9)";
    ctx.beginPath();
    ctx.arc(e.x + 12, e.y - 14, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (st.t < e.stunHasta) {
    ctx.fillStyle = "#f2c14e";
    ctx.font = "14px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("★", e.x, e.y - e.r - 16);
  }

  const w = 34;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5);
  ctx.fillStyle = e.sufriendo ? "#ef2740" : e.team === "killer" ? "#e05b6b" : "#6ee7a8";
  ctx.fillRect(e.x - w / 2, e.y - e.r - 12, (w * Math.max(0, e.hp)) / e.maxHp, 5);
  if (e.sufriendo) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(e.x - w / 2, e.y - e.r - 19, w, 5);
    ctx.fillStyle = "#4f9dff";
    ctx.fillRect(
      e.x - w / 2,
      e.y - e.r - 19,
      (w * e.revive) / SUFRIMIENTO.segundosRevivir,
      5,
    );
  }
  if (e.escudo && st.t < e.escudo.hasta) {
    ctx.fillStyle = "#7eb2ff";
    ctx.fillRect(e.x - w / 2, e.y - e.r - 17, (w * e.escudo.hp) / 25, 3);
  }

  if (e.canalizando) {
    const p = 1 - (e.canalizando.fin - st.t) / e.canalizando.total;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(e.x - 22, e.y + e.r + 6, 44, 6);
    ctx.fillStyle = "#f2c14e";
    ctx.fillRect(e.x - 22, e.y + e.r + 6, 44 * p, 6);
  }

  if (debug) {
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#00ff88";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${e.nombre} ${Math.round(e.hp)}`, e.x, e.y + e.r + 22);
  }
}

function accesorio(ctx: CanvasRenderingContext2D, e: Entity) {
  const x = e.x;
  const y = e.y - e.r - 2;
  switch (e.ability) {
    case "medico": {
      ctx.fillStyle = "#f7f9fc";
      ctx.beginPath();
      ctx.ellipse(x, y, 14, 8, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - 15, y - 1, 30, 4);
      ctx.fillStyle = "#2fbf6b";
      ctx.fillRect(x - 1.5, y - 8, 3, 8);
      ctx.fillRect(x - 5, y - 6, 10, 3);
      break;
    }
    case "atacante": {
      ctx.fillStyle = "#14161c";
      ctx.fillRect(x - 15, y - 2, 30, 7);
      ctx.beginPath();
      ctx.moveTo(x + 13, y + 2);
      ctx.lineTo(x + 24, y + 10);
      ctx.lineTo(x + 13, y + 8);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "mago": {
      ctx.fillStyle = "#4c3b8f";
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 3);
      ctx.lineTo(x + 12, y + 3);
      ctx.lineTo(x + 2, y - 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#2f2560";
      ctx.fillRect(x - 17, y + 2, 34, 5);
      ctx.fillStyle = "#f2c14e";
      ctx.beginPath();
      ctx.arc(x + 3, y - 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "ninja": {
      ctx.fillStyle = "#11141a";
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 15, 11, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - 15, y + 2, 30, 6);
      ctx.fillStyle = "#c9203a";
      ctx.fillRect(x - 15, y + 6, 30, 3);
      break;
    }
    default:
      break;
  }
}
