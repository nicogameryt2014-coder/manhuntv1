// Motor del juego de supervivencia: asesinos vs sobrevivientes.
// Incluye navegación con A*, coordinación por equipos y estados de efecto.

import { buscarCamino, construirGrid, lineaLibre, type Grid } from "./pathfind";

export type SurvivorAbility = "medico" | "atacante" | "asustadizo" | "mago";

/** Stamina: se gasta al correr y se recupera al no correr. */
export const STAMINA = {
  maxSobreviviente: 100,
  maxAsesino: 140,
  gastoSobreviviente: 20, // SP por segundo corriendo
  gastoAsesino: 21,
  regen: 28, // SP por segundo sin correr
  umbralRecuperacion: 30, // si te agotas, no corres hasta llegar a esto
};
export type KillerAbility = "venenoso" | "ninja";
export type ItemKind = "botiquin" | "cola" | "antidoto";

export const SURVIVOR_ABILITIES: SurvivorAbility[] = [
  "medico",
  "atacante",
  "asustadizo",
  "mago",
];
export const KILLER_ABILITIES: KillerAbility[] = ["venenoso", "ninja"];

export const ABILITY_INFO: Record<
  SurvivorAbility | KillerAbility,
  { nombre: string; cooldown: number; desc: string }
> = {
  medico: {
    nombre: "Médico",
    cooldown: 15,
    desc: "Lanza un charco curativo gigante (6 s). +6 HP/s, o +12 HP/s si el médico tiene más de 40 HP. Sólo tiene 50 HP máximos.",
  },
  atacante: {
    nombre: "Atacante",
    cooldown: 35,
    desc: "Golpe amplio en la dirección de avance. Aturde asesinos 5 s y te da 1.5x velocidad por 2 s. Tiene 150 HP y recibe 15% menos de daño, pero camina y corre 0.25x más lento.",
  },
  asustadizo: {
    nombre: "Asustadizo",
    cooldown: 30,
    desc: "Velocidad x3 por 10 s; luego quedas ralentizado 4 s.",
  },
  mago: {
    nombre: "Mago",
    cooldown: 15,
    desc: "Escudo de 25 HP por 5 s al sobreviviente más cercano, sin perder velocidad. Cancelarlo suma 10 s de cooldown.",
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

/** Segunda habilidad de cada sobreviviente (tecla de habilidad 2). */
export const ABILITY2_INFO: Record<
  SurvivorAbility,
  { nombre: string; cooldown: number; desc: string }
> = {
  medico: {
    nombre: "Carrera médica",
    cooldown: 30,
    desc: "Velocidad x3 por 7 s; luego quedas ralentizado 4 s.",
  },
  atacante: {
    nombre: "Bloqueo",
    cooldown: 25,
    desc: "Te cubres 3 s: si un asesino te golpea, se aturde 3 s, ganas +10 HP y 1.5x velocidad por 2 s.",
  },
  asustadizo: {
    nombre: "Sobreadrenalina",
    cooldown: 45,
    desc: "+100 HP temporal que se gasta a 4.5/s, pero recibes un 10% más de daño mientras dure.",
  },
  mago: {
    nombre: "Escudo propio",
    cooldown: 20,
    desc: "Escudo de 25 HP por 5 s sobre ti mismo.",
  },
};

/** Segunda habilidad común a todos los asesinos. */
export const KILLER_ABILITY2 = {
  nombre: "Superataque",
  cooldown: 20,
  desc: "Prepara un golpe que quita un 25% más de vida de lo habitual.",
};

export const MEDICO_MAX_HP = 50;
export const ADRENALINA_HP = 100;
export const ADRENALINA_DRENAJE = 4.5;
export const BLOQUEO_DURACION = 3;
/** distancia del centro del golpe del atacante y su radio */
export const ATACANTE_ALCANCE = 56;
export const ATACANTE_RADIO = 78;


export const ITEM_INFO: Record<
  ItemKind,
  { nombre: string; canal: number; desc: string }
> = {
  botiquin: { nombre: "Botiquín", canal: 5, desc: "Cura 35 HP (5 s, cancelable)" },
  cola: { nombre: "Cola", canal: 2, desc: "1.5x velocidad por 10 s (2 s, cancelable)" },
  antidoto: {
    nombre: "Antídoto",
    canal: 5,
    desc: "Sólo al sufrir: sales del estado con 1 HP (5 s, cancelable)",
  },
};

export const MAGO_COOLDOWN_BASE = 15;
export const MAGO_PENALIZACION_CANCELAR = 10;

const SURV_WALK = 118;
const SURV_RUN = 190;
const KILL_WALK = 126;
const KILL_RUN = SURV_RUN * 0.85;

// área ~8x la original (antes 1600x1100)
export const WORLD_W = 4500;
export const WORLD_H = 3100;

export type Rect = { x: number; y: number; w: number; h: number };

export type Rol = "cazar" | "flanquear" | "patrullar" | "huir" | "apoyar" | "rescatar" | "buscar";

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
  /** stamina: se gasta al correr */
  sp: number;
  maxSp: number;
  /** sin stamina hasta recuperar un mínimo */
  agotado: boolean;
  /** corrió durante este tick (para gasto/regen) */
  corrio: boolean;
  fx: number;
  fy: number;
  isPlayer: boolean;
  cooldownHasta: number;
  cooldownTotal: number;
  /** segunda habilidad */
  cooldown2Hasta: number;
  cooldown2Total: number;
  /** asesinos: siguiente golpe hace 25% más de daño */
  superAtaque: boolean;
  /** atacante: tiempo de bloqueo activo */
  bloqueoHasta: number;
  /** asustadizo: HP temporal de sobreadrenalina */
  adrenalina: number;

  stunHasta: number;
  boost: { mult: number; hasta: number } | null;
  slowHasta: number;
  veneno: { hasta: number; sig: number } | null;
  escudo: { hp: number; hasta: number } | null;
  canalizando: { tipo: ItemKind; fin: number; total: number } | null;
  escudoActivoSobre: number | null;
  inventario: Partial<Record<ItemKind, boolean>>;
  ataqueListo: number;
  vivo: boolean;
  /** llegó a la salida durante la fase de escape */
  escapo: boolean;
  venenoArmadoHasta: number;
  // estado de sufrimiento (modo "sufrimiento")
  sufriendo: boolean;
  caidas: number;
  drenajeSig: number;
  sangreSig: number;
  /** tras ser revivido sigue sangrando un rato */
  sangradoHasta: number;
  revive: number;
  // navegación / IA
  camino: { x: number; y: number }[];
  caminoIdx: number;
  repathEn: number;
  meta: { x: number; y: number } | null;
  rol: Rol;
  objetivoId: number | null;
  // anti-atasco
  ultX: number;
  ultY: number;
  chequeoEn: number;
  desvioHasta: number;
  desvioAng: number;
};

export type Knife = { x: number; y: number; vx: number; vy: number; owner: number; vivo: boolean };
export type Puddle = { x: number; y: number; r: number; hasta: number; curacion: number };
export type Swing = { x: number; y: number; fx: number; fy: number; hasta: number };
export type Bubble = { x: number; y: number; vy: number; vida: number };
export type Pickup = { id: number; x: number; y: number; kind: ItemKind; tomado: boolean };
export type Blood = { x: number; y: number; r: number; nacida: number };

export type ModoMuerte = "instantanea" | "sufrimiento";

/** Ajustes del estado de sufrimiento (arrastrarse tras caer a 0 HP). */
export const SUFRIMIENTO = {
  lentitud: 0.8,
  drenajePorCaida: [2, 4], // % de vida por segundo en la 1.ª y 2.ª caída
  maxCaidas: 2, // a la 3.ª caída se muere
  radioRevivir: 15 * 2.5,
  segundosRevivir: 4,
  vidaAlRevivir: 20,
  boostRevivir: 1.8,
  duracionBoost: 5,
};

export type Coord = {
  // conocimiento compartido de los asesinos
  presa: number | null;
  presaX: number;
  presaY: number;
  presaVistaEn: number;
  // conocimiento compartido de los sobrevivientes
  avisos: { x: number; y: number; hasta: number; killerId: number }[];
  socorroId: number | null;
};

export type GameState = {
  t: number;
  estado: "jugando" | "ganado" | "perdido";
  walls: Rect[];
  grid: Grid;
  entities: Entity[];
  knives: Knife[];
  puddles: Puddle[];
  swings: Swing[];
  bubbles: Bubble[];
  pickups: Pickup[];
  sangre: Blood[];
  modo: ModoMuerte;
  mensajes: { texto: string; hasta: number }[];
  muertes: { id: number; t: number }[];
  /** golpes recibidos por sobrevivientes (sonido de impacto) */
  golpes: { id: number; t: number; x: number; y: number }[];
  tiempoRestante: number;
  /** fase de partida: caza normal o carrera hacia la salida */
  fase: "caza" | "escape";
  salida: { x: number; y: number; r: number } | null;
  /** segundos que dura la fase de escape (duración de la música) */
  duracionEscape: number;
  tiempoEscape: number;
  escapados: number;
  coord: Coord;
  /** id de la entidad que observa el jugador cuando ya está muerto (modo fantasma) */
  espectando: number | null;
};

export type Input = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  usarHabilidad: boolean;
  usarHabilidad2: boolean;
  recoger: boolean;
  usarItem: ItemKind | null;
  cancelar: boolean;
};

