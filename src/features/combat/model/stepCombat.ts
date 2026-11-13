import type { GameDoc, Input, FrameEvents } from "../../../shared/types";
import { WIDTH, HEIGHT } from "../../../shared/types";
import { clamp, distance, normalize } from "../../../shared/math";
import { segmentDistance } from "../lib/collision";
import { hurtPlayer } from "./health";
import {
  markCrossed,
  sweepThroughPortals,
} from "../../portals/lib/traverse";
export function stepCombat(
  doc: GameDoc,
  input: Input,
  dt: number,
): FrameEvents {
  const events: FrameEvents = {
    kills: [],
    damage: 0,
    taken: 0,
    shots: 0,
    collected: 0,
    weaponDamage: {},
  };
  const player = doc.player;
  player.invincible = Math.max(0, player.invincible - dt);
  const direction = normalize(input.x, input.y),
    strength = Math.min(1, Math.hypot(input.x, input.y));
  const playerTarget = {
    x: clamp(
      player.x + direction.x * strength * player.speed * dt,
      player.radius,
      WIDTH - player.radius,
    ),
    y: clamp(
      player.y + direction.y * strength * player.speed * dt,
      player.radius,
      HEIGHT - player.radius,
    ),
  };
  const route = sweepThroughPortals(
    doc,
    player,
    playerTarget,
    player.radius,
    (player.portalLock || 0) > 0,
  );
  player.x = clamp(route.position.x, player.radius, WIDTH - player.radius);
  player.y = clamp(route.position.y, player.radius, HEIGHT - player.radius);
  if (route.crossed) markCrossed(player, doc);
  for (const bullet of doc.bullets) {
    const previous = { x: bullet.x, y: bullet.y };
    const speed = Math.hypot(bullet.vx, bullet.vy),
      target = {
        x: bullet.x + bullet.vx * dt,
        y: bullet.y + bullet.vy * dt,
      };
    const path = sweepThroughPortals(
      doc,
      previous,
      target,
      bullet.radius,
      (bullet.portalLock || 0) > 0,
    );
    bullet.x = path.position.x;
    bullet.y = path.position.y;
    // A crossed projectile leaves along the gate axis at its original speed.
    if (path.crossed && path.outDirection) {
      bullet.vx = path.outDirection.x * speed;
      bullet.vy = path.outDirection.y * speed;
      markCrossed(bullet, doc);
    }
    bullet.life -= dt;
    if (bullet.life < 0) continue;
    if (bullet.owner === "enemy") {
      // Every path segment can hurt: dodging via the portal really moves the hitbox.
      for (const segment of path.segments) {
        if (
          segmentDistance(
            player,
            segment.from,
            segment.to,
          ) <
          player.radius + bullet.radius
        ) {
          events.taken += hurtPlayer(doc, bullet.damage);
          bullet.life = -1;
          break;
        }
      }
      continue;
    }
    for (const enemy of doc.enemies) {
      if (enemy.hp <= 0 || bullet.hit.includes(enemy.id)) continue;
      const struck = path.segments.some(
        (segment) =>
          segmentDistance(enemy, segment.from, segment.to) <=
          enemy.radius + bullet.radius,
      );
      if (!struck) continue;
      bullet.hit.push(enemy.id);
      const damage = Math.min(enemy.hp, bullet.damage);
      enemy.hp -= damage;
      events.damage += damage;
      if (bullet.weapon !== "enemy")
        events.weaponDamage![bullet.weapon] =
          (events.weaponDamage![bullet.weapon] || 0) + damage;
      if (enemy.hp <= 0)
        events.kills.push({
          enemy: { ...enemy },
          weapon: bullet.weapon === "enemy" ? "pulse" : bullet.weapon,
        });
      if (bullet.pierce <= 0) {
        bullet.life = -1;
        break;
      }
      bullet.pierce--;
    }
  }
  for (const enemy of doc.enemies) {
    if (enemy.hp > 0 && distance(enemy, player) < enemy.radius + player.radius)
      events.taken += hurtPlayer(doc, enemy.kind === "elite" ? 25 : 12);
  }
  doc.enemies = doc.enemies.filter((e) => e.hp > 0);
  doc.bullets = doc.bullets.filter(
    (b) =>
      b.life >= 0 &&
      b.x > -120 &&
      b.x < WIDTH + 120 &&
      b.y > -120 &&
      b.y < HEIGHT + 120,
  );
  return events;
}
