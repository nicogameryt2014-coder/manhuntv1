import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/Game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Último Turno — juego de asesinos y sobrevivientes" },
      {
        name: "description",
        content:
          "Juego de supervivencia 2D: elige médico, atacante, asustadizo o mago y escapa del Venenoso y el Ninja durante 3 minutos.",
      },
      { property: "og:title", content: "Último Turno — asesinos vs sobrevivientes" },
      {
        property: "og:description",
        content:
          "Habilidades, objetos y persecución en un juego de supervivencia jugable en el navegador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});