let nextId = 1;

function walls(): Rect[] {
  const ws: Rect[] = [
    { x: 0, y: 0, w: WORLD_W, h: 24 },
    { x: 0, y: WORLD_H - 24, w: WORLD_W, h: 24 },
    { x: 0, y: 0, w: 24, h: WORLD_H },
    { x: WORLD_W - 24, y: 0, w: 24, h: WORLD_H },
  ];
  // laberinto procedural: celdas con muros sueltos (a veces en esquina),
  // dejando pasillos amplios para que el pathfinding siempre encuentre ruta
  const pitch = 420;
  const cols = Math.floor((WORLD_W - 240) / pitch);
  const rows = Math.floor((WORLD_H - 240) / pitch);
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      if (Math.random() > 0.72) continue;
      const bx = 120 + cx * pitch + Math.random() * (pitch - 220);
      const by = 120 + cy * pitch + Math.random() * (pitch - 220);
      const horizontal = Math.random() < 0.5;
      const len = 180 + Math.random() * 200;
      if (horizontal) ws.push({ x: bx, y: by, w: len, h: 28 });
      else ws.push({ x: bx, y: by, w: 28, h: len });
      if (Math.random() < 0.35) {
        const len2 = 120 + Math.random() * 140;
        if (horizontal) ws.push({ x: bx, y: by, w: 28, h: len2 });
        else ws.push({ x: bx, y: by, w: len2, h: 28 });
      }
    }
  }
  return ws;
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
    hp: ability === "medico" ? MEDICO_MAX_HP : ability === "atacante" ? 150 : 100,
    maxHp: ability === "medico" ? MEDICO_MAX_HP : ability === "atacante" ? 150 : 100,

    sp: team === "killer" ? STAMINA.maxAsesino : STAMINA.maxSobreviviente,
    maxSp: team === "killer" ? STAMINA.maxAsesino : STAMINA.maxSobreviviente,
    agotado: false,
    corrio: false,
    fx: 0,
    fy: 1,
    isPlayer,
    cooldownHasta: 0,
    cooldownTotal: ABILITY_INFO[ability].cooldown,
    cooldown2Hasta: 0,
    cooldown2Total:
      team === "survivor"
        ? ABILITY2_INFO[ability as SurvivorAbility].cooldown
        : KILLER_ABILITY2.cooldown,
    superAtaque: false,
    bloqueoHasta: 0,
    adrenalina: 0,

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
    escapo: false,
    venenoArmadoHasta: 0,
    sufriendo: false,
    caidas: 0,
    drenajeSig: 0,
    sangreSig: 0,
    sangradoHasta: 0,
    revive: 0,
    camino: [],
    caminoIdx: 0,
    repathEn: 0,
    meta: null,
    rol: team === "killer" ? "patrullar" : "buscar",
    objetivoId: null,
    ultX: x,
    ultY: y,
    chequeoEn: 0,
    desvioHasta: 0,
    desvioAng: 0,
  };
}

