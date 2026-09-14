// Motor del juego de supervivencia: asesinos vs sobrevivientes.
// Todo el estado vive en un objeto plano que se actualiza con step(dt).

export type SurvivorAbility = "medico" | "atacante" | "asustadizo" | "mago";
export type KillerAbility = "venenoso" | "ninja";
export type ItemKind = "botiquin" | "cola";

export const SURVIVOR_ABILITIES: SurvivorAbility[] = [
  "medico",
  "atacante",
  "asustadizo",
  "mago",
];

export const ABILITY_INFO: Record<
  SurvivorAbility | KillerAbility,
  { nombre: string; cooldown: number; desc: string }
> = {
  medico: {
    nombre: "Médico",
    cooldown: 15,
    desc: "Lanza un charco curativo (3 s). +3 HP/s, o +6 HP/s si el médico tiene más de 40 HP.",
  },
  atacante: {
    nombre: "Atacante",
    cooldown: 35,
    desc: "Golpe en la dirección de avance. Aturde asesinos 5 s y te da 1.5x velocidad por 2 s.",
  },
  asustadizo: {
    nombre: "Asustadizo",
    cooldown: 30,
    desc: "Velocidad x3 por 10 s; luego quedas ralentizado 4 s.",
  },
  mago: {
    nombre: "Mago",
    cooldown: 15,
    desc: "Escudo de 25 HP por 5 s al sobreviviente más cercano. Mientras dura vas a 0.2x y no puedes correr. Cancelarlo suma 10 s de cooldown.",
  },
  venenoso: {
    nombre: "Venenoso",
    cooldown: 45,
    desc: "Su golpe envenena 6 s (0.5 HP/s).",
  },
  ninja: {
    nombre: "Ninja",
    cooldown: 20,
    desc: "Lanza 3 cuchillos en abanico. 25 HP de daño, chocan con paredes.",
  },
};

export const ITEM_INFO: Record<
  ItemKind,
  { nombre: string; canal: number; desc: string }
> = {
  botiquin: { nombre: "Botiquín", canal: 5, desc: "Cura 35 HP (5 s, cancelable)" },
  cola: { nombre: "Cola", canal: 2, desc: "1.5x velocidad por 10 s (2 s, cancelable)" },
};

export const MAGO_COOLDOWN_BASE = 15;
export const MAGO_PENALIZACION_CANCELAR = 10;

// Velocidades base (px/s)
const SURV_WALK = 118;
const SURV_RUN = 190;
const KILL_WALK = 126;
const KILL_RUN = SURV_RUN * 0.85; // los asesinos corren más lento que los sobrevivientes

export const WORLD_W = 1600;
export const WORLD_H = 1100;

export type Rect = { x: number; y: number; w: number; h: number };

export type Entity = {
  id: number;
  nombre: string;
  team: "survivor" | "killer";
  ability: SurvivorAbility | KillerAbility;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  fx: number; // facing
  fy: number;
  isPlayer: boolean;
  cooldownHasta: number;
  cooldownTotal: number;
  stunHasta: number;
  boost: { mult: number; hasta: number } | null;
  slowHasta: number;
  veneno: { hasta: number; sig: number } | null;
  escudo: { hp: number; hasta: number } | null;
  canalizando: { tipo: ItemKind; fin: number; total: number } | null;
  escudoActivoSobre: number | null; // solo mago
  inventario: Partial<Record<ItemKind, boolean>>;
  ataqueListo: number; // solo asesinos (golpe cuerpo a cuerpo)
  vivo: boolean;
  iaObjetivo: { x: number; y: number } | null;
  iaSig: number;
};

export type Knife = { x: number; y: number; vx: number; vy: number; owner: number; vivo: boolean };
export type Puddle = { x: number; y: number; r: number; hasta: number; curacion: number };
export type Swing = { x: number; y: number; fx: number; fy: number; hasta: number };
export type Bubble = { x: number; y: number; vy: number; vida: number };
export type Pickup = { id: number; x: number; y: number; kind: ItemKind; tomado: boolean };

