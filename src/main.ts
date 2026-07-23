import "./styles.css";
import { GameApp } from "./game/GameApp";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Game root element was not found.");
}

const game = new GameApp(root);
game.mount();