function colisiona(x: number, y: number, r: number, ws: Rect[]): boolean {
  for (const w of ws) {
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

function puntoLibre(ws: Rect[], x: number, y: number) {
  return !colisiona(x, y, 22, ws);
}

function spawnCerca(ws: Rect[], cx: number, cy: number, usados: { x: number; y: number }[]) {
  for (let i = 0; i < 400; i++) {
    const rad = 40 + i * 3;
    const a = Math.random() * Math.PI * 2;
    const x = Math.max(50, Math.min(WORLD_W - 50, cx + Math.cos(a) * rad));
    const y = Math.max(50, Math.min(WORLD_H - 50, cy + Math.sin(a) * rad));
    if (!puntoLibre(ws, x, y)) continue;
    if (usados.some((u) => Math.hypot(u.x - x, u.y - y) < 44)) continue;
    usados.push({ x, y });
    return { x, y };
  }
  return { x: cx, y: cy };
}

export type Config = {
  habilidad: SurvivorAbility;
  sobrevivientes: number; // 1..20 (incluye al jugador)
  asesinos: number; // 1..20
  duracion: number;
  modo: ModoMuerte;
};

export function crearJuego(cfg: Config): GameState {
  nextId = 1;
  const ws = walls();
  const grid = construirGrid(ws, WORLD_W, WORLD_H);
  const ents: Entity[] = [];
  const usados: { x: number; y: number }[] = [];

  const spawnSurv = spawnCerca(ws, 150, WORLD_H - 150, usados);
  ents.push(nuevaEntidad("Tú", "survivor", cfg.habilidad, spawnSurv.x, spawnSurv.y, true));

  const esquinas = [
    { x: 160, y: 140 },
    { x: WORLD_W - 160, y: 180 },
    { x: WORLD_W - 160, y: WORLD_H - 140 },
    { x: 160, y: WORLD_H - 140 },
    { x: WORLD_W / 2, y: 160 },
    { x: WORLD_W / 2, y: WORLD_H - 160 },
    { x: 160, y: WORLD_H / 2 },
    { x: WORLD_W - 160, y: WORLD_H / 2 },
  ];
  for (let i = 0; i < Math.max(0, cfg.sobrevivientes - 1); i++) {
    const a = SURVIVOR_ABILITIES[i % SURVIVOR_ABILITIES.length]!;
    const base = esquinas[i % esquinas.length]!;
    const p = spawnCerca(ws, base.x, base.y, usados);
    ents.push(
      nuevaEntidad(`${ABILITY_INFO[a].nombre} ${Math.floor(i / 4) + 1}`, "survivor", a, p.x, p.y),
    );
  }

  for (let i = 0; i < cfg.asesinos; i++) {
    const a = KILLER_ABILITIES[i % KILLER_ABILITIES.length]!;
    const p = spawnCerca(ws, WORLD_W / 2, WORLD_H / 2, usados);
    ents.push(
      nuevaEntidad(`${ABILITY_INFO[a].nombre} ${Math.floor(i / 2) + 1}`, "killer", a, p.x, p.y),
    );
  }

  const pickups: Pickup[] = [];
  // mapa mucho más grande: más objetos repartidos
  const totalItems = Math.max(12, Math.round(cfg.sobrevivientes * 2.5));
  for (let i = 0; i < totalItems; i++) {
    const p = spawnCerca(
      ws,
      120 + Math.random() * (WORLD_W - 240),
      120 + Math.random() * (WORLD_H - 240),
      usados,
    );
    const ciclo: ItemKind[] =
      cfg.modo === "sufrimiento" ? ["botiquin", "cola", "antidoto"] : ["botiquin", "cola"];
    pickups.push({ id: nextId++, x: p.x, y: p.y, kind: ciclo[i % ciclo.length]!, tomado: false });
  }

  return {
    t: 0,
    estado: "jugando",
    walls: ws,
    grid,
    entities: ents,
    knives: [],
    puddles: [],
    swings: [],
    bubbles: [],
    pickups,
    sangre: [],
    modo: cfg.modo,
    mensajes: [],
    muertes: [],
    golpes: [],
    tiempoRestante: cfg.duracion,
    fase: "caza",
    salida: null,
    duracionEscape: 60,
    tiempoEscape: 0,
    escapados: 0,
    coord: { presa: null, presaX: 0, presaY: 0, presaVistaEn: -99, avisos: [], socorroId: null },
    espectando: null,
  };
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
  if (e.sufriendo) return SURV_WALK * SUFRIMIENTO.lentitud;
  const esSurv = e.team === "survivor";
  let base = esSurv ? (corriendo ? SURV_RUN : SURV_WALK) : corriendo ? KILL_RUN : KILL_WALK;
  if (e.ability === "atacante") base *= 0.75; // el atacante es 0.25x más lento
  const conBoost = !!(e.boost && st.t < e.boost.hasta);
  if (conBoost) base *= e.boost!.mult;
  if (e.adrenalina > 0) base *= 0.5; // sobreadrenalina: 0.5x más lento
  if (st.t < e.slowHasta && !conBoost) base *= 0.45;
  return base;
}

export function puedeCorrer(e: Entity): boolean {
  if (e.sufriendo) return false;
  if (e.agotado || e.sp <= 0) return false;
  return true;
}


/** Gasto y regeneración de stamina según si corrió este tick. */
function actualizarStamina(e: Entity, dt: number) {
  if (e.corrio) {
    const gasto = e.team === "killer" ? STAMINA.gastoAsesino : STAMINA.gastoSobreviviente;
    e.sp = Math.max(0, e.sp - gasto * dt);
    if (e.sp <= 0) e.agotado = true;
  } else {
    e.sp = Math.min(e.maxSp, e.sp + STAMINA.regen * dt);
    if (e.agotado && e.sp >= STAMINA.umbralRecuperacion) e.agotado = false;
  }
  e.corrio = false;
}

/** Objetivo válido para un asesino: vivo y no arrastrándose. */
export function atacable(e: Entity): boolean {
  return e.vivo && !e.sufriendo;
}

function msg(st: GameState, texto: string) {
  st.mensajes.push({ texto, hasta: st.t + 2.5 });
}

function danar(st: GameState, e: Entity, cantidad: number) {
  if (e.sufriendo) return; // arrastrándose no se recibe daño externo
  // en sobreadrenalina recibes un 10% más de daño
  let d = e.adrenalina > 0 ? cantidad * 1.1 : cantidad;
  if (e.ability === "atacante") d *= 0.85; // el atacante recibe 15% menos de daño
  if (e.escudo && st.t < e.escudo.hasta) {
    const absorbido = Math.min(e.escudo.hp, d);
    e.escudo.hp -= absorbido;
    d -= absorbido;
    if (e.escudo.hp <= 0) liberarEscudo(st, e);
  }
  if (e.adrenalina > 0 && d > 0) {
    const absorbido = Math.min(e.adrenalina, d);
    e.adrenalina -= absorbido;
    d -= absorbido;
  }
  e.hp -= d;
  if (e.hp <= 0) abatir(st, e);
}


/** Vida a 0: muerte directa o entrada al estado de sufrimiento. */
function abatir(st: GameState, e: Entity) {
  e.hp = 0;
  if (st.modo === "sufrimiento" && e.team === "survivor" && e.caidas < SUFRIMIENTO.maxCaidas) {
    e.caidas++;
    e.sufriendo = true;
    e.hp = e.maxHp;
    e.revive = 0;
    e.drenajeSig = st.t + 1;
    e.canalizando = null;
    e.boost = null;
    e.veneno = null;
    if (e.escudo) liberarEscudo(st, e);
    msg(st, `${e.nombre} se arrastra (caída ${e.caidas})`);
    return;
  }
  e.sufriendo = false;
  e.vivo = false;
  salpicar(st, e.x, e.y, 26, 1.7);
  st.muertes.push({ id: e.id, t: st.t });
  msg(st, `${e.nombre} ha caído`);
}

function revivir(st: GameState, e: Entity) {
  e.sufriendo = false;
  e.revive = 0;
  e.hp = (e.maxHp * SUFRIMIENTO.vidaAlRevivir) / 100;
  e.boost = { mult: SUFRIMIENTO.boostRevivir, hasta: st.t + SUFRIMIENTO.duracionBoost };
  e.sangradoHasta = st.t + 10;
  e.sangreSig = st.t;
  salpicar(st, e.x, e.y, 10, 1.2);
  msg(st, `${e.nombre} fue reanimado`);
}

/** Salpica manchas de sangre permanentes alrededor de un punto. */
export function salpicar(st: GameState, x: number, y: number, n: number, escala = 1) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const d = Math.random() * 26 * escala;
    st.sangre.push({
      x: x + Math.cos(ang) * d,
      y: y + Math.sin(ang) * d,
      r: (3 + Math.random() * 7) * escala,
      nacida: st.t,
    });
  }
  if (st.sangre.length > 4000) st.sangre.splice(0, st.sangre.length - 4000);
}

