# Compatibilidad móvil para Último Turno

## Objetivo
Hacer que el menú y la partida se puedan usar cómodamente en teléfonos y tabletas sin cambiar las reglas actuales.

## Cambios
- Adaptar el menú a pantallas estrechas, con botones y selectores táctiles de tamaño cómodo.
- Ajustar el área de juego al alto y ancho disponibles, manteniendo la proporción del mapa.
- Añadir un joystick táctil para movimiento y botones separados para correr, habilidad, recoger, objetos y cancelar.
- Mantener los controles de teclado en computadoras.
- Reorganizar la información de vida, tiempo e inventario para que no tape los controles ni el juego.
- Evitar desplazamientos, zoom accidental y gestos del navegador mientras se juega.
- Probar el menú y una partida en tamaños de teléfono vertical y horizontal.

## Detalles técnicos
- Los controles táctiles alimentarán el mismo sistema de acciones que ya usa el teclado.
- El canvas conservará su resolución interna; solo cambiará su tamaño visible para preservar calidad y proporción.
- Los controles aparecerán únicamente en dispositivos táctiles o pantallas pequeñas.
