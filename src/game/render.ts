import {
  WORLD_W,
  WORLD_H,
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
  const jugador = st.entities.find((e) => e.isPlayer)!;
  const camX = Math.max(0, Math.min(WORLD_W - vw, jugador.x - vw / 2));
  const camY = Math.max(0, Math.min(WORLD_H - vh, jugador.y - vh / 2));

  ctx.save();
  ctx.fillStyle = COL.suelo;
  ctx.fillRect(0, 0, vw, vh);
  ctx.translate(-camX, -camY);

  // baldosas
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

  // charcos
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

  // objetos del mapa
  for (const p of st.pickups) {
    if (p.tomado) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    const bob = Math.sin(st.t * 3 + p.id) * 3;
    ctx.translate(0, bob);
    if (p.kind === "botiquin") {
      ctx.fillStyle = "#f4f6fb";
      ctx.fillRect(-12, -9, 24, 18);
      ctx.fillStyle = "#e05b6b";
      ctx.fillRect(-2.5, -6, 5, 12);
      ctx.fillRect(-7, -2.5, 14, 5);
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
    const d = Math.hypot(p.x - jugador.x, p.y - jugador.y);
    if (d < 60) {
      ctx.fillStyle = "#f2c14e";
      ctx.font = "12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`E · ${ITEM_INFO[p.kind].nombre}`, p.x, p.y - 22);
    }
  }

  // paredes
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

  // golpes del atacante
  for (const s of st.swings) {
    const cx = s.x + s.fx * 44;
    const cy = s.y + s.fy * 44;
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

  // burbujas
  for (const b of st.bubbles) {
    ctx.fillStyle = `rgba(168, 85, 247, ${Math.max(0, b.vida) * 0.6})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3 + b.vida * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // cuchillos
  for (const k of st.knives) {
    const ang = Math.atan2(k.vy, k.vx);
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(ang);
    ctx.fillStyle = "#dfe6f2";
    ctx.fillRect(-9, -2, 18, 4);
    ctx.fillStyle = "#8b6b3f";
    ctx.fillRect(-11, -3, 5, 6);
    ctx.restore();
    if (debug) {
      ctx.strokeStyle = "#00ff88";
      ctx.beginPath();
      ctx.arc(k.x, k.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  for (const e of st.entities) dibujarEntidad(ctx, st, e, debug);

  ctx.restore();
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
  const base = e.isPlayer ? COL.player : e.team === "killer" ? COL.killer : COL.surv;

  // escudo
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

  // dirección
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(e.x + e.fx * (e.r + 8), e.y + e.fy * (e.r + 8));
  ctx.stroke();

  accesorio(ctx, e);

  // veneno
  if (e.veneno) {
    ctx.fillStyle = "rgba(168,85,247,0.9)";
    ctx.beginPath();
    ctx.arc(e.x + 12, e.y - 14, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // aturdido
  if (st.t < e.stunHasta) {
    ctx.fillStyle = "#f2c14e";
    ctx.font = "14px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("★", e.x, e.y - e.r - 16);
  }

  // barra de vida
  const w = 34;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5);
  ctx.fillStyle = e.team === "killer" ? "#e05b6b" : "#6ee7a8";
  ctx.fillRect(e.x - w / 2, e.y - e.r - 12, (w * Math.max(0, e.hp)) / e.maxHp, 5);
  if (e.escudo && st.t < e.escudo.hasta) {
    ctx.fillStyle = "#7eb2ff";
    ctx.fillRect(e.x - w / 2, e.y - e.r - 17, (w * e.escudo.hp) / 25, 3);
  }

  // canalización
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
      // gorro blanco con cruz verde
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
      // bandana negra
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
      // sombrero de mago
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
      // capucha ninja
      ctx.fillStyle = "#11141a";
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 15, 11, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#11141a";
      ctx.fillRect(x - 15, y + 2, 30, 6);
      ctx.fillStyle = "#c9203a";
      ctx.fillRect(x - 15, y + 6, 30, 3);
      break;
    }
    default:
      break; // asustadizo y venenoso no llevan accesorio
  }
}