/** Drenaje, sangre y barra de reanimación de quienes se arrastran. */
function actualizarSufrimiento(st: GameState, dt: number) {
  for (const e of st.entities) {
    if (!e.vivo || !e.sufriendo) continue;

    if (st.t >= e.drenajeSig) {
      const pct = SUFRIMIENTO.drenajePorCaida[Math.min(e.caidas, SUFRIMIENTO.maxCaidas) - 1] ?? 4;
      e.hp -= (e.maxHp * pct) / 100;
      e.drenajeSig += 1;
      if (e.hp <= 0) {
        e.hp = 0;
        e.sufriendo = false;
        e.vivo = false;
        salpicar(st, e.x, e.y, 26, 1.7);
        st.muertes.push({ id: e.id, t: st.t });
        msg(st, `${e.nombre} murió desangrado`);
        continue;
      }
    }

    if (st.t >= e.sangreSig) {
      salpicar(st, e.x, e.y, 3, 1.1);
      e.sangreSig = st.t + 0.35;
    }

    const ayuda = st.entities.some(
      (o) =>
        o !== e &&
        o.team === "survivor" &&
        o.vivo &&
        !o.sufriendo &&
        Math.hypot(o.x - e.x, o.y - e.y) < SUFRIMIENTO.radioRevivir + o.r,
    );
    e.revive = Math.max(
      0,
      Math.min(SUFRIMIENTO.segundosRevivir, e.revive + (ayuda ? dt : -dt * 0.5)),
    );
    if (e.revive >= SUFRIMIENTO.segundosRevivir) revivir(st, e);
  }
  // quien acaba de ser reanimado sigue goteando sangre unos segundos
  for (const e of st.entities) {
    if (!e.vivo || e.sufriendo || st.t >= e.sangradoHasta) continue;
    if (st.t >= e.sangreSig) {
      salpicar(st, e.x, e.y, 2, 0.8);
      e.sangreSig = st.t + 0.25;
    }
  }
  if (st.sangre.length > 4000) st.sangre.splice(0, st.sangre.length - 4000);
}

function liberarEscudo(st: GameState, objetivo: Entity) {
  objetivo.escudo = null;
  for (const m of st.entities) if (m.escudoActivoSobre === objetivo.id) m.escudoActivoSobre = null;
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
      const curacion = e.hp > 40 ? 12 : 6;
      st.puddles.push({ x: e.x + e.fx * 46, y: e.y + e.fy * 46, r: 90, hasta: st.t + 6, curacion });
      break;
    }
    case "atacante": {
      st.swings.push({ x: e.x, y: e.y, fx: e.fx, fy: e.fy, hasta: st.t + 0.25 });
      const cx = e.x + e.fx * ATACANTE_ALCANCE;
      const cy = e.y + e.fy * ATACANTE_ALCANCE;
      for (const o of st.entities) {
        if (o.team !== "killer" || !o.vivo) continue;
        if (Math.hypot(o.x - cx, o.y - cy) < ATACANTE_RADIO + o.r) {
          o.stunHasta = st.t + 5;
          msg(st, `${o.nombre} aturdido 5 s`);
        }
      }
      e.boost = { mult: 1.5, hasta: st.t + 2 };
      break;

    }
    case "asustadizo": {
      e.boost = { mult: 3, hasta: st.t + 10 };
      e.slowHasta = st.t + 14;
      break;
    }
    case "mago": {
      let mejor: Entity | null = null;
      let mejorD = Infinity;
      for (const o of st.entities) {
        if (o.team !== "survivor" || !o.vivo || o.sufriendo || o.id === e.id) continue;
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
      e.venenoArmadoHasta = st.t + 8;
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

/** Segunda habilidad (sobrevivientes) / superataque (asesinos). */
export function usarHabilidad2(st: GameState, e: Entity) {
  if (!e.vivo || e.sufriendo || st.t < e.stunHasta) return;
  if (st.t < e.cooldown2Hasta) return;
  if (e.team === "killer") {
    e.superAtaque = true;
    e.cooldown2Hasta = st.t + KILLER_ABILITY2.cooldown;
    e.cooldown2Total = KILLER_ABILITY2.cooldown;
    msg(st, `${e.nombre} prepara un superataque`);
    return;
  }
  const ab = e.ability as SurvivorAbility;
  const cd = ABILITY2_INFO[ab].cooldown;
  switch (ab) {
    case "medico": {
      e.boost = { mult: 1.5, hasta: st.t + 7 }; // carrera médica nerfeada (0.5x más lenta)
      e.slowHasta = st.t + 11;
      break;
    }
    case "atacante": {
      e.bloqueoHasta = st.t + BLOQUEO_DURACION;
      if (e.isPlayer) msg(st, "Bloqueo activo 3 s");
      break;
    }
    case "asustadizo": {
      e.adrenalina = ADRENALINA_HP;
      if (e.isPlayer) msg(st, "Sobreadrenalina: +100 HP temporal");
      break;
    }
    case "mago": {
      e.escudo = { hp: 25, hasta: st.t + 5 };
      if (e.isPlayer) msg(st, "Escudo propio");
      break;
    }
  }
  e.cooldown2Hasta = st.t + cd;
  e.cooldown2Total = cd;
}

export function iniciarItem(st: GameState, e: Entity, kind: ItemKind) {
  if (!e.inventario[kind] || e.canalizando || !e.vivo) return;
  // el antídoto sólo funciona mientras te arrastras; el resto, sólo en pie
  if (kind === "antidoto") {
    if (!e.sufriendo) {
      if (e.isPlayer) msg(st, "El antídoto sólo se usa mientras te arrastras");
      return;
    }
  } else if (e.sufriendo) return;
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
  } else if (c.tipo === "antidoto") {
    e.sufriendo = false;
    e.revive = 0;
    e.hp = 1;
    msg(st, `${e.nombre} usó un antídoto y se levantó con 1 HP`);
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
        if (e.isPlayer) msg(st, `Ya llevas un ${ITEM_INFO[p.kind].nombre.toLowerCase()}`);
        return;
      }
      e.inventario[p.kind] = true;
      p.tomado = true;
      if (e.isPlayer) msg(st, `${ITEM_INFO[p.kind].nombre} recogido`);
      return;
    }
  }
}

function golpeAsesino(st: GameState, k: Entity, objetivo: Entity) {
  // Bloqueo del atacante: contraataca en vez de recibir el golpe
  if (st.t < objetivo.bloqueoHasta) {
    objetivo.bloqueoHasta = 0;
    k.stunHasta = st.t + BLOQUEO_DURACION;
    objetivo.hp = Math.min(objetivo.maxHp, objetivo.hp + 10);
    objetivo.boost = { mult: 1.5, hasta: st.t + 2 };
    k.ataqueListo = st.t + 1.6;
    msg(st, `${objetivo.nombre} bloqueó el golpe de ${k.nombre}`);
    return;
  }
  if (!objetivo.sufriendo) {
    st.golpes.push({ id: objetivo.id, t: st.t, x: objetivo.x, y: objetivo.y });
    salpicar(st, objetivo.x, objetivo.y, 7, 1);
  }
  let dano = 20;
  if (k.superAtaque) {
    dano *= 1.25;
    k.superAtaque = false;
    msg(st, `¡Superataque de ${k.nombre}!`);
  }
  danar(st, objetivo, dano);
  if (k.ability === "venenoso" && st.t < k.venenoArmadoHasta) {
    objetivo.veneno = { hasta: st.t + 6, sig: st.t + 1 };
  }
  k.ataqueListo = st.t + 1.6;
}

// ---------------------------------------------------------------- navegación

