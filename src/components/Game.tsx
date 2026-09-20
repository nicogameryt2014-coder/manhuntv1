import { useEffect, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { FlaskConical, Hand, PackageOpen, ShieldPlus, Sparkles, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ABILITY_INFO,
  ABILITY2_INFO,
  ITEM_INFO,
  SURVIVOR_ABILITIES,
  crearJuego,
  cambiarEspectado,
  focoCamara,
  step,
  type GameState,
  type Input,
  type ItemKind,
  type ModoMuerte,
  type SurvivorAbility,
  SUFRIMIENTO,
} from "@/game/engine";
import { render } from "@/game/render";
import sonicAudio from "@/assets/sonic.mp3.asset.json";
import muerteAudio from "@/assets/muerte.mp3.asset.json";
import golpeAudio from "@/assets/golpe.mp3.asset.json";
import rondaAudio from "@/assets/ronda.mp3.asset.json";
import { actualizarAudio, efecto, iniciarMusicaRonda, pararMusicaRonda, pista } from "@/game/audio";

type Fase = "menu" | "jugando";

/** Acciones con tecla personalizable. */
export type Accion =
  | "up"
  | "down"
  | "left"
  | "right"
  | "run"
  | "habilidad"
  | "habilidad2"
  | "recoger"
  | "botiquin"
  | "cola"
  | "antidoto"
  | "cancelar";

const ACCION_NOMBRE: Record<Accion, string> = {
  up: "Arriba",
  down: "Abajo",
  left: "Izquierda",
  right: "Derecha",
  run: "Correr",
  habilidad: "Habilidad 1",
  habilidad2: "Habilidad 2",
  recoger: "Recoger objeto",
  botiquin: "Usar botiquín",
  cola: "Usar cola",
  antidoto: "Usar antídoto",
  cancelar: "Cancelar acción",
};

const TECLAS_DEFECTO: Record<Accion, string> = {
  up: "w",
  down: "s",
  left: "a",
  right: "d",
  run: "shift",
  habilidad: " ",
  habilidad2: "q",
  recoger: "e",
  botiquin: "1",
  cola: "2",
  antidoto: "3",
  cancelar: "escape",
};

const ACCIONES = Object.keys(TECLAS_DEFECTO) as Accion[];
const TECLAS_STORAGE = "ultimo-turno-teclas";

function nombreTecla(k: string): string {
  if (k === " ") return "Espacio";
  if (k === "escape") return "Esc";
  if (k === "shift") return "Shift";
  if (k.startsWith("arrow")) return k.replace("arrow", "↑↓←→"[["up", "down", "left", "right"].indexOf(k.slice(5))] ?? "");
  return k.toUpperCase();
}

function leerTeclas(): Record<Accion, string> {
  if (typeof localStorage === "undefined") return { ...TECLAS_DEFECTO };
  try {
    const raw = localStorage.getItem(TECLAS_STORAGE);
    if (!raw) return { ...TECLAS_DEFECTO };
    return { ...TECLAS_DEFECTO, ...(JSON.parse(raw) as Record<Accion, string>) };
  } catch {
    return { ...TECLAS_DEFECTO };
  }
}

type Hud = {
  hp: number;
  sp: number;
  spFrac: number;
  agotado: boolean;
  escudo: number;
  cooldown: number;
  cooldownTotal: number;
  cooldown2: number;
  cooldown2Total: number;
  canal: { nombre: string; progreso: number } | null;
  inventario: ItemKind[];
  tiempo: number;
  estado: GameState["estado"];
  mensajes: string[];
  escudoActivo: boolean;
  sufriendo: boolean;
  reviveFrac: number;
  peligro: number;
  fantasma: boolean;
  observando: string | null;
  escape: boolean;
  escapados: number;
  escapaste: boolean;
};

type TouchMove = { x: number; y: number };

const VW = 960;
const VH = 620;
const MOBILE_VW = 620;
const MOBILE_VH = 900;

export function Game() {
  const [fase, setFase] = useState<Fase>("menu");
  const [habilidad, setHabilidad] = useState<SurvivorAbility>("medico");
  const [nSobrevivientes, setNSobrevivientes] = useState(4);
  const [nAsesinos, setNAsesinos] = useState(2);
  const [modo, setModo] = useState<ModoMuerte>("instantanea");
  const [debug, setDebug] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [tactil, setTactil] = useState(false);
  const [palanca, setPalanca] = useState<TouchMove>({ x: 0, y: 0 });
  const [vista, setVista] = useState({ w: VW, h: VH });
  const [teclas, setTeclas] = useState<Record<Accion, string>>(() => ({ ...TECLAS_DEFECTO }));
  const [capturando, setCapturando] = useState<Accion | null>(null);
  const teclasRef = useRef(teclas);
  teclasRef.current = teclas;
  const capturandoRef = useRef<Accion | null>(null);
  capturandoRef.current = capturando;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const pulsos = useRef<{
    habilidad: boolean;
    habilidad2: boolean;
    recoger: boolean;
    item: ItemKind | null;
    cancelar: boolean;
  }>({ habilidad: false, habilidad2: false, recoger: false, item: null, cancelar: false });
  const musicaRef = useRef<HTMLAudioElement | null>(null);
  const duracionMusica = useRef(0);
  const muertesVistas = useRef(0);
  const golpesVistos = useRef(0);
  const debugRef = useRef(debug);
  const touchMove = useRef<TouchMove>({ x: 0, y: 0 });
  const touchRun = useRef(false);
  debugRef.current = debug;

  const iniciar = useCallback(
    (a: SurvivorAbility) => {
      muertesVistas.current = 0;
      golpesVistos.current = 0;
      iniciarMusicaRonda(rondaAudio.url);
      stateRef.current = crearJuego({
        habilidad: a,
        sobrevivientes: nSobrevivientes,
        asesinos: nAsesinos,
        duracion: 180,
        modo,
      });
      setFase("jugando");
    },
    [nSobrevivientes, nAsesinos, modo],
  );


  useEffect(() => {
    setTeclas(leerTeclas());
  }, []);

  const guardarTecla = useCallback((accion: Accion, key: string) => {
    setTeclas((prev) => {
      const next = { ...prev };
      for (const a of ACCIONES) if (next[a] === key && a !== accion) next[a] = "";
      next[accion] = key;
      try {
        localStorage.setItem(TECLAS_STORAGE, JSON.stringify(next));
      } catch {
        /* sin almacenamiento */
      }
      return next;
    });
  }, []);

  const restaurarTeclas = useCallback(() => {
    setTeclas({ ...TECLAS_DEFECTO });
    try {
      localStorage.removeItem(TECLAS_STORAGE);
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  // pista que suena al abrirse la salida; su duración marca el tiempo de escape
  useEffect(() => {
    const audio = new Audio(sonicAudio.url);
    audio.preload = "auto";
    audio.volume = 0.7;
    const alCargar = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 1) {
        duracionMusica.current = audio.duration;
      }
    };
    audio.addEventListener("loadedmetadata", alCargar);
    musicaRef.current = audio;
    return () => {
      audio.removeEventListener("loadedmetadata", alCargar);
      audio.pause();
      musicaRef.current = null;
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse), (max-width: 767px)");
    const actualizar = () => {
      setTactil(query.matches);
      const vertical = query.matches && window.innerHeight > window.innerWidth;
      setVista(vertical ? { w: MOBILE_VW, h: MOBILE_VH } : { w: VW, h: VH });
    };
    actualizar();
    query.addEventListener("change", actualizar);
    window.addEventListener("resize", actualizar);
    return () => {
      query.removeEventListener("change", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, []);

  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      // captura de tecla para personalizar controles
      if (capturandoRef.current) {
        ev.preventDefault();
        if (k !== "tab") guardarTecla(capturandoRef.current, k);
        setCapturando(null);
        return;
      }
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) ev.preventDefault();
      keys.current[k] = true;
      const t = teclasRef.current;
      if (k === t.habilidad) pulsos.current.habilidad = true;
      if (k === t.habilidad2) pulsos.current.habilidad2 = true;
      if (k === t.recoger) pulsos.current.recoger = true;
      if (k === t.botiquin) pulsos.current.item = "botiquin";
      if (k === t.cola) pulsos.current.item = "cola";
      if (k === t.antidoto) pulsos.current.item = "antidoto";
      if (k === t.cancelar) pulsos.current.cancelar = true;
      if (k === "tab" || k === "f") {
        const st = stateRef.current;
        const p = st?.entities.find((e) => e.isPlayer);
        if (st && p && !p.vivo) {
          ev.preventDefault();
          cambiarEspectado(st, k === "tab" && ev.shiftKey ? -1 : 1);
        }
      }
    };
    const up = (ev: KeyboardEvent) => {
      keys.current[ev.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [guardarTecla]);

  useEffect(() => {
    if (fase !== "jugando") return;
    document.body.classList.add("game-active");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const st = stateRef.current;
      if (!st) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keys.current;
      const t = teclasRef.current;
      const input: Input = {
        up: !!(k[t.up] || k["arrowup"] || touchMove.current.y < -0.25),
        down: !!(k[t.down] || k["arrowdown"] || touchMove.current.y > 0.25),
        left: !!(k[t.left] || k["arrowleft"] || touchMove.current.x < -0.25),
        right: !!(k[t.right] || k["arrowright"] || touchMove.current.x > 0.25),
        run: !!(k[t.run] || touchRun.current),
        usarHabilidad: pulsos.current.habilidad,
        usarHabilidad2: pulsos.current.habilidad2,
        recoger: pulsos.current.recoger,
        usarItem: pulsos.current.item,
        cancelar: pulsos.current.cancelar,
      };
      pulsos.current = { habilidad: false, habilidad2: false, recoger: false, item: null, cancelar: false };
      // la fase de escape dura exactamente lo que la pista de audio
      if (st.fase === "caza" && duracionMusica.current > 0) {
        st.duracionEscape = duracionMusica.current;
      }
      const antes = st.fase;
      step(st, dt, input);
      // suena el efecto por cada golpe nuevo, solo si ocurre dentro de la pantalla
      if (st.golpes.length > golpesVistos.current) {
        const cam = focoCamara(st);
        const nuevos = st.golpes.slice(golpesVistos.current);
        golpesVistos.current = st.golpes.length;
        const visible = nuevos.some(
          (g) =>
            Math.abs(g.x - cam.x) < vista.w / 2 + 20 && Math.abs(g.y - cam.y) < vista.h / 2 + 20,
        );
        if (visible) efecto(golpeAudio.url, 0.8);
      }
      // suena el efecto por cada muerte definitiva nueva
      if (st.muertes.length > muertesVistas.current) {
        muertesVistas.current = st.muertes.length;
        efecto(muerteAudio.url, 0.9);
      }
      if (antes === "caza" && st.fase === "escape") {
        // la música de ronda se apaga: en el escape sólo suena la pista de escape
        pararMusicaRonda();
        if (musicaRef.current) pista(musicaRef.current);
      }
      if (st.estado !== "jugando") {
        if (musicaRef.current && !musicaRef.current.paused) musicaRef.current.pause();
        pararMusicaRonda();
      }
      render(ctx, st, vista.w, vista.h, debugRef.current);

      const p = st.entities.find((e) => e.isPlayer);
      if (!p) return;
      const vidaFrac = Math.max(0, Math.min(1, p.hp / p.maxHp));
      // la mezcla se apaga/ralentiza/hace eco con poca vida; latidos tras revivir
      if (st.estado === "jugando") {
        actualizarAudio({
          vidaFrac: p.vivo ? (p.sufriendo ? 0.15 : vidaFrac) : 1,
          latidos: p.vivo && !p.sufriendo && p.caidas > 0,
          dt,
        });
      }
      const gris = !p.vivo || p.sufriendo ? 1 : Math.max(0, 1 - vidaFrac / 0.7);
      const peligro = p.sufriendo && p.vivo ? 1 - vidaFrac : 0;
      const brillo = 1 - peligro * 0.45;
      const spMostrado = Math.max(0, Math.min(p.maxSp, Math.round(p.sp)));
      canvas.style.filter =
        gris > 0.02 || peligro > 0.02
          ? `grayscale(${gris.toFixed(2)}) sepia(${(gris * 0.35).toFixed(2)}) brightness(${brillo.toFixed(2)})`
          : "";
      const observado = !p.vivo
        ? (st.entities.find((e) => e.id === st.espectando)?.nombre ?? null)
        : null;
      setHud({
        fantasma: !p.vivo,
        observando: observado,
        sufriendo: p.sufriendo,
        reviveFrac: Math.min(1, p.revive / SUFRIMIENTO.segundosRevivir),
        peligro,
        hp: Math.max(0, Math.round(p.hp)),
        sp: spMostrado,
        spFrac: p.maxSp > 0 ? spMostrado / p.maxSp : 0,
        agotado: p.agotado,
        escudo: p.escudo && st.t < p.escudo.hasta ? Math.round(p.escudo.hp) : 0,
        cooldown: Math.max(0, p.cooldownHasta - st.t),
        cooldownTotal: p.cooldownTotal,
        cooldown2: Math.max(0, p.cooldown2Hasta - st.t),
        cooldown2Total: p.cooldown2Total,
        canal: p.canalizando
          ? {
              nombre: ITEM_INFO[p.canalizando.tipo].nombre,
              progreso: 1 - (p.canalizando.fin - st.t) / p.canalizando.total,
            }
          : null,
        inventario: (Object.keys(p.inventario) as ItemKind[]).filter((i) => p.inventario[i]),
        tiempo: Math.ceil(st.fase === "escape" ? st.tiempoEscape : st.tiempoRestante),
        escape: st.fase === "escape",
        escapados: st.escapados,
        escapaste: p.escapo,
        estado: st.estado,
        mensajes: st.mensajes.map((m) => m.texto).slice(-3),
        escudoActivo: p.escudoActivoSobre !== null,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove("game-active");
      touchMove.current = { x: 0, y: 0 };
      touchRun.current = false;
    };
  }, [fase, vista]);

  const moverPalanca = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const dx = ev.clientX - (rect.left + rect.width / 2);
    const dy = ev.clientY - (rect.top + rect.height / 2);
    const limite = rect.width * 0.32;
    const distancia = Math.hypot(dx, dy);
    const escala = distancia > limite ? limite / distancia : 1;
    const siguiente = { x: (dx * escala) / limite, y: (dy * escala) / limite };
    touchMove.current = siguiente;
    setPalanca(siguiente);
  };

  const iniciarPalanca = (ev: ReactPointerEvent<HTMLDivElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    moverPalanca(ev);
  };

  const soltarPalanca = () => {
    touchMove.current = { x: 0, y: 0 };
    setPalanca({ x: 0, y: 0 });
  };

  const pulsar = (accion: "habilidad" | "habilidad2" | "recoger" | "cancelar", item?: ItemKind) => {
    if (item) pulsos.current.item = item;
    else pulsos.current[accion] = true;
  };

  const panelTeclas = (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Teclas</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Pulsa un botón y luego la tecla que quieras usar.
      </p>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {ACCIONES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setCapturando(a)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition ${
              capturando === a ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
            }`}
          >
            <span>{ACCION_NOMBRE[a]}</span>
            <span className="font-mono text-[11px] text-primary">
              {capturando === a ? "Pulsa una tecla…" : teclas[a] ? nombreTecla(teclas[a]) : "—"}
            </span>
          </button>
        ))}
      </div>
      <Button onClick={restaurarTeclas} variant="outline" size="sm" className="mt-3 w-full">
        Restaurar teclas por defecto
      </Button>
    </div>
  );

  if (fase === "menu") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-16">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary">
            Asesinos vs sobrevivientes
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">Último Turno</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Sobrevive 3 minutos. Dos asesinos te persiguen: el Venenoso y el Ninja. Elige tu
            habilidad y busca botiquines y colas por el mapa.
          </p>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground sm:mt-10">
            Elige tu habilidad
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SURVIVOR_ABILITIES.map((a) => (
              <button
                key={a}
                onClick={() => setHabilidad(a)}
                className={`min-h-24 rounded-xl border p-4 text-left transition-colors ${
                  habilidad === a
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{ABILITY_INFO[a].nombre}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {ABILITY_INFO[a].cooldown}s
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{ABILITY_INFO[a].desc}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">
                    {ABILITY2_INFO[a].nombre} ({ABILITY2_INFO[a].cooldown}s)
                  </span>{" "}
                  — {ABILITY2_INFO[a].desc}
                </p>
              </button>
            ))}
          </div>

          <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Composición de la partida
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">Sobrevivientes</span>
                <span className="font-mono text-primary">{nSobrevivientes}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={nSobrevivientes}
                onChange={(e) => setNSobrevivientes(Number(e.target.value))}
                className="mt-3 w-full accent-primary"
              />
              <p className="mt-2 text-xs text-muted-foreground">Tú incluido (1 a 20).</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">Asesinos</span>
                <span className="font-mono text-destructive">{nAsesinos}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={nAsesinos}
                onChange={(e) => setNAsesinos(Number(e.target.value))}
                className="mt-3 w-full accent-primary"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Se coordinan: uno persigue y el resto flanquea (1 a 20).
              </p>
            </div>
          </div>

          <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Modo de muerte
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([
              {
                id: "instantanea" as const,
                nombre: "Muerte instantánea",
                desc: "Si tu vida llega a 0, mueres al momento.",
              },
              {
                id: "sufrimiento" as const,
                nombre: "Sufrimiento",
                desc: "Al caer te arrastras: vida roja que baja sola, dejas sangre y el asesino no puede golpearte. Un aliado puede revivirte quedándose 4 s a tu lado. A la tercera caída mueres.",
              },
            ]).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModo(m.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  modo === m.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                <span className="font-semibold">{m.nombre}</span>
                <p className="mt-1 text-xs text-muted-foreground">{m.desc}</p>
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
            <Button
              onClick={() => iniciar(habilidad)}
              size="lg"
              className="h-12 w-full sm:w-auto"
            >
              Empezar partida
            </Button>
            <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={debug}
                onChange={(e) => setDebug(e.target.checked)}
                className="accent-primary"
              />
              Modo debug (ver hitboxes)
            </label>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Controles</h3>
              <ul className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
                <li className="sm:hidden">Palanca y botones en pantalla</li>
                <li>WASD / flechas — mover</li>
                <li>Shift — correr</li>
                <li>{nombreTecla(teclas.habilidad)} — habilidad 1</li>
                <li>{nombreTecla(teclas.habilidad2)} — habilidad 2</li>
                <li>E — recoger objeto</li>
                <li>1 / 2 / 3 — botiquín / cola / antídoto</li>
                <li>Esc — cancelar acción</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Asesinos</h3>
              <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
                <li>
                  <span className="font-semibold text-destructive">Venenoso</span> —{" "}
                  {ABILITY_INFO.venenoso.desc}
                </li>
                <li>
                  <span className="font-semibold text-destructive">Ninja</span> —{" "}
                  {ABILITY_INFO.ninja.desc}
                </li>
                <li>Todos los asesinos corren, pero más lento que un sobreviviente corriendo.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6">{panelTeclas}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="game-screen flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-2 py-2 text-foreground sm:px-4 sm:py-6">
      <div className="game-stage relative w-full max-w-[960px] overflow-hidden rounded-lg border border-border sm:rounded-xl">
        <canvas
          ref={canvasRef}
          width={vista.w}
          height={vista.h}
          className="block h-auto max-h-[calc(100dvh-11rem)] w-full touch-none bg-card object-contain shadow-2xl sm:max-h-none"
        />

        {/* Tinte rojo de peligro (estado de sufrimiento) */}
        {hud && hud.peligro > 0.02 && (
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-300"
            style={{
              background: `radial-gradient(ellipse at center, rgba(120,0,0,${(hud.peligro * 0.25).toFixed(2)}) 0%, rgba(90,0,0,${(hud.peligro * 0.65).toFixed(2)}) 100%)`,
            }}
          />
        )}

        {/* HUD */}
        {hud && (
          <>
            <div className="pointer-events-none absolute left-2 top-2 w-[min(15rem,62%)] space-y-1 sm:left-4 sm:top-4 sm:w-64 sm:space-y-2">
              <div className="rounded-md bg-background/80 p-2 backdrop-blur sm:rounded-lg sm:p-3">
                <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                  <span>{ABILITY_INFO[habilidad].nombre}</span>
                  <span>{hud.hp} HP{hud.escudo ? ` +${hud.escudo}` : ""}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-white/10">
                  <div
                    className={`h-2 rounded transition-[width] ${hud.sufriendo ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${hud.hp}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="w-6 shrink-0 font-mono text-[10px] text-muted-foreground">SP</span>
                  <div className="h-2 flex-1 rounded bg-white/10">
                    <div
                      className={`h-2 rounded ${
                        hud.agotado
                          ? "bg-destructive"
                          : hud.spFrac < 0.35
                            ? "bg-amber-400"
                            : "bg-green-500"
                      }`}
                      style={{ width: `${hud.spFrac * 100}%` }}
                    />
                  </div>
                  <span className="w-[4.5rem] shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                    {hud.agotado ? "¡Agotado!" : `${hud.sp} SP`}
                  </span>
                </div>
                {hud.sufriendo && (
                  <>
                    <div className="mt-1 h-2 rounded bg-white/10">
                      <div
                        className="h-2 rounded bg-blue-500 transition-[width]"
                        style={{ width: `${hud.reviveFrac * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-destructive">
                      ¡Te arrastras! Un aliado debe quedarse a tu lado para revivirte.
                    </div>
                  </>
                )}
                <div className="mt-2 h-2 rounded bg-white/10">
                  <div
                    className="h-2 rounded bg-secondary"
                    style={{
                      width: `${hud.cooldown > 0 ? 100 - (hud.cooldown / hud.cooldownTotal) * 100 : 100}%`,
                    }}
                  />
                </div>
                <div className="mt-2 h-2 rounded bg-white/10">
                  <div
                    className="h-2 rounded bg-blue-400"
                    style={{
                      width: `${hud.cooldown2 > 0 ? 100 - (hud.cooldown2 / hud.cooldown2Total) * 100 : 100}%`,
                    }}
                  />
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {ABILITY2_INFO[habilidad].nombre}:{" "}
                  {hud.cooldown2 > 0
                    ? `${hud.cooldown2.toFixed(1)}s`
                    : `lista (${nombreTecla(teclas.habilidad2)})`}
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {hud.escudoActivo
                    ? "Escudo activo — Espacio/Esc para cancelar (+10s)"
                    : hud.cooldown > 0
                      ? `Habilidad en ${hud.cooldown.toFixed(1)}s`
                      : "Habilidad lista (Espacio)"}
                </div>
              </div>
              {hud.canal && (
              <div className="rounded-md bg-background/80 p-2 backdrop-blur sm:rounded-lg sm:p-3">
                  <div className="font-mono text-[11px]">Usando {hud.canal.nombre}…</div>
                  <div className="mt-1 h-2 rounded bg-white/10">
                    <div
                      className="h-2 rounded bg-primary"
                      style={{ width: `${hud.canal.progreso * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute right-2 top-2 space-y-1 text-right sm:right-4 sm:top-4 sm:space-y-2">
              <div
                className={`rounded-md px-2 py-1 font-mono text-xs backdrop-blur sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm ${hud.escape ? "bg-destructive/85 text-destructive-foreground" : "bg-background/80"}`}
              >
                {hud.escape ? "ESCAPE " : ""}
                {Math.floor(hud.tiempo / 60)}:{String(hud.tiempo % 60).padStart(2, "0")}
              </div>
              {hud.escape && (
                <div className="rounded-md bg-background/80 px-2 py-1 font-mono text-[11px] backdrop-blur sm:rounded-lg sm:px-3">
                  {hud.escapaste ? "Escapaste ✔" : "¡Corre a la salida!"} · {hud.escapados} fuera
                </div>
              )}
              <div className="hidden rounded-lg bg-background/80 px-3 py-2 font-mono text-[11px] backdrop-blur sm:block">
                <div>1 · Botiquín {hud.inventario.includes("botiquin") ? "✔" : "—"}</div>
                <div>2 · Cola {hud.inventario.includes("cola") ? "✔" : "—"}</div>
                <div>3 · Antídoto {hud.inventario.includes("antidoto") ? "✔" : "—"}</div>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-2 left-2 max-w-[55%] space-y-1 font-mono text-[10px] text-muted-foreground sm:bottom-4 sm:left-4 sm:text-[11px]">
              {hud.mensajes.map((m, i) => (
                <div key={i} className="rounded bg-background/75 px-2 py-1">
                  {m}
                </div>
              ))}
            </div>

            {hud.fantasma && hud.estado === "jugando" && (
              <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-background/85 px-3 py-2 font-mono text-[11px] backdrop-blur sm:bottom-4">
                <span>
                  👻 Eres un fantasma · observando a {hud.observando ?? "nadie"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => stateRef.current && cambiarEspectado(stateRef.current, 1)}
                >
                  Cambiar (F)
                </Button>
              </div>
            )}

            {hud.estado !== "jugando" && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-xl bg-background/90">
                <h2 className="text-3xl font-black sm:text-4xl">
                  {hud.estado === "ganado"
                    ? hud.escapaste
                      ? "¡Escapaste!"
                      : "¡Sobreviviste!"
                    : hud.escape
                      ? "No llegaste a la salida"
                      : "Te atraparon"}
                </h2>
                <p className="font-mono text-xs text-muted-foreground">
                  {hud.escapados} sobreviviente(s) lograron escapar
                </p>
                <Button
                  onClick={() => setFase("menu")}
                  size="lg"
                >
                  Volver al menú
                </Button>
              </div>
            )}
          </>
        )}

        <Button
          onClick={() => setAjustes((v) => !v)}
          variant="outline"
          size="sm"
          className="absolute bottom-2 right-2 z-20 bg-card/90 backdrop-blur sm:bottom-4 sm:right-4"
        >
          Ajustes
        </Button>
        {ajustes && (
          <div className="absolute bottom-16 right-4 z-30 w-72 rounded-xl border border-border bg-card p-4 shadow-xl">
            <h3 className="text-sm font-semibold">Ajustes</h3>
            <label className="mt-3 flex cursor-pointer items-center justify-between text-xs">
              <span>Debug: ver hitboxes</span>
              <input
                type="checkbox"
                checked={debug}
                onChange={(e) => setDebug(e.target.checked)}
                className="accent-primary"
              />
            </label>
            <div className="mt-3 max-h-64 overflow-y-auto">{panelTeclas}</div>
            <Button
              onClick={() => setFase("menu")}
              variant="outline"
              size="sm"
              className="mt-4 w-full"
            >
              Abandonar partida
            </Button>
          </div>
        )}
      </div>

      {tactil && hud?.estado === "jugando" && (
        <div className="touch-controls grid w-full max-w-[960px] grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.25fr)] items-end gap-3 pt-3 sm:gap-6">
          <div
            role="application"
            aria-label="Palanca de movimiento"
            onPointerDown={iniciarPalanca}
            onPointerMove={(ev) => ev.currentTarget.hasPointerCapture(ev.pointerId) && moverPalanca(ev)}
            onPointerUp={soltarPalanca}
            onPointerCancel={soltarPalanca}
            className="relative size-32 touch-none rounded-full border border-border bg-card/80 shadow-lg landscape:size-28"
          >
            <div className="absolute inset-4 rounded-full border border-border/70" />
            <div
              className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/60 bg-primary/25 shadow-md"
              style={{ transform: `translate(calc(-50% + ${palanca.x * 36}px), calc(-50% + ${palanca.y * 36}px))` }}
            >
              <span className="sr-only">Mover</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 justify-self-end">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Usar botiquín"
              disabled={!hud.inventario.includes("botiquin")}
              onPointerDown={() => pulsar("recoger", "botiquin")}
              className="size-12 touch-none"
            ><ShieldPlus /></Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Usar cola"
              disabled={!hud.inventario.includes("cola")}
              onPointerDown={() => pulsar("recoger", "cola")}
              className="size-12 touch-none"
            ><Zap /></Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Usar antídoto"
              disabled={!hud.inventario.includes("antidoto")}
              onPointerDown={() => pulsar("recoger", "antidoto")}
              className="size-12 touch-none"
            ><FlaskConical /></Button>
            <Button type="button" variant="outline" size="icon" aria-label="Recoger objeto" onPointerDown={() => pulsar("recoger")} className="size-12 touch-none"><PackageOpen /></Button>
            <Button type="button" variant="outline" size="icon" aria-label="Cancelar acción" onPointerDown={() => pulsar("cancelar")} className="size-12 touch-none"><X /></Button>
            <Button
              type="button"
              variant="secondary"
              aria-label="Correr"
              onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); touchRun.current = true; }}
              onPointerUp={() => { touchRun.current = false; }}
              onPointerCancel={() => { touchRun.current = false; }}
              className="col-span-2 h-12 touch-none"
            >Correr</Button>
            <Button type="button" aria-label="Usar habilidad" onPointerDown={() => pulsar("habilidad")} className="col-span-2 h-12 touch-none"><Hand /> Habilidad</Button>
            <Button type="button" variant="secondary" aria-label="Usar segunda habilidad" onPointerDown={() => pulsar("habilidad2")} className="col-span-4 h-12 touch-none"><Sparkles /> {ABILITY2_INFO[habilidad].nombre}</Button>
          </div>
        </div>
      )}

      <p className="mt-3 hidden font-mono text-[11px] text-muted-foreground sm:block">
        Mover {nombreTecla(teclas.up)}{nombreTecla(teclas.left)}{nombreTecla(teclas.down)}
        {nombreTecla(teclas.right)} · Correr {nombreTecla(teclas.run)} · Habilidad{" "}
        {nombreTecla(teclas.habilidad)} · Habilidad 2 {nombreTecla(teclas.habilidad2)} · Recoger{" "}
        {nombreTecla(teclas.recoger)} · Cancelar {nombreTecla(teclas.cancelar)}
      </p>
    </main>
  );
}
