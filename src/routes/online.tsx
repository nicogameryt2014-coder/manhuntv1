import { createFileRoute } from "@tanstack/react-router";
import { Online } from "@/components/Online";

export const Route = createFileRoute("/online")({
  head: () => ({
    meta: [
      { title: "Salas públicas · Último Turno" },
      {
        name: "description",
        content:
          "Juega Último Turno en línea: crea o entra a salas públicas y sobrevive junto a otros jugadores.",
      },
      { property: "og:title", content: "Salas públicas · Último Turno" },
      {
        property: "og:description",
        content: "Crea o entra a salas públicas y sobrevive a los asesinos junto a otros jugadores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Online,
});