export type GameState = {
  t: number;
  estado: "jugando" | "ganado" | "perdido";
  walls: Rect[];
  entities: Entity[];
  knives: Knife[];
  puddles: Puddle[];
  swings: Swing[];
  bubbles: Bubble[];
  pickups: Pickup[];
  mensajes: { texto: string; hasta: number }[];
  tiempoRestante: number;
};

export type Input = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  usarHabilidad: boolean;
  recoger: boolean;
  usarItem: ItemKind | null;
  cancelar: boolean;
};

let nextId = 1;

function walls(): Rect[] {
  const w: Rect[] = [
    { x: 0, y: 0, w: WORLD_W, h: 24 },
    { x: 0, y: WORLD_H - 24, w: WORLD_W, h: 24 },
    { x: 0, y: 0, w: 24, h: WORLD_H },
    { x: WORLD_W - 24, y: 0, w: 24, h: WORLD_H },
    { x: 240, y: 160, w: 260, h: 28 },
    { x: 240, y: 160, w: 28, h: 240 },
    { x: 640, y: 120, w: 28, h: 300 },
    { x: 820, y: 260, w: 300, h: 28 },
    { x: 1240, y: 140, w: 28, h: 320 },
    { x: 380, y: 520, w: 320, h: 28 },
    { x: 880, y: 480, w: 28, h: 300 },
    { x: 1020, y: 620, w: 300, h: 28 },
    { x: 200, y: 700, w: 28, h: 240 },
    { x: 400, y: 860, w: 380, h: 28 },
    { x: 1360, y: 700, w: 28, h: 240 },
  ];
  return w;
}

function nuevaEntidad(
  nombre: string,
  team: Entity["team"],
  ability: SurvivorAbility | KillerAbility,
  x: number,
  y: number,
  isPlayer = false,
): Entity {
  return {
    id: nextId++,
    nombre,
    team,
    ability,
    x,
    y,
    r: 15,
    hp: 100,
    maxHp: 100,
    fx: 0,
    fy: 1,
    isPlayer,
    cooldownHasta: 0,
    cooldownTotal: ABILITY_INFO[ability].cooldown,
    stunHasta: 0,
    boost: null,
    slowHasta: 0,
    veneno: null,
    escudo: null,
    canalizando: null,
    escudoActivoSobre: null,
    inventario: {},
    ataqueListo: 0,
    vivo: true,
    iaObjetivo: null,
    iaSig: 0,
  };
}

export function crearJuego(habilidadJugador: SurvivorAbility): GameState {
  nextId = 1;
  const ents: Entity[] = [];
  ents.push(nuevaEntidad("Tú", "survivor", habilidadJugador, 120, 980, true));

  const otras = SURVIVOR_ABILITIES.filter((a) => a !== habilidadJugador);
  const puntos = [
    { x: 160, y: 120 },
    { x: 1420, y: 180 },
    { x: 1440, y: 980 },
  ];
  otras.forEach((a, i) => {
    const p = puntos[i]!;
    ents.push(nuevaEntidad(ABILITY_INFO[a].nombre, "survivor", a, p.x, p.y));
  });

  ents.push(nuevaEntidad("Venenoso", "killer", "venenoso", 760, 560));
  ents.push(nuevaEntidad("Ninja", "killer", "ninja", 980, 180));

  const pickups: Pickup[] = [
    { id: nextId++, x: 340, y: 300, kind: "botiquin", tomado: false },
    { id: nextId++, x: 1120, y: 420, kind: "botiquin", tomado: false },
    { id: nextId++, x: 560, y: 760, kind: "botiquin", tomado: false },
    { id: nextId++, x: 300, y: 640, kind: "cola", tomado: false },
    { id: nextId++, x: 1300, y: 840, kind: "cola", tomado: false },
    { id: nextId++, x: 980, y: 120, kind: "cola", tomado: false },
  ];

  return {
    t: 0,
    estado: "jugando",
    walls: walls(),
    entities: ents,
    knives: [],
    puddles: [],
    swings: [],
    bubbles: [],
    pickups,
    mensajes: [],
    tiempoRestante: 180,
  };
}