function fijarMeta(st: GameState, e: Entity, x: number, y: number, urgente = false) {
  const cambio = !e.meta || Math.hypot(e.meta.x - x, e.meta.y - y) > 70;
  if (cambio || st.t >= e.repathEn || e.caminoIdx >= e.camino.length) {
    e.meta = { x, y };
    e.camino = buscarCamino(st.grid, e.x, e.y, x, y);
    e.caminoIdx = 0;
    e.repathEn = st.t + (urgente ? 0.35 : 0.8) + Math.random() * 0.25;
  }
}

/** ¿Se puede avanzar `dist` px en ese ángulo sin chocar? */
function libreEnAngulo(st: GameState, e: Entity, ang: number, dist: number): boolean {
  const x = e.x + Math.cos(ang) * dist;
  const y = e.y + Math.sin(ang) * dist;
  if (x < e.r || y < e.r || x > WORLD_W - e.r || y > WORLD_H - e.r) return false;
  return !colisiona(x, y, e.r, st.walls);
}

/** Avanza por el camino. Devuelve el ángulo de movimiento o null. */
function seguirCamino(st: GameState, e: Entity, dt: number, corriendo: boolean): number | null {
  let ang: number | null = null;

  if (st.t < e.desvioHasta) {
    ang = e.desvioAng;
  } else {
    if (e.caminoIdx < e.camino.length) {
      let nodo = e.camino[e.caminoIdx]!;
      while (Math.hypot(nodo.x - e.x, nodo.y - e.y) < 18) {
        e.caminoIdx++;
        if (e.caminoIdx >= e.camino.length) break;
        nodo = e.camino[e.caminoIdx]!;
      }
      if (e.caminoIdx < e.camino.length) ang = Math.atan2(nodo.y - e.y, nodo.x - e.x);
    }
    // sin ruta válida: se dirige en línea recta a su meta para no quedarse quieto
    if (ang === null && e.meta && Math.hypot(e.meta.x - e.x, e.meta.y - e.y) > 12) {
      ang = Math.atan2(e.meta.y - e.y, e.meta.x - e.x);
    }
  }
  if (ang === null) return null;
  if (corriendo) e.corrio = true;

  // separación suave de compañeros para que no se amontonen
  let sx = 0;
  let sy = 0;
  for (const o of st.entities) {
    if (o === e || !o.vivo || o.team !== e.team) continue;
    const d = Math.hypot(o.x - e.x, o.y - e.y);
    if (d > 0.1 && d < 38) {
      sx += (e.x - o.x) / d;
      sy += (e.y - o.y) / d;
    }
  }
  const v = velocidad(e, st, corriendo) * dt;
  let dx = Math.cos(ang) + sx * 0.45;
  let dy = Math.sin(ang) + sy * 0.45;
  let dir = Math.atan2(dy, dx);

  // si tiene una pared delante, desliza probando ángulos cercanos a izquierda y derecha
  const sonda = Math.max(e.r + 6, v * 3);
  if (!libreEnAngulo(st, e, dir, sonda)) {
    const giros = [0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.2, -2.2];
    for (const g of giros) {
      if (libreEnAngulo(st, e, dir + g, sonda)) {
        dir += g;
        break;
      }
    }
  }
  dx = Math.cos(dir);
  dy = Math.sin(dir);
  const l = Math.hypot(dx, dy) || 1;
  mover(e, (dx / l) * v, (dy / l) * v, st);
  e.fx = Math.cos(ang);
  e.fy = Math.sin(ang);
  return ang;
}

/** Detecta bots parados contra una esquina y los saca de ahí con un desvío. */
function antiAtasco(st: GameState, e: Entity, dt: number) {
  if (st.t < e.chequeoEn) return;
  const esperado = velocidad(e, st, false) * 0.5;
  const avance = Math.hypot(e.x - e.ultX, e.y - e.ultY);
  e.chequeoEn = st.t + 0.5;
  e.ultX = e.x;
  e.ultY = e.y;
  if (esperado <= 0 || st.t < e.desvioHasta) return;
  if (avance > esperado * 0.28) return;

  // atascado: olvida la ruta y busca una dirección realmente abierta
  e.camino = [];
  e.caminoIdx = 0;
  e.meta = null;
  e.repathEn = 0;
  const base = Math.random() * Math.PI * 2;
  let elegido = base;
  for (let i = 0; i < 12; i++) {
    const a = base + (i / 12) * Math.PI * 2;
    if (libreEnAngulo(st, e, a, e.r + 46)) {
      elegido = a;
      break;
    }
  }
  e.desvioAng = elegido;
  e.desvioHasta = st.t + 0.7 + Math.random() * 0.4;
  void dt;
}

function ve(st: GameState, a: Entity, b: Entity, rango = 520) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return d < rango && lineaLibre(st.grid, a.x, a.y, b.x, b.y);
}

function puntoSeguro(st: GameState, e: Entity, killers: Entity[]) {
  let mejor: { x: number; y: number } | null = null;
  let mejorScore = -Infinity;
  const aliados = st.entities.filter((o) => o.team === "survivor" && o.vivo && o !== e);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random();
    const rad = 220 + Math.random() * 300;
    const x = Math.max(60, Math.min(WORLD_W - 60, e.x + Math.cos(a) * rad));
    const y = Math.max(60, Math.min(WORLD_H - 60, e.y + Math.sin(a) * rad));
    if (colisiona(x, y, 20, st.walls)) continue;
    let score = 0;
    for (const k of killers) score += Math.min(600, Math.hypot(k.x - x, k.y - y));
    for (const al of aliados) score += Math.max(0, 220 - Math.hypot(al.x - x, al.y - y)) * 0.4;
    // los objetos también atraen
    for (const p of st.pickups) {
      if (!p.tomado && !e.inventario[p.kind]) {
        score += Math.max(0, 200 - Math.hypot(p.x - x, p.y - y)) * 0.5;
      }
    }
    if (score > mejorScore) {
      mejorScore = score;
      mejor = { x, y };
    }
  }
  return mejor;
}

// --------------------------------------------------------------- IA equipos

function actualizarCoordinacion(st: GameState) {
  const killers = st.entities.filter((e) => e.team === "killer" && e.vivo);
  const survs = st.entities.filter((e) => e.team === "survivor" && atacable(e));

  // Asesinos: comparten la presa vista más "rentable" (cercana + herida)
  let mejor: { e: Entity; score: number } | null = null;
  for (const k of killers) {
    for (const s of survs) {
      if (!ve(st, k, s)) continue;
      const score = 1000 - Math.hypot(k.x - s.x, k.y - s.y) + (100 - s.hp) * 3;
      if (!mejor || score > mejor.score) mejor = { e: s, score };
    }
  }
  if (mejor) {
    st.coord.presa = mejor.e.id;
    st.coord.presaX = mejor.e.x;
    st.coord.presaY = mejor.e.y;
    st.coord.presaVistaEn = st.t;
  } else if (st.t - st.coord.presaVistaEn > 8) {
    st.coord.presa = null;
  }

  // Sobrevivientes: avisos de asesinos avistados (memoria compartida 6 s)
  for (const s of survs) {
    for (const k of killers) {
      if (ve(st, s, k, 460)) {
        const prev = st.coord.avisos.find((a) => a.killerId === k.id);
        if (prev) {
          prev.x = k.x;
          prev.y = k.y;
          prev.hasta = st.t + 6;
        } else st.coord.avisos.push({ x: k.x, y: k.y, hasta: st.t + 6, killerId: k.id });
      }
    }
  }
  st.coord.avisos = st.coord.avisos.filter((a) => st.t < a.hasta);

  // ¿Quién necesita rescate? el sobreviviente con un asesino encima
  let socorro: Entity | null = null;
  let peor = Infinity;
  for (const s of survs) {
    for (const k of killers) {
      const d = Math.hypot(k.x - s.x, k.y - s.y);
      if (d < 200 && s.hp < peor) {
        peor = s.hp;
        socorro = s;
      }
    }
  }
  st.coord.socorroId = socorro ? socorro.id : null;
}

