import type { GameDoc, FrameEvents } from "../../../shared/types";
import { random, distance, normalize } from "../../../shared/math";
import { markCrossed, sweepThroughPortals } from "../../portals/lib/traverse";
import { grantExperience } from "./experience";
export function generateDrops(doc: GameDoc, events: FrameEvents): void {
  for (const { enemy } of events.kills) {
    doc.drops.push({
      id: doc.nextId++,
      x: enemy.x,
      y: enemy.y,
      kind: "xp",
      value: enemy.kind === "elite" ? 10 : enemy.kind === "shooter" ? 3 : 2,
      life: 45,
    });
    const roll = random(doc);
    if (roll < 0.055)
      doc.drops.push({
        id: doc.nextId++,
        x: enemy.x + 8,
        y: enemy.y,
        kind: "heal",
        value: 18,
        life: 20,
      });
    else if (roll < 0.07)
      doc.drops.push({
        id: doc.nextId++,
        x: enemy.x - 8,
        y: enemy.y,
        kind: "magnet",
        value: 1,
        life: 20,
      });
  }
}
export function collectDrops(
  doc: GameDoc,
  events: FrameEvents,
  dt: number,
): void {
  const radius = 65 + (doc.upgrades.magnet || 0) * 35;
  let magnet = false;
  for (const drop of doc.drops) {
    drop.life -= dt;
    if (drop.life < 0) continue;
    const range = distance(drop, doc.player);
    // A drop that just crossed keeps chasing briefly, so it exits the gate still moving.
    if (range < radius || (drop.portalLock || 0) > 0) {
      const toward = normalize(doc.player.x - drop.x, doc.player.y - drop.y),
        travel = Math.min(range, 360 * dt),
        previous = { x: drop.x, y: drop.y },
        target = {
          x: drop.x + toward.x * travel,
          y: drop.y + toward.y * travel,
        };
      // Only drops already being pulled cross; idle crystals stay where they fell.
      const path = sweepThroughPortals(
        doc,
        previous,
        target,
        4,
        (drop.portalLock || 0) > 0,
      );
      drop.x = path.position.x;
      drop.y = path.position.y;
      if (path.crossed) markCrossed(drop, doc);
    }
    if (distance(drop, doc.player) > doc.player.radius + 9) continue;
    drop.life = -1;
    events.collected++;
    if (drop.kind === "xp") grantExperience(doc, drop.value);
    if (drop.kind === "heal")
      doc.player.hp = Math.min(doc.player.maxHp, doc.player.hp + drop.value);
    if (drop.kind === "magnet") magnet = true;
  }
  if (magnet) {
    for (const drop of doc.drops) {
      if (drop.life >= 0 && drop.kind === "xp") {
        grantExperience(doc, drop.value);
        drop.life = -1;
        events.collected++;
      }
    }
  }
  doc.drops = doc.drops.filter((d) => d.life >= 0);
}
