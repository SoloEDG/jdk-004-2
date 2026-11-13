import type { GameDoc, Portal, Vec } from "../../../shared/types";
import { distance, normalize } from "../../../shared/math";

/** Seconds an entity stays inert after emerging from a portal. */
export const PORTAL_LOCK = 0.45;
/** Gate trigger radius. */
export const PORTAL_RADIUS = 26;

export interface PathSegment {
  from: Vec;
  to: Vec;
}
export interface Traversal {
  crossed: boolean;
  position: Vec;
  /** The real trajectory: a fast body can jump, but collisions follow these segments. */
  segments: PathSegment[];
  /** Heading taken on exit; retained by already-crossed projectiles if the gates close. */
  outDirection?: Vec;
}

const copy = (p: Vec): Vec => ({ x: p.x, y: p.y });
const ZERO = 1e-6;

/** Unit axis from entry to exit. Both gates share it, so exits stay consistent. */
export function portalAxis(doc: GameDoc): Vec | undefined {
  if (!doc.portals) return undefined;
  const { entry, exit } = doc.portals;
  const dx = exit.x - entry.x,
    dy = exit.y - entry.y,
    n = Math.hypot(dx, dy);
  return n > ZERO ? { x: dx / n, y: dy / n } : undefined;
}

/** First time the swept body enters a gate disc, ignoring gates it already overlaps. */
function crossingTime(from: Vec, dx: number, dy: number, gate: Portal, reach: number): number {
  // Starting inside a gate must first walk out, otherwise a body would bounce forever.
  if (distance(from, gate) <= reach) return Infinity;
  const fx = from.x - gate.x,
    fy = from.y - gate.y,
    lengthSquared = dx * dx + dy * dy,
    b = 2 * (fx * dx + fy * dy),
    c = fx * fx + fy * fy - reach * reach,
    discriminant = b * b - 4 * lengthSquared * c;
  if (lengthSquared === 0 || discriminant <= 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / (2 * lengthSquared);
  return t > 0 && t < 1 ? t : Infinity;
}

/**
 * Sweeps a moving circle from `from` to `to` through the bidirectional pair.
 * Crossing either gate places the body just outside the other, heading away
 * from the pair, and expands the leftover travel at its original speed. The
 * returned segments are the only places where collision may be reported.
 */
export function sweepThroughPortals(
  doc: GameDoc,
  from: Vec,
  to: Vec,
  radius: number,
  locked: boolean,
): Traversal {
  const plain: Traversal = {
    crossed: false,
    position: copy(to),
    segments: [{ from: copy(from), to: copy(to) }],
  };
  const portals = doc.portals;
  if (!portals || locked) return plain;
  const reach = portals.entry.radius + radius * 0.5;
  const dx = to.x - from.x,
    dy = to.y - from.y;
  if (dx * dx + dy * dy === 0) return plain;
  const tEntry = crossingTime(from, dx, dy, portals.entry, reach),
    tExit = crossingTime(from, dx, dy, portals.exit, reach);
  if (!Number.isFinite(tEntry) && !Number.isFinite(tExit)) return plain;
  const enteredEntry = tEntry <= tExit;
  const t = enteredEntry ? tEntry : tExit;
  const source = enteredEntry ? portals.entry : portals.exit,
    destination = enteredEntry ? portals.exit : portals.entry,
    axis = portalAxis(doc) ?? normalize(dx, dy),
    // Entering the entry gate exits along the pair axis; entering the exit gate mirrors it.
    outDirection = enteredEntry ? axis : { x: -axis.x, y: -axis.y };
  const hit = { x: from.x + dx * t, y: from.y + dy * t };
  let exitFrom = {
    x: destination.x + outDirection.x * (destination.radius + radius + 2),
    y: destination.y + outDirection.y * (destination.radius + radius + 2),
  };
  // Overlapping gates would loop; step clear of both discs before continuing.
  for (
    let guard = 0;
    guard < 16 &&
    (distance(exitFrom, portals.entry) <= reach ||
      distance(exitFrom, portals.exit) <= reach);
    guard++
  ) {
    exitFrom = {
      x: exitFrom.x + outDirection.x * 8,
      y: exitFrom.y + outDirection.y * 8,
    };
  }
  const remaining = (1 - t) * Math.hypot(dx, dy);
  const position = {
    x: exitFrom.x + outDirection.x * remaining,
    y: exitFrom.y + outDirection.y * remaining,
  };
  return {
    crossed: true,
    position,
    segments: [
      { from: copy(from), to: hit },
      { from: copy(exitFrom), to: copy(position) },
    ],
    outDirection,
  };
}

/**
 * Enemies choose the cheaper route to the player: direct flight or the entry
 * gate. This makes teleported targets genuinely reachable instead of ignored.
 */
export function portalRoute(
  doc: GameDoc,
  from: Vec,
  locked: boolean,
): { target: Vec; distance: number; viaPortal: boolean } {
  const direct = distance(from, doc.player);
  const portals = doc.portals;
  if (!portals || locked)
    return { target: doc.player, distance: direct, viaPortal: false };
  const toEntry = distance(from, portals.entry),
    fromExit = distance(portals.exit, doc.player),
    viaPortal = toEntry + fromExit;
  if (viaPortal < direct - 1)
    return { target: portals.entry, distance: viaPortal, viaPortal: true };
  return { target: doc.player, distance: direct, viaPortal: false };
}

/** Marks a body as freshly emerged: no re-entry, no rerouting for a moment. */
export function markCrossed(
  body: { portalLock?: number },
  doc: GameDoc,
): void {
  body.portalLock = PORTAL_LOCK;
  if (!doc.portals) return;
  doc.portals.entry.flash = 1;
  doc.portals.exit.flash = 1;
}