function iaAsesino(st: GameState, e: Entity, dt: number) {
  const survs = st.entities.filter((o) => o.team === "survivor" && atacable(o));
  if (!survs.length) return;
  const killers = st.entities.filter((o) => o.team === "killer" && o.vivo);
  const indice = killers.indexOf(e);

  // objetivo: presa compartida, si no el más cercano visible, si no patrulla
  let objetivo = survs.find((s) => s.id === st.coord.presa) ?? null;
  let conocido = objetivo ? { x: st.coord.presaX, y: st.coord.presaY } : null;
  const visible = objetivo && ve(st, e, objetivo);
  if (visible) conocido = { x: objetivo!.x, y: objetivo!.y };
  if (!objetivo) {
    let mejor = Infinity;
    for (const s of survs) {
      const d = Math.hypot(s.x - e.x, s.y - e.y);
      if (d < mejor && ve(st, e, s)) {
        mejor = d;
        objetivo = s;
        conocido = { x: s.x, y: s.y };
      }
    }
  }

  if (objetivo && conocido) {
    const d = Math.hypot(objetivo.x - e.x, objetivo.y - e.y);
    // El asesino más cercano persigue; los demás flanquean cortando la huida
    const distancias = killers
      .map((k) => ({ k, d: Math.hypot(objetivo!.x - k.x, objetivo!.y - k.y) }))
      .sort((a, b) => a.d - b.d);
    const puesto = distancias.findIndex((x) => x.k === e);
    if (puesto <= 0) {
      e.rol = "cazar";
      fijarMeta(st, e, conocido.x, conocido.y, true);
    } else {
      e.rol = "flanquear";
      const ang = Math.atan2(objetivo.y - e.y, objetivo.x - e.x) + (puesto % 2 ? 1 : -1) * (0.9 + puesto * 0.25);
      const rad = 170;
      let fx = objetivo.x + Math.cos(ang) * rad;
      let fy = objetivo.y + Math.sin(ang) * rad;
      fx = Math.max(50, Math.min(WORLD_W - 50, fx));
      fy = Math.max(50, Math.min(WORLD_H - 50, fy));
      fijarMeta(st, e, fx, fy, true);
    }
    e.objetivoId = objetivo.id;
    seguirCamino(st, e, dt, d > 110);
    if (d < e.r + objetivo.r + 10 && st.t > e.ataqueListo) golpeAsesino(st, e, objetivo);
    if (st.t >= e.cooldownHasta && visible) {
      if (e.ability === "ninja" && d < 420 && d > 60) {
        e.fx = (objetivo.x - e.x) / d;
        e.fy = (objetivo.y - e.y) / d;
        usarHabilidad(st, e);
      }
      if (e.ability === "venenoso" && d < 220) usarHabilidad(st, e);
    }
    if (st.t >= e.cooldown2Hasta && !e.superAtaque && d < 260) {
      usarHabilidad2(st, e); // prepara el superataque al acercarse a su presa
    }
  } else {
    e.rol = "patrullar";
    e.objetivoId = null;
    // patrulla repartida: cada asesino barre un sector distinto del mapa
    if (!e.meta || Math.hypot(e.meta.x - e.x, e.meta.y - e.y) < 60 || st.t > e.repathEn + 6) {
      if (st.fase === "escape" && st.salida) {
        // en el escape los asesinos custodian la salida
        const a = (indice / Math.max(1, killers.length)) * Math.PI * 2;
        fijarMeta(st, e, st.salida.x + Math.cos(a) * 170, st.salida.y + Math.sin(a) * 170);
        seguirCamino(st, e, dt, true);
        return;
      }
      const sectores = Math.max(1, killers.length);
      const s = (indice + Math.floor(st.t / 12)) % sectores;
      const cx = 150 + ((s + 0.5) / sectores) * (WORLD_W - 300);
      const cy = 150 + Math.random() * (WORLD_H - 300);
      fijarMeta(st, e, cx, cy);
    }
    seguirCamino(st, e, dt, false);
  }
}

