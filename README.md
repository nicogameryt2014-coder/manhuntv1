# Remix of Hunter & Hunted

crea un juego de supervivencia donde hay asesinos y sobrevivientes. dales habilidades a los asesinos y sobrevivientes: sobrevivientes: a cada sobreviviente se le asigna 1 habilidad. las habilidades son 4 para sobrevivientes y 2 para asesinos:

medico: cooldown de 15 segundos. le da un gorro blanco con una + verde en el gorro, lanza un liquido de color verde pastel que se mantiene en el suelo por 3 segundos. cada segundo en el charco te cura +3 hp. si el medico tiene >40 hp el charco en vez de curar +3 hp cura el doble

atacante: cooldown de 35 segundos, le da una bandana de color negro, da un golpe hacia la direccion que estaba caminando (para poder ver el hitbox, añade una opcion debug en ajustes que te permite ver la hitbox), aturde al asesino/s por 5 segundos y da un boost de velocidad 1.5x al atacante por 2 segundos

asustadizo: no da ningun accesorio. cooldown de 30 segundos. al activarse da un boost de velocidad x3 por 10 segundos. cuando se termina el efecto el jugador se ralentiza por 4 segundos. y despues vuelve a la normalidad

mago: da un gorro de mago. da un escudo de 25 hp que dura 5 segundos al sobreviviente mas cercano. mientras el escudo siga vigente el mago se ralentiza un 0.2x de velocidad y ya no puede correr. si el escudo sige vigente la accion puede ser cancelado en cualquier momento. si es cancelado al cooldown original dale 10 segundos mas de cooldown

asesinos:

correr: a todos los asesinos se les da la habilidad de correr. pero corren un 0.5x mas lento que los sobrevivientes

venenoso: efecto de burbujas purpuras. cooldown de 45 segundos. al golpear da un veneno de 6 segundos que quita 0.5 hp cada segundo

ninja: da un gorro de ninja. cooldown de 20 segundos. al ser activado lanza 3 cuchillos en 3 diferentes angulos hacia donde estaba caminando. los cuchillos pueden chocar con paredes. si un cuchillo toca a un sobreviviente le quita 25 hp

objetos en el mapa (solo sobrevivientes)

botiquin. tarda 5 segundos en ser usado y puede ser cancelado en cualquier momento. cura 35 hp

cola: da un boost de 1.5x velocidad por 10 segundos. tarda 2 segundos en ser usado y puede ser cancelado en cualquier momento.

los objetos en el mapa son recolectables y se guarda  en tu inventario. solo uno de cada uno a la vez

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://manhuntv1.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b33e1383-32ba-41ea-a878-2d4af95c29d1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
