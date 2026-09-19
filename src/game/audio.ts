// Gestor de audio del juego: música de ronda en bucle, efectos y latidos.
// Toda la mezcla pasa por un filtro que se apaga, ralentiza y añade eco
// conforme el jugador pierde vida.

let ctx: AudioContext | null = null;
let entrada: GainNode | null = null;
let filtro: BiquadFilterNode | null = null;
let master: GainNode | null = null;
let ecoWet: GainNode | null = null;
let musica: HTMLAudioElement | null = null;
let musicaUrl = "";
let salud = 1;
let proximoLatido = 0;
const conectados = new WeakSet<HTMLMediaElement>();

function asegurarCtx() {
  if (ctx) return ctx;
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  entrada = ctx.createGain();
  filtro = ctx.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.value = 20000;
  master = ctx.createGain();
  master.gain.value = 1;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.28;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.42;
  ecoWet = ctx.createGain();
  ecoWet.gain.value = 0;
  entrada.connect(filtro);
  filtro.connect(master);
  filtro.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(ecoWet);
  ecoWet.connect(master);
  master.connect(ctx.destination);
  return ctx;
}

function enrutar(el: HTMLMediaElement) {
  const c = asegurarCtx();
  if (!c || !entrada || conectados.has(el)) return;
  try {
    const src = c.createMediaElementSource(el);
    src.connect(entrada);
    conectados.add(el);
  } catch {
    /* si falla, el elemento suena directo */
  }
}

/** Arranca la música de ronda en bucle. */
export function iniciarMusicaRonda(url: string) {
  musicaUrl = url;
  const c = asegurarCtx();
  if (c?.state === "suspended") void c.resume();
  if (!musica) {
    musica = new Audio(url);
    musica.loop = true;
    musica.preload = "auto";
    musica.volume = 0.55;
  }
  enrutar(musica);
  musica.currentTime = 0;
  musica.playbackRate = 1;
  void musica.play().catch(() => {});
}

export function pararMusicaRonda() {
  musica?.pause();
  salud = 1;
  aplicar();
}

/** Reproduce un efecto puntual por la misma cadena de mezcla. */
export function efecto(url: string, volumen = 0.8) {
  const a = new Audio(url);
  a.volume = volumen;
  enrutar(a);
  void a.play().catch(() => {});
}

/** Reproduce una pista una vez (por ejemplo la música de escape). */
export function pista(el: HTMLAudioElement) {
  enrutar(el);
  el.currentTime = 0;
  void el.play().catch(() => {});
}

function aplicar() {
  const daño = 1 - salud; // 0 sano, 1 al borde de la muerte
  if (filtro) filtro.frequency.value = 20000 - daño * 19300;
  if (ecoWet) ecoWet.gain.value = daño * 0.55;
  if (master) master.gain.value = 1 - daño * 0.55;
  if (musica) musica.playbackRate = 1 - daño * 0.35;
}

/**
 * Actualiza la mezcla según el estado del jugador y lanza latidos si ya fue
 * revivido alguna vez (cada vez más rápidos y fuertes con menos vida).
 */
export function actualizarAudio(opts: { vidaFrac: number; latidos: boolean; dt: number }) {
  salud = Math.max(0, Math.min(1, opts.vidaFrac));
  aplicar();
  if (!opts.latidos) {
    proximoLatido = 0;
    return;
  }
  proximoLatido -= opts.dt;
  if (proximoLatido <= 0) {
    const intervalo = 0.45 + salud * 0.75;
    proximoLatido = intervalo;
    latido(0.25 + (1 - salud) * 0.85);
  }
}

function latido(intensidad: number) {
  const c = asegurarCtx();
  if (!c || !master) return;
  const golpe = (retardo: number, vol: number) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    const t = c.currentTime + retardo;
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.02, vol), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g);
    g.connect(master!);
    osc.start(t);
    osc.stop(t + 0.3);
  };
  golpe(0, intensidad);
  golpe(0.22, intensidad * 0.65);
}