function iaSobreviviente(st: GameState, e: Entity, dt: number) {
  const killers = st.entities.filter((o) => o.team === "killer" && o.vivo);
  const aliados = st.entities.filter(
    (o) => o.team === "survivor" && o.vivo && !o.sufriendo && o !== e,
  );

  // quien se arrastra sólo intenta llegar hasta un compañero en pie
  if (e.sufriendo) {
    e.rol = "huir";
    if (e.inventario.antidoto && !e.canalizando) iniciarItem(st, e, "antidoto");
    if (st.fase === "escape" && st.salida) {
      fijarMeta(st, e, st.salida.x, st.salida.y, true);
      seguirCamino(st, e, dt, false);
      return;
    }
    const cerca = aliados.sort(
      (a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y),
    )[0];
    if (cerca) fijarMeta(st, e, cerca.x, cerca.y, true);
    seguirCamino(st, e, dt, false);
    return;
  }

  // fase de escape: todo lo demás pasa a segundo plano, hay que llegar a la salida
  if (st.fase === "escape" && st.salida) {
    e.rol = "huir";
    if (e.canalizando) cancelarCanal(e);
    if (st.t >= e.cooldownHasta && e.ability === "asustadizo") usarHabilidad(st, e);
    fijarMeta(st, e, st.salida.x, st.salida.y, true);
    seguirCamino(st, e, dt, puedeCorrer(e));
    return;
  }

  // conciencia de su propia salud: cuanto menos vida, más cauto
  const vidaFrac = Math.max(0, Math.min(1, e.hp / e.maxHp));
  const debil = vidaFrac < 0.55 || (e.caidas > 0 && vidaFrac < 0.75);
  const critico = vidaFrac < 0.3;

  // charco curativo cercano: si está herido, va a curarse antes que nada
  let charco: Puddle | null = null;
  let dCharco = Infinity;
  if (vidaFrac < 0.9) {
    for (const p of st.puddles) {
      if (p.hasta <= st.t) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < dCharco) {
        dCharco = d;
        charco = p;
      }
    }
  }

  // reanimar a un compañero caído tiene prioridad si no hay un asesino encima
  const caido = st.entities
    .filter((o) => o.team === "survivor" && o.vivo && o.sufriendo)
    .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0];
  if (caido && !critico) {
    const dCaido = Math.hypot(caido.x - e.x, caido.y - e.y);
    const asesinoCerca = killers.some((k) => Math.hypot(k.x - caido.x, k.y - caido.y) < (debil ? 260 : 150));
    const alcance = debil ? 320 : 760;
    if (dCaido < alcance && !asesinoCerca) {
      e.rol = "rescatar";
      if (dCaido > SUFRIMIENTO.radioRevivir * 0.6) {
        fijarMeta(st, e, caido.x, caido.y, true);
        seguirCamino(st, e, dt, puedeCorrer(e));
      }
      return;
    }
  }

  // amenaza: asesino visible o avisado por el equipo
  let amenaza: { x: number; y: number; d: number; ent: Entity | null } | null = null;
  for (const k of killers) {
    const d = Math.hypot(k.x - e.x, k.y - e.y);
    if (ve(st, e, k, 480) && (!amenaza || d < amenaza.d)) amenaza = { x: k.x, y: k.y, d, ent: k };
  }
  if (!amenaza) {
    for (const a of st.coord.avisos) {
      const d = Math.hypot(a.x - e.x, a.y - e.y);
      if (d < 340 && (!amenaza || d < amenaza.d)) amenaza = { x: a.x, y: a.y, d, ent: null };
    }
  }

  const socorro = aliados.find((a) => a.id === st.coord.socorroId) ?? null;
  // los heridos detectan el peligro antes y guardan más distancia
  const radioPeligro = critico ? 520 : debil ? 430 : 330;
  const peligro = !!amenaza && amenaza.d < radioPeligro;

  // ---- habilidades coordinadas
  if (st.t >= e.cooldownHasta) {
    if (e.ability === "atacante") {
      const k = killers.find((kk) => Math.hypot(kk.x - e.x, kk.y - e.y) < 62);
      if (k) {
        const d = Math.hypot(k.x - e.x, k.y - e.y) || 1;
        e.fx = (k.x - e.x) / d;
        e.fy = (k.y - e.y) / d;
        usarHabilidad(st, e);
      }
    } else if (e.ability === "mago") {
      const aliadoEnPeligro = socorro && Math.hypot(socorro.x - e.x, socorro.y - e.y) < 240;
      if (aliadoEnPeligro || (peligro && amenaza!.d < 180)) usarHabilidad(st, e);
    } else if (e.ability === "asustadizo") {
      if (peligro && (amenaza!.d < 210 || debil)) usarHabilidad(st, e);
    } else if (e.ability === "medico") {
      // se cura a sí mismo o a cualquier aliado herido que tenga cerca
      const herido = [e, ...aliados].find(
        (a) => a.hp < a.maxHp * 0.85 && Math.hypot(a.x - e.x, a.y - e.y) < 160,
      );
      if (herido && (!charco || dCharco > 200)) usarHabilidad(st, e);
    }
  }
  // ---- segunda habilidad: defensiva, según el peligro y la vida
  if (st.t >= e.cooldown2Hasta) {
    if (e.ability === "atacante") {
      if (peligro && amenaza!.d < 90) usarHabilidad2(st, e);
    } else if (e.ability === "mago") {
      if (peligro && amenaza!.d < 170) usarHabilidad2(st, e);
    } else if (e.ability === "asustadizo") {
      if (peligro && (debil || amenaza!.d < 200)) usarHabilidad2(st, e);
    } else if (e.ability === "medico") {
      if (peligro && amenaza!.d < 240) usarHabilidad2(st, e);
    }
  }
  // objetos: se usan a cubierto
  if (!peligro && !e.canalizando) {
    if (e.inventario.botiquin && vidaFrac < 0.7) iniciarItem(st, e, "botiquin");
    else if (e.inventario.cola && !e.boost && !debil) iniciarItem(st, e, "cola");
  }
  if (e.canalizando && peligro) cancelarCanal(e);

  // ---- decisión de destino
  let corriendo = false;
  if (peligro) {
    e.rol = "huir";
    const seguro = puntoSeguro(st, e, killers);
    if (seguro) fijarMeta(st, e, seguro.x, seguro.y, true);
    corriendo = puedeCorrer(e);
  } else if (charco && vidaFrac < 0.9 && dCharco < 900) {
    // curarse en el charco del médico antes que cualquier otra cosa
    e.rol = "apoyar";
    fijarMeta(st, e, charco.x, charco.y, true);
    corriendo = dCharco > 150 && puedeCorrer(e);
  } else if (
    socorro &&
    !debil &&
    (e.ability === "atacante" || e.ability === "medico" || e.ability === "mago") &&
    Math.hypot(socorro.x - e.x, socorro.y - e.y) < 650
  ) {
    e.rol = e.ability === "atacante" ? "rescatar" : "apoyar";
    fijarMeta(st, e, socorro.x, socorro.y, true);
    corriendo = puedeCorrer(e);
  } else if (debil) {
    // herido: se aleja de los asesinos conocidos y se agrupa lejos del peligro
    e.rol = "huir";
    const seguro = puntoSeguro(st, e, killers);
    if (seguro) fijarMeta(st, e, seguro.x, seguro.y, true);
    else if (!e.meta || Math.hypot(e.meta.x - e.x, e.meta.y - e.y) < 60) {
      fijarMeta(st, e, 80 + Math.random() * (WORLD_W - 160), 80 + Math.random() * (WORLD_H - 160));
    }
    // aún así recoge un botiquín que tenga a mano
    const boti = st.pickups.find(
      (p) => !p.tomado && p.kind === "botiquin" && !e.inventario.botiquin && Math.hypot(p.x - e.x, p.y - e.y) < 420,
    );
    if (boti) {
      e.rol = "buscar";
      fijarMeta(st, e, boti.x, boti.y, true);
    }
    corriendo = puedeCorrer(e);
  } else {
    // buscar objetos que le falten, si no agruparse con el compañero más cercano
    let meta: { x: number; y: number } | null = null;
    let mejor = Infinity;
    for (const p of st.pickups) {
      if (p.tomado || e.inventario[p.kind]) continue;
      if (p.kind === "botiquin" && e.hp > 85 && e.inventario.cola) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < mejor) {
        mejor = d;
        meta = { x: p.x, y: p.y };
      }
    }
    if (meta) {
      e.rol = "buscar";
      fijarMeta(st, e, meta.x, meta.y);
    } else {
      e.rol = "apoyar";
      const comp = aliados.sort(
        (a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y),
      )[0];
      if (comp && Math.hypot(comp.x - e.x, comp.y - e.y) > 120) fijarMeta(st, e, comp.x, comp.y);
      else if (!e.meta || Math.hypot(e.meta.x - e.x, e.meta.y - e.y) < 60) {
        fijarMeta(st, e, 80 + Math.random() * (WORLD_W - 160), 80 + Math.random() * (WORLD_H - 160));
      }
    }
  }

  seguirCamino(st, e, dt, corriendo);
  intentarRecoger(st, e);
}

/** Abre la salida en un punto libre del mapa y arranca la cuenta atrás del escape. */
export function abrirSalida(st: GameState) {
  if (st.fase === "escape") return;
  const jugador = st.entities.find((e) => e.isPlayer)!;
  let mejor = { x: WORLD_W / 2, y: WORLD_H / 2 };
  let mejorD = -1;
  for (let i = 0; i < 400; i++) {
    const x = 200 + Math.random() * (WORLD_W - 400);
    const y = 200 + Math.random() * (WORLD_H - 400);
    if (colisiona(x, y, 60, st.walls)) continue;
    const d = Math.hypot(x - jugador.x, y - jugador.y);
    if (d > mejorD && d < 2600) {
      mejorD = d;
      mejor = { x, y };
    }
  }
  st.fase = "escape";
  st.salida = { x: mejor.x, y: mejor.y, r: 52 };
  st.tiempoEscape = st.duracionEscape;
  st.mensajes.push({ texto: "¡Se abrió la salida! Corre hacia ella", hasta: st.t + 5 });
  for (const e of st.entities) {
    e.camino = [];
    e.caminoIdx = 0;
    e.meta = null;
    e.repathEn = 0;
  }
}

