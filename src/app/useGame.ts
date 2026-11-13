import { useEffect, useRef, useState } from "react";
import { createRun } from "../shared/createRun";
import type { Input } from "../shared/types";
import { simulate } from "./simulate";
import { chooseUpgrade } from "../features/progression";
import {
  beginPortalDraft,
  cancelPortalDraft,
  closePortals,
} from "../features/portals";
import { loadRecords, saveRecords } from "../features/results";
export function useGame() {
  const game = useRef(createRun(204004, loadRecords()));
  const input = useRef<Input>({
    x: 0,
    y: 0,
    aim: { x: 500, y: 0 },
    firing: false,
    pointer: { x: 500, y: 325 },
  });
  const keys = useRef(new Set<string>());
  const [, render] = useState(0);
  useEffect(() => {
    let raf = 0,
      last = 0,
      acc = 0,
      paint = 0;
    const tick = (now: number) => {
      const elapsed = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      const d = game.current;
      input.current.x =
        Number(keys.current.has("d") || keys.current.has("arrowright")) -
        Number(keys.current.has("a") || keys.current.has("arrowleft"));
      input.current.y =
        Number(keys.current.has("s") || keys.current.has("arrowdown")) -
        Number(keys.current.has("w") || keys.current.has("arrowup"));
      if (d.phase === "playing") {
        acc += elapsed;
        while (acc >= 1 / 60) {
          simulate(d, input.current, 1 / 60);
          acc -= 1 / 60;
          if (d.phase !== "playing") {
            acc = 0;
            break;
          }
        }
      } else acc = 0;
      if (now - paint > 32) {
        render((n) => n + 1);
        paint = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const pause = () => {
      if (game.current.phase === "playing") game.current.phase = "paused";
      keys.current.clear();
      input.current.firing = false;
    };
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k))
        e.preventDefault();
      keys.current.add(k);
      if ((k === "escape" || k === "p") && !e.repeat) {
        const d = game.current;
        if (d.phase === "playing") d.phase = "paused";
        else if (d.phase === "paused") d.phase = "playing";
      }
      // Q toggles placement without spending a click on manual fire.
      if (k === "q" && !e.repeat) {
        const d = game.current;
        if (d.phase !== "playing") return;
        if (d.portalDraft) cancelPortalDraft(d);
        else beginPortalDraft(d, input.current.pointer);
      }
      // R closes the pair; upgrades and pause keep it, since time is frozen there.
      if (k === "r" && !e.repeat && game.current.phase === "playing")
        closePortals(game.current);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const hidden = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  return {
    game,
    input,
    start: () => {
      game.current.phase = "playing";
    },
    toggle: () => {
      const d = game.current;
      if (d.phase === "playing") d.phase = "paused";
      else if (d.phase === "paused") d.phase = "playing";
    },
    choose: (id: string) => chooseUpgrade(game.current, id),
    deployPortal: () => {
      const d = game.current;
      if (d.phase !== "playing") return;
      if (d.portalDraft) cancelPortalDraft(d);
      else beginPortalDraft(d, input.current.pointer);
    },
    closePortal: () => closePortals(game.current),
    restart: () => {
      saveRecords(game.current.records);
      game.current = createRun(204004, game.current.records);
      keys.current.clear();
      input.current.firing = false;
      game.current.phase = "playing";
    },
  };
}
