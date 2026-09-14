import { useEffect, useRef, useState, useCallback } from "react";
import {
  ABILITY_INFO,
  ITEM_INFO,
  SURVIVOR_ABILITIES,
  crearJuego,
  step,
  type GameState,
  type Input,
  type ItemKind,
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

const VW = 960;
const VH = 620;

export function Game() {
  const [fase, setFase] = useState<Fase>("menu");
  const [habilidad, setHabilidad] = useState<SurvivorAbility>("medico");
  const [nSobrevivientes, setNSobrevivientes] = useState(4);
  const [nAsesinos, setNAsesinos] = useState(2);
  const [debug, setDebug] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const pulsos = useRef<{ habilidad: boolean; recoger: boolean; item: ItemKind | null; cancelar: boolean }>(
    { habilidad: false, recoger: false, item: null, cancelar: false },
  );
  const debugRef = useRef(debug);
  debugRef.current = debug;

  const iniciar = useCallback(
    (a: SurvivorAbility) => {
      stateRef.current = crearJuego({
        habilidad: a,
        sobrevivientes: nSobrevivientes,
        asesinos: nAsesinos,
        duracion: 180,
      });
      setFase("jugando");
    },
    [nSobrevivientes, nAsesinos],
  );


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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
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
        up: !!(k["w"] || k["arrowup"]),
        down: !!(k["s"] || k["arrowdown"]),
        left: !!(k["a"] || k["arrowleft"]),
        right: !!(k["d"] || k["arrowright"]),
        run: !!(k["shift"]),
        usarHabilidad: pulsos.current.habilidad,
        recoger: pulsos.current.recoger,
        usarItem: pulsos.current.item,
        cancelar: pulsos.current.cancelar,
      };
      pulsos.current = { habilidad: false, recoger: false, item: null, cancelar: false };
      step(st, dt, input);
      render(ctx, st, VW, VH, debugRef.current);

      const p = st.entities.find((e) => e.isPlayer)!;
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
    return () => cancelAnimationFrame(raf);
  }, [fase]);

  if (fase === "menu") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary">
            Asesinos vs sobrevivientes
          </p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">Último Turno</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Sobrevive 3 minutos. Dos asesinos te persiguen: el Venenoso y el Ninja. Elige tu
            habilidad y busca botiquines y colas por el mapa.
          </p>

          <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Elige tu habilidad
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SURVIVOR_ABILITIES.map((a) => (
              <button
                key={a}
                onClick={() => setHabilidad(a)}
                className={`rounded-xl border p-4 text-left transition-colors ${
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

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => iniciar(habilidad)}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Empezar partida
            </button>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm">
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-6 text-foreground">
      <div className="relative" style={{ width: VW, maxWidth: "100%" }}>
        <canvas
          ref={canvasRef}
          width={VW}
          height={VH}
          className="w-full rounded-xl border border-border bg-card shadow-2xl"
        />

        {/* HUD */}
        {hud && (
          <>
            <div className="pointer-events-none absolute left-4 top-4 w-64 space-y-2">
              <div className="rounded-lg bg-black/60 p-3 backdrop-blur">
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
                <div className="rounded-lg bg-black/60 p-3 backdrop-blur">
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

            <div className="pointer-events-none absolute right-4 top-4 space-y-2 text-right">
              <div className="rounded-lg bg-black/60 px-3 py-2 font-mono text-sm backdrop-blur">
                {Math.floor(hud.tiempo / 60)}:{String(hud.tiempo % 60).padStart(2, "0")}
              </div>
              <div className="rounded-lg bg-black/60 px-3 py-2 font-mono text-[11px] backdrop-blur">
                <div>1 · Botiquín {hud.inventario.includes("botiquin") ? "✔" : "—"}</div>
                <div>2 · Cola {hud.inventario.includes("cola") ? "✔" : "—"}</div>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-4 left-4 space-y-1 font-mono text-[11px] text-muted-foreground">
              {hud.mensajes.map((m, i) => (
                <div key={i} className="rounded bg-black/50 px-2 py-1">
                  {m}
                </div>
              ))}
            </div>

            {hud.estado !== "jugando" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-black/80">
                <h2 className="text-4xl font-black">
                  {hud.estado === "ganado" ? "¡Sobreviviste!" : "Te atraparon"}
                </h2>
                <button
                  onClick={() => setFase("menu")}
                  className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Volver al menú
                </button>
              </div>
            )}
          </>
        )}

        <button
          onClick={() => setAjustes((v) => !v)}
          className="absolute bottom-4 right-4 rounded-lg border border-border bg-card/90 px-3 py-2 text-xs font-semibold backdrop-blur"
        >
          Ajustes
        </button>
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
            <button
              onClick={() => setFase("menu")}
              className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
            >
              Abandonar partida
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        WASD mover · Shift correr · Espacio habilidad · E recoger · 1/2 usar objeto · Esc cancelar
      </p>
    </main>
  );
}
