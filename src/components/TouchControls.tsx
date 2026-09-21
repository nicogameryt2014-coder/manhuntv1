import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, FlaskConical, Hand, Move, PackageOpen, RotateCcw, ShieldPlus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ItemKind } from "@/game/engine";

export type ControlId =
  | "palanca"
  | "correr"
  | "habilidad"
  | "habilidad2"
  | "recoger"
  | "cancelar"
  | "botiquin"
  | "cola"
  | "antidoto";

type Pos = { x: number; y: number }; // % del viewport (esquina superior izquierda del botón)

const STORAGE = "ultimo-turno-botones";

/** Posiciones por defecto en % de pantalla. */
export const POS_DEFECTO: Record<ControlId, Pos> = {
  palanca: { x: 4, y: 58 },
  correr: { x: 74, y: 84 },
  habilidad: { x: 74, y: 70 },
  habilidad2: { x: 74, y: 56 },
  recoger: { x: 60, y: 84 },
  cancelar: { x: 60, y: 70 },
  botiquin: { x: 46, y: 84 },
  cola: { x: 46, y: 70 },
  antidoto: { x: 46, y: 56 },
};

function leer(): Record<ControlId, Pos> {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return { ...POS_DEFECTO };
    const guardado = JSON.parse(raw) as Partial<Record<ControlId, Pos>>;
    return { ...POS_DEFECTO, ...guardado };
  } catch {
    return { ...POS_DEFECTO };
  }
}

type Props = {
  inventario: ItemKind[];
  nombreHabilidad2: string;
  palanca: Pos;
  iniciarPalanca: (ev: ReactPointerEvent<HTMLDivElement>) => void;
  moverPalanca: (ev: ReactPointerEvent<HTMLDivElement>) => void;
  soltarPalanca: () => void;
  pulsar: (accion: "habilidad" | "habilidad2" | "recoger" | "cancelar", item?: ItemKind) => void;
  correrDown: () => void;
  correrUp: () => void;
};

