import type { GameDoc, Portal, PortalDraft, Vec } from "../../../shared/types";
import { WIDTH, HEIGHT } from "../../../shared/types";
import { distance } from "../../../shared/math";
import { PORTAL_LOCK, PORTAL_RADIUS } from "../lib/traverse";

export { PORTAL_LOCK, PORTAL_RADIUS };

/** A deployed pair lasts this many seconds of battle time. */
export const PORTAL_LIFE = 24;
/** Both gates must sit this far inside the wall so emerged bodies never spill off-field. */
export const PORTAL_EDGE = PORTAL_RADIUS + 64;
/** Minimum gap between the two gates; overlapping gates would loop forever. */
export const PORTAL_SEPARATION = PORTAL_RADIUS * 2 + 34;

export type PlacementCheck = { ok: true } | { ok: false; reason: string };

const insideField = (point: Vec) =>
  point.x >= PORTAL_EDGE &&
  point.x <= WIDTH - PORTAL_EDGE &&
  point.y >= PORTAL_EDGE &&
  point.y <= HEIGHT - PORTAL_EDGE;

export function checkPlacement(
  doc: GameDoc,
  stage: PortalDraft["stage"],
  point: Vec,
): PlacementCheck {
  if (!insideField(point))
    return {
      ok: false,
      reason:
        stage === "entry"
          ? "入口过于靠近边界 · 请向内放置"
          : doc.portals
            ? "出口过于靠近边界 · 已保留原传送门"
            : "出口过于靠近边界 · 请向内放置",
    };
  if (stage === "exit" && doc.portalDraft) {
    if (distance(point, doc.portalDraft.entry) < PORTAL_SEPARATION)
      return {
        ok: false,
        reason: doc.portals
          ? "入口与出口重叠 · 已保留原传送门"
          : "入口与出口重叠 · 请拉开距离",
      };
  }
  return { ok: true };
}

function gate(point: Vec): Portal {
  return {
    x: point.x,
    y: point.y,
    radius: PORTAL_RADIUS,
    life: PORTAL_LIFE,
    flash: 0,
  };
}

/** Enter placement mode. An existing pair keeps working until a new exit is confirmed. */
export function beginPortalDraft(
  doc: GameDoc,
  pointer?: Vec,
): boolean {
  if (doc.phase !== "playing") return false;
  if (doc.portalDraft) {
    doc.portalDraft = null;
    doc.portalMessage = "部署已取消";
    return false;
  }
  const start = pointer ?? doc.player;
  doc.portalDraft = {
    stage: "entry",
    entry: { x: start.x, y: start.y },
    pointer: { x: start.x, y: start.y },
  };
  doc.portalMessage = "部署传送门 · 点击选择入口";
  return true;
}

export function cancelPortalDraft(doc: GameDoc): void {
  if (!doc.portalDraft) return;
  doc.portalDraft = null;
  doc.portalMessage = "部署已取消";
}

/**
 * Click-to-place. The first click records the entry, the second validates and
 * commits the exit. A rejected exit leaves both the draft and any old pair intact.
 */
export function placePortal(doc: GameDoc, point: Vec): boolean {
  if (doc.phase !== "playing" || !doc.portalDraft) return false;
  const draft = doc.portalDraft;
  const check = checkPlacement(doc, draft.stage, point);
  if (!check.ok) {
    doc.portalMessage = check.reason;
    return false;
  }
  if (draft.stage === "entry") {
    draft.entry = { x: point.x, y: point.y };
    draft.stage = "exit";
    draft.pointer = { x: point.x, y: point.y };
    doc.portalMessage = "入口已标记 · 点击选择出口";
    return true;
  }
  doc.portals = { entry: gate(draft.entry), exit: gate(point) };
  doc.portalDraft = null;
  doc.portalMessage = `传送门已连接 · 寿命 ${PORTAL_LIFE}s`;
  return true;
}

export function closePortals(doc: GameDoc): void {
  if (!doc.portals) return;
  doc.portals = null;
  doc.portalDraft = null;
  // Crossed projectiles keep the velocity they gained; everyone else keeps their own path.
  doc.portalMessage = "传送门已关闭 · 已穿越弹丸保留出口方向";
}

/** Battle-time step: lifetimes, gate pulses, anti-reentry windows and attraction timers. */
export function stepPortals(doc: GameDoc, dt: number): void {
  const portals = doc.portals;
  if (portals) {
    portals.entry.life -= dt;
    portals.exit.life -= dt;
    portals.entry.flash = Math.max(0, portals.entry.flash - dt);
    portals.exit.flash = Math.max(0, portals.exit.flash - dt);
    if (portals.entry.life <= 0) {
      doc.portals = null;
      doc.portalMessage = "传送门寿命耗尽 · 实体沿原路线继续";
    }
  }
  if (doc.player.portalLock)
    doc.player.portalLock = Math.max(0, doc.player.portalLock - dt);
  for (const enemy of doc.enemies)
    if (enemy.portalLock)
      enemy.portalLock = Math.max(0, enemy.portalLock - dt);
  for (const bullet of doc.bullets)
    if (bullet.portalLock)
      bullet.portalLock = Math.max(0, bullet.portalLock - dt);
  for (const drop of doc.drops)
    if (drop.portalLock)
      drop.portalLock = Math.max(0, drop.portalLock - dt);
}
