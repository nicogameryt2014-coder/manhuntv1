import { useEffect, useRef, useState, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { Hand, PackageOpen, ShieldPlus, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ABILITY_INFO,
  ITEM_INFO,
  SURVIVOR_ABILITIES,
  crearJuego,
  step,
  type GameState,
  type Input,
  type ItemKind,
  type ModoMuerte,
  type SurvivorAbility,
} from "@/game/engine";
import { render } from "@/game/render";

type Fase = "menu" | "jugando";

type Hud = {
  hp: number;
  escudo: number;
  cooldown: number;
  cooldownTotal: number;
  canal: { nombre: string; progreso: number } | null;
  inventario: ItemKind[];
  tiempo: number;
  estado: GameState["estado"];
  mensajes: string[];
  escudoActivo: boolean;
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
  const [debug, setDebug] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [tactil, setTactil] = useState(false);
  const [palanca, setPalanca] = useState<TouchMove>({ x: 0, y: 0 });
  const [vista, setVista] = useState({ w: VW, h: VH });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const pulsos = useRef<{ habilidad: boolean; recoger: boolean; item: ItemKind | null; cancelar: boolean }>(
    { habilidad: false, recoger: false, item: null, cancelar: false },
  );
  const debugRef = useRef(debug);
  const touchMove = useRef<TouchMove>({ x: 0, y: 0 });
  const touchRun = useRef(false);
  debugRef.current = debug;

  const iniciar = useCallback(
    (a: SurvivorAbility) => {
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
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) ev.preventDefault();
      keys.current[k] = true;
      if (k === " " || k === "q") pulsos.current.habilidad = true;
      if (k === "e") pulsos.current.recoger = true;
      if (k === "1") pulsos.current.item = "botiquin";
      if (k === "2") pulsos.current.item = "cola";
      if (k === "escape") pulsos.current.cancelar = true;
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
  }, []);

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
      const input: Input = {
        up: !!(k["w"] || k["arrowup"] || touchMove.current.y < -0.25),
        down: !!(k["s"] || k["arrowdown"] || touchMove.current.y > 0.25),
        left: !!(k["a"] || k["arrowleft"] || touchMove.current.x < -0.25),
        right: !!(k["d"] || k["arrowright"] || touchMove.current.x > 0.25),
        run: !!(k["shift"] || touchRun.current),
        usarHabilidad: pulsos.current.habilidad,
        recoger: pulsos.current.recoger,
        usarItem: pulsos.current.item,
        cancelar: pulsos.current.cancelar,
      };
      pulsos.current = { habilidad: false, recoger: false, item: null, cancelar: false };
      step(st, dt, input);
      render(ctx, st, vista.w, vista.h, debugRef.current);

      const p = st.entities.find((e) => e.isPlayer);
      if (!p) return;
      setHud({
        hp: Math.max(0, Math.round(p.hp)),
        escudo: p.escudo && st.t < p.escudo.hasta ? Math.round(p.escudo.hp) : 0,
        cooldown: Math.max(0, p.cooldownHasta - st.t),
        cooldownTotal: p.cooldownTotal,
        canal: p.canalizando
          ? {
              nombre: ITEM_INFO[p.canalizando.tipo].nombre,
              progreso: 1 - (p.canalizando.fin - st.t) / p.canalizando.total,
            }
          : null,
        inventario: (Object.keys(p.inventario) as ItemKind[]).filter((i) => p.inventario[i]),
        tiempo: Math.ceil(st.tiempoRestante),
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

  const pulsar = (accion: "habilidad" | "recoger" | "cancelar", item?: ItemKind) => {
    if (item) pulsos.current.item = item;
    else pulsos.current[accion] = true;
  };

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
                <li>Espacio — habilidad</li>
                <li>E — recoger objeto</li>
                <li>1 / 2 — botiquín / cola</li>
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
                    className="h-2 rounded bg-primary transition-[width]"
                    style={{ width: `${hud.hp}%` }}
                  />
                </div>
                <div className="mt-2 h-2 rounded bg-white/10">
                  <div
                    className="h-2 rounded bg-secondary"
                    style={{
                      width: `${hud.cooldown > 0 ? 100 - (hud.cooldown / hud.cooldownTotal) * 100 : 100}%`,
                    }}
                  />
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
              <div className="rounded-md bg-background/80 px-2 py-1 font-mono text-xs backdrop-blur sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm">
                {Math.floor(hud.tiempo / 60)}:{String(hud.tiempo % 60).padStart(2, "0")}
              </div>
              <div className="hidden rounded-lg bg-background/80 px-3 py-2 font-mono text-[11px] backdrop-blur sm:block">
                <div>1 · Botiquín {hud.inventario.includes("botiquin") ? "✔" : "—"}</div>
                <div>2 · Cola {hud.inventario.includes("cola") ? "✔" : "—"}</div>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-2 left-2 max-w-[55%] space-y-1 font-mono text-[10px] text-muted-foreground sm:bottom-4 sm:left-4 sm:text-[11px]">
              {hud.mensajes.map((m, i) => (
                <div key={i} className="rounded bg-background/75 px-2 py-1">
                  {m}
                </div>
              ))}
            </div>

            {hud.estado !== "jugando" && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-xl bg-background/90">
                <h2 className="text-3xl font-black sm:text-4xl">
                  {hud.estado === "ganado" ? "¡Sobreviviste!" : "Te atraparon"}
                </h2>
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
          <div className="absolute bottom-16 right-4 w-64 rounded-xl border border-border bg-card p-4 shadow-xl">
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
          </div>
        </div>
      )}

      <p className="mt-3 hidden font-mono text-[11px] text-muted-foreground sm:block">
        WASD mover · Shift correr · Espacio habilidad · E recoger · 1/2 usar objeto · Esc cancelar
      </p>
    </main>
  );
}