export function TouchControls(props: Props) {
  const [pos, setPos] = useState<Record<ControlId, Pos>>({ ...POS_DEFECTO });
  const [editando, setEditando] = useState(false);
  const [arrastrando, setArrastrando] = useState<ControlId | null>(null);

  useEffect(() => {
    setPos(leer());
  }, []);

  const guardar = useCallback((next: Record<ControlId, Pos>) => {
    setPos(next);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  const mover = (id: ControlId, ev: ReactPointerEvent<HTMLElement>) => {
    const x = (ev.clientX / window.innerWidth) * 100;
    const y = (ev.clientY / window.innerHeight) * 100;
    setPos((prev) => ({
      ...prev,
      [id]: { x: Math.max(0, Math.min(92, x - 4)), y: Math.max(0, Math.min(92, y - 4)) },
    }));
  };

  /** Envuelve cada control: en modo editor sólo se arrastra. */
  const caja = (id: ControlId, hijo: ReactNode) => (
    <div
      key={id}
      className={`pointer-events-auto fixed touch-none ${editando ? "z-50 rounded-xl ring-2 ring-primary ring-offset-1" : "z-40"}`}
      style={{ left: `${pos[id].x}%`, top: `${pos[id].y}%` }}
      onPointerDown={
        editando
          ? (ev) => {
              ev.preventDefault();
              ev.currentTarget.setPointerCapture(ev.pointerId);
              setArrastrando(id);
              mover(id, ev);
            }
          : undefined
      }
      onPointerMove={editando && arrastrando === id ? (ev) => mover(id, ev) : undefined}
      onPointerUp={
        editando
          ? () => {
              setArrastrando(null);
              guardar(pos);
            }
          : undefined
      }
    >
      <div className={editando ? "pointer-events-none opacity-80" : ""}>{hijo}</div>
    </div>
  );

  return (
    <>
      {caja(
        "palanca",
        <div
          role="application"
          aria-label="Palanca de movimiento"
          onPointerDown={editando ? undefined : props.iniciarPalanca}
          onPointerMove={
            editando
              ? undefined
              : (ev) => ev.currentTarget.hasPointerCapture(ev.pointerId) && props.moverPalanca(ev)
          }
          onPointerUp={editando ? undefined : props.soltarPalanca}
          onPointerCancel={editando ? undefined : props.soltarPalanca}
          className="relative size-32 touch-none rounded-full border border-border bg-card/70 shadow-lg backdrop-blur"
        >
          <div className="absolute inset-4 rounded-full border border-border/70" />
          <div
            className="absolute left-1/2 top-1/2 size-14 rounded-full border border-primary/60 bg-primary/25 shadow-md"
            style={{
              transform: `translate(calc(-50% + ${props.palanca.x * 36}px), calc(-50% + ${props.palanca.y * 36}px))`,
            }}
          />
        </div>,
      )}

      {caja(
        "botiquin",
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Usar botiquín"
          disabled={!props.inventario.includes("botiquin")}
          onPointerDown={() => props.pulsar("recoger", "botiquin")}
          className="size-14 touch-none rounded-full"
        ><ShieldPlus /></Button>,
      )}
      {caja(
        "cola",
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Usar cola"
          disabled={!props.inventario.includes("cola")}
          onPointerDown={() => props.pulsar("recoger", "cola")}
          className="size-14 touch-none rounded-full"
        ><Zap /></Button>,
      )}
      {caja(
        "antidoto",
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Usar antídoto"
          disabled={!props.inventario.includes("antidoto")}
          onPointerDown={() => props.pulsar("recoger", "antidoto")}
          className="size-14 touch-none rounded-full"
        ><FlaskConical /></Button>,
      )}
      {caja(
        "recoger",
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Recoger objeto"
          onPointerDown={() => props.pulsar("recoger")}
          className="size-14 touch-none rounded-full"
        ><PackageOpen /></Button>,
      )}
      {caja(
        "cancelar",
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Cancelar acción"
          onPointerDown={() => props.pulsar("cancelar")}
          className="size-14 touch-none rounded-full"
        ><X /></Button>,
      )}
      {caja(
        "correr",
        <Button
          type="button"
          variant="secondary"
          aria-label="Correr"
          onPointerDown={(ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId);
            props.correrDown();
          }}
          onPointerUp={props.correrUp}
          onPointerCancel={props.correrUp}
          className="h-12 touch-none rounded-full px-6"
        >Correr</Button>,
      )}
      {caja(
        "habilidad",
        <Button
          type="button"
          aria-label="Usar habilidad"
          onPointerDown={() => props.pulsar("habilidad")}
          className="h-12 touch-none rounded-full px-5"
        ><Hand /> Habilidad</Button>,
      )}
      {caja(
        "habilidad2",
        <Button
          type="button"
          variant="secondary"
          aria-label="Usar segunda habilidad"
          onPointerDown={() => props.pulsar("habilidad2")}
          className="h-12 touch-none rounded-full px-4 text-xs"
        ><Sparkles /> {props.nombreHabilidad2}</Button>,
      )}

      {/* Barra del editor */}
      <div className="pointer-events-auto fixed bottom-2 left-1/2 z-[60] flex -translate-x-1/2 gap-2">
        {editando ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => guardar({ ...POS_DEFECTO })}>
              <RotateCcw /> Reiniciar
            </Button>
            <Button type="button" size="sm" onClick={() => { guardar(pos); setEditando(false); }}>
              <Check /> Listo
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" className="opacity-70" onClick={() => setEditando(true)}>
            <Move /> Editar botones
          </Button>
        )}
      </div>
      {editando && (
        <p className="pointer-events-none fixed left-1/2 top-2 z-[60] -translate-x-1/2 rounded-md bg-card/90 px-3 py-1 text-xs text-muted-foreground">
          Arrastra cada botón donde quieras
        </p>
      )}
    </>
  );
}
