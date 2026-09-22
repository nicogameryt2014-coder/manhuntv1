import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  crearJuego,
  step,
  type Entity,
  type GameState,
  type Input,
  type ItemKind,
  type ModoMuerte,
  type SurvivorAbility,
} from "@/game/engine";
import { render } from "@/game/render";

type Sala = {
  id: string;
  nombre: string;
  host: string;
  modo: string;
  asesinos: number;
  jugadores: number;
  maximo: number;
  estado: string;
};

const VW = 960;
const VH = 620;
const CLIENTE_KEY = "ultimo-turno-cliente";
const HABILIDADES: SurvivorAbility[] = ["medico", "atacante", "asustadizo", "mago"];

function idCliente() {
  try {
    const guardado = localStorage.getItem(CLIENTE_KEY);
    if (guardado) return guardado;
    const nuevo = crypto.randomUUID();
    localStorage.setItem(CLIENTE_KEY, nuevo);
    return nuevo;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function inputVacio(): Input {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    usarHabilidad: false,
    usarHabilidad2: false,
    recoger: false,
    usarItem: null,
    cancelar: false,
  };
}

/** Copia ligera del estado para enviar por la red (sin muros ni rutas). */
function comprimir(st: GameState) {
  return {
    t: st.t,
    fase: st.fase,
    estado: st.estado,
    tiempoRestante: st.tiempoRestante,
    tiempoEscape: st.tiempoEscape,
    escapados: st.escapados,
    salida: st.salida,
    pickups: st.pickups,
    puddles: st.puddles,
    swings: st.swings,
    knives: st.knives,
    bubbles: st.bubbles,
    sangre: st.sangre.slice(-160),
    mensajes: st.mensajes,
    espectando: st.espectando,
    entities: st.entities.map((e) => ({ ...e, camino: [], caminoIdx: 0 })),
  };
}

export function Online() {
  const [fase, setFase] = useState<"lobby" | "jugando">("lobby");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [nombre, setNombre] = useState("Sala de " + Math.floor(Math.random() * 900 + 100));
  const [asesinos, setAsesinos] = useState(2);
  const [modo, setModo] = useState<ModoMuerte>("sufrimiento");
  const [aviso, setAviso] = useState("Elige una sala pública o crea la tuya.");
  const [esHost, setEsHost] = useState(false);

  const cliente = useRef(idCliente());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const salaRef = useRef<Sala | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const pulsos = useRef({ habilidad: false, habilidad2: false, recoger: false, cancelar: false });
  const remotos = useRef<Record<number, Input>>({});
  const slots = useRef<Record<string, number>>({});
  const miEntidad = useRef<number | null>(null);

  // lista de salas en vivo
  useEffect(() => {
    if (fase !== "lobby") return;
    const cargar = async () => {
      const { data } = await supabase
        .from("salas")
        .select("*")
        .eq("estado", "abierta")
        .order("created_at", { ascending: false })
        .limit(30);
      setSalas((data ?? []) as Sala[]);
    };
    cargar();
    const canal = supabase
      .channel("lista-salas")
      .on("postgres_changes", { event: "*", schema: "public", table: "salas" }, () => cargar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [fase]);

  // teclado
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      keys.current[k] = true;
      if (k === " ") pulsos.current.habilidad = true;
      if (k === "q") pulsos.current.habilidad2 = true;
      if (k === "e") pulsos.current.recoger = true;
      if (k === "escape") pulsos.current.cancelar = true;
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) ev.preventDefault();
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

  const leerInput = useCallback((): Input => {
    const k = keys.current;
    const inp: Input = {
      up: !!(k["w"] || k["arrowup"]),
      down: !!(k["s"] || k["arrowdown"]),
      left: !!(k["a"] || k["arrowleft"]),
      right: !!(k["d"] || k["arrowright"]),
      run: !!k["shift"],
      usarHabilidad: pulsos.current.habilidad,
      usarHabilidad2: pulsos.current.habilidad2,
      recoger: pulsos.current.recoger,
      usarItem: k["1"] ? "botiquin" : k["2"] ? "cola" : k["3"] ? ("antidoto" as ItemKind) : null,
      cancelar: pulsos.current.cancelar,
    };
    pulsos.current = { habilidad: false, habilidad2: false, recoger: false, cancelar: false };
    return inp;
  }, []);

  const salir = useCallback(async () => {
    const canal = canalRef.current;
    if (canal) supabase.removeChannel(canal);
    canalRef.current = null;
    const sala = salaRef.current;
    if (sala && sala.host === cliente.current) await supabase.from("salas").delete().eq("id", sala.id);
    salaRef.current = null;
    stateRef.current = null;
    miEntidad.current = null;
    remotos.current = {};
    slots.current = {};
    setEsHost(false);
    setFase("lobby");
  }, []);

  /** Entra al canal de la sala, ya sea como anfitrión o como invitado. */
  const conectar = useCallback(
    (sala: Sala, host: boolean) => {
      salaRef.current = sala;
      setEsHost(host);
      const canal = supabase.channel(`sala-${sala.id}`, { config: { broadcast: { self: false } } });
      canalRef.current = canal;

      if (host) {
        const st = crearJuego({
          habilidad: "medico",
          sobrevivientes: sala.maximo,
          asesinos: sala.asesinos,
          duracion: 180,
          modo: sala.modo as ModoMuerte,
        });
        stateRef.current = st;
        canal.on("broadcast", { event: "hola" }, ({ payload }) => {
          const quien = payload.cliente as string;
          const juego = stateRef.current;
          if (!juego) return;
          let entidad = slots.current[quien];
          if (entidad === undefined) {
            const libre = juego.entities.find(
              (e) =>
                e.team === "survivor" &&
                !e.isPlayer &&
                !Object.values(slots.current).includes(e.id),
            );
            if (!libre) return;
            slots.current[quien] = libre.id;
            entidad = libre.id;
            remotos.current[entidad] = inputVacio();
            supabase
              .from("salas")
              .update({ jugadores: 1 + Object.keys(slots.current).length, latido: new Date().toISOString() })
              .eq("id", sala.id);
          }
          canal.send({
            type: "broadcast",
            event: "slot",
            payload: { cliente: quien, entidad, walls: juego.walls, modo: sala.modo },
          });
        });
        canal.on("broadcast", { event: "input" }, ({ payload }) => {
          const entidad = slots.current[payload.cliente as string];
          if (entidad !== undefined) remotos.current[entidad] = payload.input as Input;
        });
      } else {
        canal.on("broadcast", { event: "slot" }, ({ payload }) => {
          if (payload.cliente !== cliente.current) return;
          miEntidad.current = payload.entidad as number;
          const base = stateRef.current;
          if (base) base.walls = payload.walls;
          else
            stateRef.current = {
              walls: payload.walls,
              entities: [],
              sangre: [],
              puddles: [],
              pickups: [],
              swings: [],
              knives: [],
              bubbles: [],
              mensajes: [],
              muertes: [],
              golpes: [],
            } as unknown as GameState;
        });
        canal.on("broadcast", { event: "snap" }, ({ payload }) => {
          const prev = stateRef.current;
          if (!prev) return;
          const snap = payload as ReturnType<typeof comprimir>;
          const mio = miEntidad.current;
          const entities = (snap.entities as Entity[]).map((e) => ({
            ...e,
            isPlayer: e.id === mio,
          }));
          stateRef.current = {
            ...prev,
            ...snap,
            entities,
            walls: prev.walls,
            muertes: [],
            golpes: [],
          } as unknown as GameState;
        });
      }

      canal.subscribe((estado) => {
        if (estado !== "SUBSCRIBED") return;
        if (!host) {
          canal.send({ type: "broadcast", event: "hola", payload: { cliente: cliente.current } });
          setAviso("Conectado. Esperando al anfitrión…");
        } else {
          setAviso("Sala abierta. Otros jugadores ya pueden entrar.");
        }
      });
      setFase("jugando");
    },
    [],
  );

  const crearSala = useCallback(async () => {
    const { data, error } = await supabase
      .from("salas")
      .insert({
        nombre,
        host: cliente.current,
        modo,
        asesinos,
        maximo: 6,
        jugadores: 1,
        estado: "abierta",
      })
      .select()
      .single();
    if (error || !data) {
      setAviso("No se pudo crear la sala, inténtalo otra vez.");
      return;
    }
    conectar(data as Sala, true);
  }, [nombre, modo, asesinos, conectar]);

  // bucle de juego / dibujo
  useEffect(() => {
    if (fase !== "jugando") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let ultimo = performance.now();
    let acumulado = 0;
    let reintento = 0;
    const loop = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - ultimo) / 1000);
      ultimo = ahora;
      const st = stateRef.current;
      const canal = canalRef.current;
      if (st && canal) {
        if (esHost) {
          step(st, dt, leerInput(), remotos.current);
          acumulado += dt;
          if (acumulado > 0.06) {
            acumulado = 0;
            canal.send({ type: "broadcast", event: "snap", payload: comprimir(st) });
          }
          if (st.entities.length) render(ctx, st, VW, VH, false);
        } else {
          acumulado += dt;
          if (acumulado > 0.05) {
            acumulado = 0;
            canal.send({
              type: "broadcast",
              event: "input",
              payload: { cliente: cliente.current, input: leerInput() },
            });
          }
          if (st.entities.length && miEntidad.current !== null) render(ctx, st, VW, VH, false);
        }
      } else if (!esHost && canal) {
        reintento += dt;
        if (reintento > 2) {
          reintento = 0;
          canal.send({ type: "broadcast", event: "hola", payload: { cliente: cliente.current } });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fase, esHost, leerInput]);

  if (fase === "lobby") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-black">Salas públicas</h1>
        <p className="mt-2 text-sm text-muted-foreground">{aviso}</p>

        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Crear sala</h2>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={40}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            aria-label="Nombre de la sala"
          />
          <div className="mt-3 flex items-center gap-3 text-xs">
            <label className="flex items-center gap-2">
              Asesinos
              <input
                type="number"
                min={1}
                max={6}
                value={asesinos}
                onChange={(e) => setAsesinos(Math.max(1, Math.min(6, Number(e.target.value))))}
                className="w-16 rounded-md border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              Modo
              <select
                value={modo}
                onChange={(e) => setModo(e.target.value as ModoMuerte)}
                className="rounded-md border border-border bg-background px-2 py-1"
              >
                <option value="instantanea">Muerte instantánea</option>
                <option value="sufrimiento">Sufrimiento</option>
              </select>
            </label>
          </div>
          <Button className="mt-4 w-full" onClick={crearSala}>
            Abrir sala pública
          </Button>
        </div>

        <div className="mt-6 space-y-2">
          {salas.length === 0 && (
            <p className="text-xs text-muted-foreground">Todavía no hay salas abiertas.</p>
          )}
          {salas.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <div>
                <div className="text-sm font-semibold">{s.nombre}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {s.jugadores}/{s.maximo} jugadores · {s.asesinos} asesinos ·{" "}
                  {s.modo === "sufrimiento" ? "sufrimiento" : "muerte instantánea"}
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => conectar(s, s.host === cliente.current)}>
                Entrar
              </Button>
            </div>
          ))}
        </div>

        <Link to="/" className="mt-8 inline-block text-xs text-muted-foreground underline">
          Volver al juego con bots
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[1000px] flex-col items-center px-2 py-4">
      <div className="mb-2 flex w-full items-center justify-between">
        <p className="font-mono text-xs text-muted-foreground">
          {esHost ? "Anfitrión" : "Invitado"} · {salaRef.current?.nombre} ·{" "}
          {HABILIDADES.length > 0 ? "Mover WASD · Correr Shift · Habilidades Espacio/Q" : ""}
        </p>
        <Button size="sm" variant="outline" onClick={salir}>
          Salir
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={VW}
        height={VH}
        className="w-full rounded-xl border border-border bg-background"
      />
      <p className="mt-2 text-xs text-muted-foreground">{aviso}</p>
    </main>
  );
}
