import type { GameDoc, Portal } from "../../../shared/types";
import { WIDTH, HEIGHT } from "../../../shared/types";
import { PORTAL_LIFE, PORTAL_RADIUS } from "../../portals/model/stepPortals";
import { checkPlacement } from "../../portals/model/stepPortals";
import { PORTAL_LOCK } from "../../portals/lib/traverse";

/** Keeps placement copy on-screen even near the right edge. */
function placementLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  point: { x: number; y: number },
) {
  ctx.font = "10px monospace";
  const width = ctx.measureText(text).width;
  const x = point.x + 14 + width > WIDTH - 8 ? point.x - 14 - width : point.x + 14;
  const y = point.y - 14 < 14 ? point.y + PORTAL_RADIUS + 18 : point.y - 14;
  ctx.fillText(text, x, y);
}

/** Dashed link plus two gates; also shows the pending placement preview. */
function renderPortals(ctx: CanvasRenderingContext2D, d: GameDoc) {
  const pair = d.portals;
  if (pair) {
    const { entry, exit } = pair;
    const pulse = 0.55 + Math.max(entry.flash, exit.flash) * 0.45;
    ctx.save();
    ctx.strokeStyle = "#7de9ff";
    ctx.globalAlpha = 0.3 * pulse;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([10, 9]);
    ctx.lineDashOffset = -d.time * 26;
    ctx.beginPath();
    ctx.moveTo(entry.x, entry.y);
    ctx.lineTo(exit.x, exit.y);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [gate, label] of [
      [entry, "A"],
      [exit, "B"],
    ] as [Portal, string][]) {
      const life = Math.max(0, Math.min(1, gate.life / PORTAL_LIFE));
      ctx.globalAlpha = 0.22 + gate.flash * 0.45;
      ctx.fillStyle = "#2ad2ff";
      ctx.beginPath();
      ctx.arc(gate.x, gate.y, gate.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = label === "A" ? "#8ff1ff" : "#c3a7ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gate.x, gate.y, gate.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(
        gate.x,
        gate.y,
        gate.radius * (0.55 + 0.25 * Math.sin(d.time * 6 + gate.x)),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      // Lifetime ring: shrinks as the gate ages.
      ctx.strokeStyle = "#d9fbff";
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        gate.x,
        gate.y,
        gate.radius + 5,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * life,
      );
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#d9fbff";
      ctx.font = "9px monospace";
      ctx.fillText(label, gate.x - 2, gate.y - gate.radius - 10);
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }
  const draft = d.portalDraft;
  if (!draft) return;
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = "#8ff1ff";
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 6]);
  if (draft.stage === "exit") {
    const point = draft.pointer,
      ok = checkPlacement(d, "exit", point).ok;
    ctx.beginPath();
    ctx.moveTo(draft.entry.x, draft.entry.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(draft.entry.x, draft.entry.y, PORTAL_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = ok ? "#b6ffcf" : "#ff8f9c";
    ctx.beginPath();
    ctx.arc(point.x, point.y, PORTAL_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = ok ? "#b6ffcf" : "#ff8f9c";
    placementLabel(ctx, ok ? "放置出口" : "此处不可部署", point);
  } else {
    // Entry is not committed yet, so the preview follows the pointer.
    const point = draft.pointer;
    const ok = checkPlacement(d, "entry", point).ok;
    ctx.strokeStyle = ok ? "#8ff1ff" : "#ff8f9c";
    ctx.beginPath();
    ctx.arc(point.x, point.y, PORTAL_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = ok ? "#8ff1ff" : "#ff8f9c";
    placementLabel(ctx, ok ? "放置入口" : "此处不可部署", point);
  }
  ctx.restore();
}

/** Short-lived halo that shows an entity just left a gate and cannot re-enter yet. */
function renderPortalLock(
  ctx: CanvasRenderingContext2D,
  body: { x: number; y: number; radius?: number; portalLock?: number },
) {
  if (!body.portalLock || body.portalLock <= 0) return;
  const ratio = Math.min(1, body.portalLock / PORTAL_LOCK);
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.5 * ratio;
  ctx.strokeStyle = "#8ff1ff";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(body.x, body.y, (body.radius ?? 8) + 8 + (1 - ratio) * 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
export function renderScene(ctx: CanvasRenderingContext2D, d: GameDoc) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#0a1019";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "#172431";
  ctx.lineWidth = 0.6;
  for (let x = 0; x < WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#2d424d";
  ctx.setLineDash([6, 8]);
  ctx.strokeRect(28, 28, WIDTH - 56, HEIGHT - 56);
  ctx.setLineDash([]);
  ctx.strokeStyle = "#152c35";
  for (const r of [110, 220, 330]) {
    ctx.beginPath();
    ctx.arc(500, 325, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  renderPortals(ctx, d);
  for (const drop of d.drops) {
    ctx.fillStyle =
      drop.kind === "xp"
        ? "#9eeaa6"
        : drop.kind === "heal"
          ? "#fc91aa"
          : "#8ac6ff";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.save();
    ctx.translate(drop.x, drop.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    renderPortalLock(ctx, drop);
  }
  ctx.shadowBlur = 0;
  for (const e of d.enemies) {
    const color =
      e.kind === "shooter"
        ? "#bb9eff"
        : e.kind === "elite"
          ? "#ffae70"
          : "#ed697b";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    if (e.kind === "chaser") {
      ctx.moveTo(e.x, e.y - 12);
      ctx.lineTo(e.x + 11, e.y + 9);
      ctx.lineTo(e.x - 11, e.y + 9);
      ctx.closePath();
    } else {
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#10121d";
    ctx.beginPath();
    ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (e.hp < e.maxHp) {
      ctx.fillStyle = "#ef7287";
      ctx.fillRect(e.x - 14, e.y - 22, (28 * e.hp) / e.maxHp, 2);
    }
    renderPortalLock(ctx, e);
  }
  for (const b of d.bullets) {
    ctx.fillStyle =
      b.owner === "enemy"
        ? "#ff827d"
        : b.weapon === "nova"
          ? "#ba9fff"
          : b.weapon === "orbit"
            ? "#f7cd79"
            : "#a7ffe1";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    if (b.portalLock) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#8ff1ff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.shadowBlur = 0;
  const p = d.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = "#9eeeb3";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = p.invincible > 0 ? 0.45 : 1;
  ctx.shadowColor = "#a9ffd7";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#cdfedc";
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(12, 11);
  ctx.lineTo(0, 7);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#193b3b";
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();
  renderPortalLock(ctx, p);
  ctx.fillStyle = "#526571";
  ctx.font = "10px monospace";
  ctx.fillText("SECTOR 07 / SIGNAL ACTIVE", 48, HEIGHT - 42);
  ctx.fillText(
    `${d.enemies.length.toString().padStart(3, "0")} HOSTILES`,
    WIDTH - 145,
    HEIGHT - 42,
  );
}