export function step(st: GameState, dt: number, input: Input) {
  if (st.estado !== "jugando") return;
  st.t += dt;
  if (st.fase === "caza") {
    st.tiempoRestante = Math.max(0, st.tiempoRestante - dt);
    if (st.tiempoRestante <= 0) abrirSalida(st);
  } else {
    st.tiempoEscape = Math.max(0, st.tiempoEscape - dt);
  }

  const jugador = st.entities.find((e) => e.isPlayer)!;

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
    if (!jugador.sufriendo) {
      if (input.usarHabilidad) usarHabilidad(st, jugador);
      if (input.usarHabilidad2) usarHabilidad2(st, jugador);
      if (input.recoger) intentarRecoger(st, jugador);
      if (input.usarItem) iniciarItem(st, jugador, input.usarItem);
    } else if (input.usarItem === "antidoto") {
      iniciarItem(st, jugador, "antidoto");
    }

    const corriendo = input.run && puedeCorrer(jugador);
    if (corriendo && moviendo) jugador.corrio = true;
    const v = velocidad(jugador, st, corriendo) * dt;
    if (moviendo && v > 0) mover(jugador, dx * v, dy * v, st);
    if (jugador.canalizando && st.t >= jugador.canalizando.fin) terminarCanal(st, jugador);
  }

  actualizarCoordinacion(st);
  actualizarSufrimiento(st, dt);

  for (const e of st.entities) {
    if (!e.vivo || e.isPlayer) continue;
    if (st.t < e.stunHasta || e.canalizando) {
      if (e.canalizando && st.t >= e.canalizando.fin) terminarCanal(st, e);
      e.chequeoEn = st.t + 0.5;
      e.ultX = e.x;
      e.ultY = e.y;
      continue;
    }
    antiAtasco(st, e, dt);
    if (e.team === "killer") iaAsesino(st, e, dt);
    else iaSobreviviente(st, e, dt);
  }

  for (const e of st.entities) {
    if (!e.vivo) continue;
    actualizarStamina(e, dt);
    if (e.veneno) {
      if (st.t >= e.veneno.sig) {
        danar(st, e, 0.5);
        e.veneno.sig += 1;
      }
      if (st.t >= e.veneno.hasta) e.veneno = null;
    }
    if (e.adrenalina > 0) {
      e.adrenalina = Math.max(0, e.adrenalina - ADRENALINA_DRENAJE * dt);
    }
    if (e.escudo && st.t >= e.escudo.hasta) liberarEscudo(st, e);
    if (e.boost && st.t >= e.boost.hasta) e.boost = null;
    if (e.team === "survivor" && !e.sufriendo) {
      for (const p of st.puddles) {
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) {
          e.hp = Math.min(e.maxHp, e.hp + p.curacion * dt);
        }
      }
    }
  }

  for (const k of st.knives) {
    if (!k.vivo) continue;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    if (colisiona(k.x, k.y, 4, st.walls)) {
      k.vivo = false;
      continue;
    }
    for (const e of st.entities) {
      if (!atacable(e) || e.team !== "survivor") continue;
      if (Math.hypot(e.x - k.x, e.y - k.y) < e.r + 5) {
        if (!e.sufriendo) {
          st.golpes.push({ id: e.id, t: st.t, x: e.x, y: e.y });
          salpicar(st, e.x, e.y, 6, 1);
        }
        danar(st, e, 25);
        k.vivo = false;
        break;
      }
    }
  }
  st.knives = st.knives.filter((k) => k.vivo);

  for (const b of st.bubbles) {
    b.y += b.vy * dt;
    b.vida -= dt;
  }
  st.bubbles = st.bubbles.filter((b) => b.vida > 0);
  for (const k of st.entities) {
    if (k.ability === "venenoso" && k.vivo && st.t < k.venenoArmadoHasta && Math.random() < dt * 12) {
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

  // fase de escape: quien toca la salida se salva
  if (st.fase === "escape" && st.salida) {
    for (const e of st.entities) {
      if (e.team !== "survivor" || !e.vivo || e.escapo) continue;
      if (Math.hypot(e.x - st.salida.x, e.y - st.salida.y) < st.salida.r + e.r) {
        e.escapo = true;
        e.vivo = false;
        e.sufriendo = false;
        st.escapados++;
        st.mensajes.push({ texto: `${e.nombre} escapó`, hasta: st.t + 3 });
      }
    }
  }

  const survVivos = st.entities.filter((e) => e.team === "survivor" && e.vivo);

  // si el jugador murió sigue la partida como fantasma, observando a los demás
  if (!jugador.vivo && survVivos.length > 0) {
    const actual = st.entities.find((e) => e.id === st.espectando);
    if (!actual || !actual.vivo) st.espectando = espectadorPorDefecto(st);
  } else if (jugador.vivo) {
    st.espectando = null;
  }

  if (st.fase === "escape" && st.tiempoEscape <= 0) {
    // se acabó la música: todos los que no llegaron mueren
    for (const e of survVivos) {
      e.vivo = false;
      e.sufriendo = false;
      salpicar(st, e.x, e.y, 26, 1.7);
      st.muertes.push({ id: e.id, t: st.t });
    }
    st.estado = jugador.escapo ? "ganado" : "perdido";
  } else if (jugador.escapo) {
    st.estado = "ganado";
  } else if (survVivos.length === 0) {
    st.estado = "perdido";
  }
}

function espectadorPorDefecto(st: GameState): number | null {
  const jugador = st.entities.find((e) => e.isPlayer)!;
  const vivos = st.entities
    .filter((e) => e.vivo && !e.isPlayer && e.team === "survivor")
    .sort(
      (a, b) =>
        Math.hypot(a.x - jugador.x, a.y - jugador.y) - Math.hypot(b.x - jugador.x, b.y - jugador.y),
    );
  const alt = st.entities.filter((e) => e.vivo && !e.isPlayer);
  return (vivos[0] ?? alt[0])?.id ?? null;
}

/** Cambia a quién observa el jugador fantasma (sobrevivientes y luego asesinos). */
export function cambiarEspectado(st: GameState, paso = 1) {
  const lista = st.entities.filter((e) => e.vivo && !e.isPlayer);
  if (!lista.length) {
    st.espectando = null;
    return;
  }
  const i = lista.findIndex((e) => e.id === st.espectando);
  const sig = lista[((i < 0 ? 0 : i + paso) + lista.length * 2) % lista.length]!;
  st.espectando = sig.id;
}

/** Entidad que sigue la cámara: el jugador vivo o su objetivo de espectador. */
export function focoCamara(st: GameState): Entity {
  const jugador = st.entities.find((e) => e.isPlayer)!;
  if (jugador.vivo) return jugador;
  return st.entities.find((e) => e.id === st.espectando && e.vivo) ?? jugador;
}
