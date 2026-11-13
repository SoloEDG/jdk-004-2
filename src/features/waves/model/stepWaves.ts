import type { GameDoc } from "../../../shared/types";
import { distance, normalize } from "../../../shared/math";
import { spawnEnemy } from "../lib/spawn";
import {
  markCrossed,
  portalRoute,
  sweepThroughPortals,
} from "../../portals/lib/traverse";
import { ENEMY_CATALOG, WAVE_DURATION, TOTAL_WAVES } from "./catalog";
export function stepWaves(doc: GameDoc, dt: number): void {
  if (doc.victory) return;
  if (doc.wave === 0) {
    doc.wave = 1;
    doc.spawnBudget = 1;
    doc.notice = "第 1 波 · 信号已连接";
  }
  doc.waveTime += dt;
  while (doc.waveTime >= WAVE_DURATION) {
    doc.waveTime -= WAVE_DURATION;
    if (doc.wave >= TOTAL_WAVES) {
      doc.victory = true;
      doc.notice = "全部波次已清除";
      return;
    }
    doc.wave++;
    doc.notice = `第 ${doc.wave} 波 · 威胁升级`;
  }
  doc.spawnBudget += dt * (1.05 + doc.wave * 0.27);
  while (doc.spawnBudget >= 1) {
    doc.spawnBudget--;
    if (doc.enemies.length < 180) doc.enemies.push(spawnEnemy(doc));
  }
  for (const enemy of doc.enemies) {
    // Chasing the player means chasing the cheaper of a direct line or the portal shortcut.
    const route = portalRoute(doc, enemy, (enemy.portalLock || 0) > 0),
      toward = normalize(route.target.x - enemy.x, route.target.y - enemy.y),
      // Shots still aim at the player; only movement takes the portal detour.
      aimAt = normalize(doc.player.x - enemy.x, doc.player.y - enemy.y),
      range = distance(enemy, doc.player);
    const standOff =
      enemy.kind === "shooter" && !route.viaPortal
        ? range < 170
          ? -1
          : range < 245
            ? 0
            : 1
        : 1;
    const speed = ENEMY_CATALOG[enemy.kind].speed * (1 + doc.wave * 0.035);
    const previous = { x: enemy.x, y: enemy.y };
    const target = {
      x: enemy.x + toward.x * speed * standOff * dt,
      y: enemy.y + toward.y * speed * standOff * dt,
    };
    const path = sweepThroughPortals(
      doc,
      previous,
      target,
      enemy.radius,
      (enemy.portalLock || 0) > 0,
    );
    enemy.x = path.position.x;
    enemy.y = path.position.y;
    if (path.crossed) markCrossed(enemy, doc);
    enemy.cooldown -= dt;
    if (enemy.kind !== "chaser" && enemy.cooldown <= 0) {
      enemy.cooldown = enemy.kind === "elite" ? 1.8 : 2.6;
      const angle = Math.atan2(aimAt.y, aimAt.x),
        spread = enemy.kind === "elite" ? [-0.24, 0, 0.24] : [0];
      for (const offset of spread) {
        doc.bullets.push({
          id: doc.nextId++,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle + offset) * 160,
          vy: Math.sin(angle + offset) * 160,
          radius: 5,
          damage: enemy.kind === "elite" ? 16 : 10,
          life: 5,
          owner: "enemy",
          weapon: "enemy",
          pierce: 0,
          hit: [],
        });
      }
    }
  }
}