function colisiona(x: number, y: number, r: number, walls: Rect[]): boolean {
  for (const w of walls) {
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

function mover(e: Entity, dx: number, dy: number, st: GameState) {
  if (!colisiona(e.x + dx, e.y, e.r, st.walls)) e.x += dx;
  if (!colisiona(e.x, e.y + dy, e.r, st.walls)) e.y += dy;
  e.x = Math.max(e.r, Math.min(WORLD_W - e.r, e.x));
  e.y = Math.max(e.r, Math.min(WORLD_H - e.r, e.y));
}

export function velocidad(e: Entity, st: GameState, corriendo: boolean): number {
  if (st.t < e.stunHasta) return 0;
  if (e.canalizando) return 0;
  const esSurv = e.team === "survivor";
  let base = esSurv
    ? corriendo
      ? SURV_RUN
      : SURV_WALK
    : corriendo
      ? KILL_RUN
      : KILL_WALK;
  // El mago se ralentiza y no puede correr mientras mantiene el escudo
  if (e.ability === "mago" && e.escudoActivoSobre !== null) base = SURV_WALK * 0.2;
  if (e.boost && st.t < e.boost.hasta) base *= e.boost.mult;
  const conBoost = !!(e.boost && st.t < e.boost.hasta);
  if (st.t < e.slowHasta && !conBoost) base *= 0.45;
  return base;
}

export function puedeCorrer(e: Entity): boolean {
  return !(e.ability === "mago" && e.escudoActivoSobre !== null);
}

function msg(st: GameState, texto: string) {
  st.mensajes.push({ texto, hasta: st.t + 2.5 });
}

function danar(st: GameState, e: Entity, cantidad: number) {
  let d = cantidad;
  if (e.escudo && st.t < e.escudo.hasta) {
    const absorbido = Math.min(e.escudo.hp, d);
    e.escudo.hp -= absorbido;
    d -= absorbido;
    if (e.escudo.hp <= 0) liberarEscudo(st, e);
  }
  e.hp -= d;
  if (e.hp <= 0) {
    e.hp = 0;
    e.vivo = false;
    msg(st, `${e.nombre} ha caído`);
  }
}

function liberarEscudo(st: GameState, objetivo: Entity) {
  objetivo.escudo = null;
  for (const m of st.entities) {
    if (m.escudoActivoSobre === objetivo.id) m.escudoActivoSobre = null;
  }
}

export function cancelarEscudoMago(st: GameState, mago: Entity) {
  if (mago.escudoActivoSobre === null) return;
  const obj = st.entities.find((e) => e.id === mago.escudoActivoSobre);
  if (obj) obj.escudo = null;
  mago.escudoActivoSobre = null;
  mago.cooldownHasta += MAGO_PENALIZACION_CANCELAR;
  mago.cooldownTotal = MAGO_COOLDOWN_BASE + MAGO_PENALIZACION_CANCELAR;
  msg(st, "Escudo cancelado: +10 s de cooldown");
}

export function usarHabilidad(st: GameState, e: Entity) {
  if (!e.vivo || st.t < e.stunHasta) return;
  if (e.ability === "mago" && e.escudoActivoSobre !== null) {
    cancelarEscudoMago(st, e);
    return;
  }
  if (st.t < e.cooldownHasta) return;
  const cd = ABILITY_INFO[e.ability].cooldown;

  switch (e.ability) {
    case "medico": {
      const curacion = e.hp > 40 ? 6 : 3;
      st.puddles.push({
        x: e.x + e.fx * 46,
        y: e.y + e.fy * 46,
        r: 52,
        hasta: st.t + 3,
        curacion,
      });
      break;
    }
    case "atacante": {
      st.swings.push({ x: e.x, y: e.y, fx: e.fx, fy: e.fy, hasta: st.t + 0.25 });
      const cx = e.x + e.fx * 44;
      const cy = e.y + e.fy * 44;
      for (const o of st.entities) {
        if (o.team !== "killer" || !o.vivo) continue;
        const d = Math.hypot(o.x - cx, o.y - cy);
        if (d < 46 + o.r) {
          o.stunHasta = st.t + 5;
          msg(st, `${o.nombre} aturdido 5 s`);
        }
      }
      e.boost = { mult: 1.5, hasta: st.t + 2 };
      break;
    }
    case "asustadizo": {
      e.boost = { mult: 3, hasta: st.t + 10 };
      e.slowHasta = st.t + 14; // se aplica al terminar el boost, dura 4 s
      break;
    }
    case "mago": {
      let mejor: Entity | null = null;
      let mejorD = Infinity;
      for (const o of st.entities) {
        if (o.team !== "survivor" || !o.vivo || o.id === e.id) continue;
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < mejorD) {
          mejorD = d;
          mejor = o;
        }
      }
      const objetivo = mejor ?? e;
      objetivo.escudo = { hp: 25, hasta: st.t + 5 };
      e.escudoActivoSobre = objetivo.id;
      e.cooldownTotal = MAGO_COOLDOWN_BASE;
      msg(st, `Escudo sobre ${objetivo.nombre}`);
      break;
    }
    case "ninja": {
      const ang = Math.atan2(e.fy, e.fx);
      for (const off of [-0.28, 0, 0.28]) {
        st.knives.push({
          x: e.x + Math.cos(ang + off) * 22,
          y: e.y + Math.sin(ang + off) * 22,
          vx: Math.cos(ang + off) * 460,
          vy: Math.sin(ang + off) * 460,
          owner: e.id,
          vivo: true,
        });
      }
      break;
    }
    case "venenoso": {
      // el veneno es pasivo durante 8 s: sus golpes envenenan
      e.boost = e.boost;
      (e as Entity & { venenoArmadoHasta?: number }).venenoArmadoHasta = st.t + 8;
      for (let i = 0; i < 14; i++) {
        st.bubbles.push({
          x: e.x + (Math.random() - 0.5) * 30,
          y: e.y + (Math.random() - 0.5) * 30,
          vy: -30 - Math.random() * 30,
          vida: 1.2,
        });
      }
      break;
    }
  }
  e.cooldownHasta = st.t + cd;
  e.cooldownTotal = cd;
}

export function iniciarItem(st: GameState, e: Entity, kind: ItemKind) {
  if (!e.inventario[kind] || e.canalizando || !e.vivo) return;
  const total = ITEM_INFO[kind].canal;
  e.canalizando = { tipo: kind, fin: st.t + total, total };
}

export function cancelarCanal(e: Entity) {
  e.canalizando = null;
}

function terminarCanal(st: GameState, e: Entity) {
  const c = e.canalizando!;
  e.canalizando = null;
  e.inventario[c.tipo] = false;
  if (c.tipo === "botiquin") {
    e.hp = Math.min(e.maxHp, e.hp + 35);
    msg(st, `${e.nombre} usó un botiquín (+35 HP)`);
  } else {
    e.boost = { mult: 1.5, hasta: st.t + 10 };
    msg(st, `${e.nombre} bebió cola (1.5x, 10 s)`);
  }
}

export function intentarRecoger(st: GameState, e: Entity) {
  if (e.team !== "survivor") return;
  for (const p of st.pickups) {
    if (p.tomado) continue;
    if (Math.hypot(p.x - e.x, p.y - e.y) < 34) {
      if (e.inventario[p.kind]) {
        msg(st, `Ya llevas un ${ITEM_INFO[p.kind].nombre.toLowerCase()}`);
        return;
      }
      e.inventario[p.kind] = true;
      p.tomado = true;
      msg(st, `${ITEM_INFO[p.kind].nombre} recogido`);
      return;
    }
  }
}

function golpeAsesino(st: GameState, k: Entity, objetivo: Entity) {
  danar(st, objetivo, 20);
  const armado = (k as Entity & { venenoArmadoHasta?: number }).venenoArmadoHasta ?? 0;
  if (k.ability === "venenoso" && st.t < armado) {
    objetivo.veneno = { hasta: st.t + 6, sig: st.t + 1 };
  }
  k.ataqueListo = st.t + 1.6;
}

function ia(st: GameState, e: Entity, dt: number) {
  if (st.t < e.stunHasta || e.canalizando) return;
  const vivos = st.entities.filter((o) => o.vivo);
  if (e.team === "killer") {
    let objetivo: Entity | null = null;
    let mejor = Infinity;
    for (const s of vivos) {
      if (s.team !== "survivor") continue;
      const d = Math.hypot(s.x - e.x, s.y - e.y);
      if (d < mejor) {
        mejor = d;
        objetivo = s;
      }
    }
    if (!objetivo) return;
    const ang = Math.atan2(objetivo.y - e.y, objetivo.x - e.x);
    e.fx = Math.cos(ang);
    e.fy = Math.sin(ang);
    const corriendo = mejor > 120;
    const v = velocidad(e, st, corriendo) * dt;
    if (mejor > e.r + objetivo.r + 2) mover(e, Math.cos(ang) * v, Math.sin(ang) * v, st);
    if (mejor < e.r + objetivo.r + 8 && st.t > e.ataqueListo) golpeAsesino(st, e, objetivo);
    if (st.t >= e.cooldownHasta) {
      if (e.ability === "ninja" && mejor < 420 && mejor > 70) usarHabilidad(st, e);
      if (e.ability === "venenoso" && mejor < 200) usarHabilidad(st, e);
    }
  } else {
    // sobrevivientes bot: huyen del asesino más cercano y usan su habilidad
    let amenaza: Entity | null = null;
    let mejor = Infinity;
    for (const k of vivos) {
      if (k.team !== "killer") continue;
      const d = Math.hypot(k.x - e.x, k.y - e.y);
      if (d < mejor) {
        mejor = d;
        amenaza = k;
      }
    }
    let ang: number;
    if (amenaza && mejor < 320) {
      ang = Math.atan2(e.y - amenaza.y, e.x - amenaza.x);
      if (st.t >= e.cooldownHasta) {
        if (e.ability === "atacante" && mejor < 70) {
          e.fx = -Math.cos(ang);
          e.fy = -Math.sin(ang);
          usarHabilidad(st, e);
        } else if (e.ability === "asustadizo" && mejor < 200) usarHabilidad(st, e);
        else if (e.ability === "mago" && mejor < 260) usarHabilidad(st, e);
        else if (e.ability === "medico" && e.hp < 90) usarHabilidad(st, e);
      }
    } else {
      if (!e.iaObjetivo || st.t > e.iaSig) {
        e.iaObjetivo = {
          x: 80 + Math.random() * (WORLD_W - 160),
          y: 80 + Math.random() * (WORLD_H - 160),
        };
        e.iaSig = st.t + 4;
      }
      ang = Math.atan2(e.iaObjetivo.y - e.y, e.iaObjetivo.x - e.x);
      if (e.ability === "medico" && e.hp < 70 && st.t >= e.cooldownHasta) usarHabilidad(st, e);
    }
    e.fx = Math.cos(ang);
    e.fy = Math.sin(ang);
    const v = velocidad(e, st, puedeCorrer(e) && mejor < 320) * dt;
    mover(e, Math.cos(ang) * v, Math.sin(ang) * v, st);
  }
}

export function step(st: GameState, dt: number, input: Input) {
  if (st.estado !== "jugando") return;
  st.t += dt;
  st.tiempoRestante = Math.max(0, st.tiempoRestante - dt);

  const jugador = st.entities.find((e) => e.isPlayer)!;

  // --- jugador ---
  if (jugador.vivo) {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const moviendo = dx !== 0 || dy !== 0;
    if (moviendo) {
      const l = Math.hypot(dx, dy);
      dx /= l;
      dy /= l;
      jugador.fx = dx;
      jugador.fy = dy;
      if (jugador.canalizando) cancelarCanal(jugador);
    }
    if (input.cancelar) {
      if (jugador.canalizando) cancelarCanal(jugador);
      else if (jugador.ability === "mago" && jugador.escudoActivoSobre !== null)
        cancelarEscudoMago(st, jugador);
    }
    if (input.usarHabilidad) usarHabilidad(st, jugador);
    if (input.recoger) intentarRecoger(st, jugador);
    if (input.usarItem) iniciarItem(st, jugador, input.usarItem);

    const corriendo = input.run && puedeCorrer(jugador);
    const v = velocidad(jugador, st, corriendo) * dt;
    if (moviendo && v > 0) mover(jugador, dx * v, dy * v, st);
    if (jugador.canalizando && st.t >= jugador.canalizando.fin) terminarCanal(st, jugador);
  }

  // --- IA ---
  for (const e of st.entities) {
    if (!e.vivo || e.isPlayer) continue;
    ia(st, e, dt);
    if (e.canalizando && st.t >= e.canalizando.fin) terminarCanal(st, e);
  }

  // --- efectos por entidad ---
  for (const e of st.entities) {
    if (!e.vivo) continue;
    if (e.veneno) {
      if (st.t >= e.veneno.sig) {
        danar(st, e, 0.5);
        e.veneno.sig += 1;
      }
      if (st.t >= e.veneno.hasta) e.veneno = null;
    }
    if (e.escudo && st.t >= e.escudo.hasta) liberarEscudo(st, e);
    if (e.boost && st.t >= e.boost.hasta) e.boost = null;
    // charcos curativos
    for (const p of st.puddles) {
      if (e.team !== "survivor") continue;
      if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) {
        e.hp = Math.min(e.maxHp, e.hp + p.curacion * dt);
      }
    }
  }

  // --- cuchillos ---
  for (const k of st.knives) {
    if (!k.vivo) continue;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    if (colisiona(k.x, k.y, 4, st.walls)) {
      k.vivo = false;
      continue;
    }
    for (const e of st.entities) {
      if (!e.vivo || e.team !== "survivor") continue;
      if (Math.hypot(e.x - k.x, e.y - k.y) < e.r + 5) {
        danar(st, e, 25);
        k.vivo = false;
        break;
      }
    }
  }
  st.knives = st.knives.filter((k) => k.vivo);

  // --- burbujas de veneno ---
  for (const b of st.bubbles) {
    b.y += b.vy * dt;
    b.vida -= dt;
  }
  st.bubbles = st.bubbles.filter((b) => b.vida > 0);
  for (const k of st.entities) {
    const armado = (k as Entity & { venenoArmadoHasta?: number }).venenoArmadoHasta ?? 0;
    if (k.ability === "venenoso" && k.vivo && st.t < armado && Math.random() < dt * 12) {
      st.bubbles.push({
        x: k.x + (Math.random() - 0.5) * 26,
        y: k.y + (Math.random() - 0.5) * 26,
        vy: -34,
        vida: 1,
      });
    }
  }

  st.puddles = st.puddles.filter((p) => st.t < p.hasta);
  st.swings = st.swings.filter((s) => st.t < s.hasta);
  st.mensajes = st.mensajes.filter((m) => st.t < m.hasta);

  const survVivos = st.entities.filter((e) => e.team === "survivor" && e.vivo);
  if (!jugador.vivo || survVivos.length === 0) st.estado = "perdido";
  else if (st.tiempoRestante <= 0) st.estado = "ganado";
}
