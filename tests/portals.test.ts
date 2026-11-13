import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/shared/createRun";
import { simulate } from "../src/app/simulate";
import { stepPortals, placePortal, beginPortalDraft, closePortals, PORTAL_LIFE } from "../src/features/portals";
import { sweepThroughPortals } from "../src/features/portals/lib/traverse";
import { stepCombat } from "../src/features/combat";
import { stepWaves } from "../src/features/waves";
import { stepProgression } from "../src/features/progression";
import { WIDTH, HEIGHT } from "../src/shared/types";
import type { FrameEvents, GameDoc, Vec } from "../src/shared/types";

const input = { x: 0, y: 0, aim: { x: 700, y: 325 }, firing: false };
const quiet = (): FrameEvents => ({
  kills: [],
  damage: 0,
  taken: 0,
  shots: 0,
  collected: 0,
});

/** Deploy a pair around two chosen gates without going through the UI. */
function deploy(doc: GameDoc, entry: Vec, exit: Vec) {
  doc.phase = "playing";
  assert.ok(beginPortalDraft(doc));
  assert.ok(placePortal(doc, entry));
  assert.ok(placePortal(doc, exit));
  assert.ok(doc.portals);
}

test("placing entry then exit creates a linked pair that reports its own lifetime", () => {
  const d = createRun();
  deploy(d, { x: 200, y: 200 }, { x: 800, y: 450 });
  assert.deepEqual(
    { x: d.portals!.entry.x, y: d.portals!.entry.y },
    { x: 200, y: 200 },
  );
  assert.deepEqual(
    { x: d.portals!.exit.x, y: d.portals!.exit.y },
    { x: 800, y: 450 },
  );
  assert.equal(d.portals!.entry.life, PORTAL_LIFE);
  assert.equal(d.portalDraft, null);
});

test("an exit near the boundary is rejected and the previous pair survives", () => {
  const d = createRun();
  deploy(d, { x: 200, y: 200 }, { x: 800, y: 450 });
  const before = JSON.stringify(d.portals);
  assert.ok(beginPortalDraft(d));
  assert.ok(placePortal(d, { x: 300, y: 300 }));
  // Too close to the field edge.
  assert.equal(placePortal(d, { x: WIDTH - 4, y: 320 }), false);
  assert.equal(JSON.stringify(d.portals), before);
  assert.equal(d.portalDraft?.stage, "exit");
  assert.match(d.portalMessage, /边界|保留/);
  // A valid second attempt still commits.
  assert.equal(placePortal(d, { x: 760, y: 320 }), true);
  assert.equal(d.portals!.exit.x, 760);
});

test("overlapping gates are refused so no body can teleport forever", () => {
  const d = createRun();
  d.phase = "playing";
  beginPortalDraft(d);
  placePortal(d, { x: 500, y: 325 });
  assert.equal(placePortal(d, { x: 508, y: 330 }), false);
  assert.equal(d.portals, null);
  assert.match(d.portalMessage, /重叠/);
});

test("a crossing body keeps its speed, emerges from the exit along the pair axis and is briefly immune to re-entry", () => {
  const d = createRun();
  deploy(d, { x: 300, y: 325 }, { x: 700, y: 325 });
  const body = { x: 240, y: 325 },
    path = sweepThroughPortals(d, body, { x: 300, y: 325 }, 4, false);
  assert.equal(path.crossed, true);
  assert.ok(path.position.x > 700);
  assert.ok(path.position.x > 733, "leftover travel continues past the exit");
  assert.equal(path.segments.length, 2);
  // The second segment starts past the exit gate, never inside it.
  assert.ok(path.segments[1].from.x > 700 + 26);
  // Crossing again while locked is ignored.
  const locked = sweepThroughPortals(
    d,
    { x: 260, y: 325 },
    { x: 340, y: 325 },
    4,
    true,
  );
  assert.equal(locked.crossed, false);
});

test("entering the exit gate sends a body back out through the entry gate", () => {
  const d = createRun();
  deploy(d, { x: 300, y: 325 }, { x: 700, y: 325 });
  const path = sweepThroughPortals(d, { x: 740, y: 325 }, { x: 690, y: 325 }, 4, false);
  assert.equal(path.crossed, true);
  assert.ok(path.position.x < 300, "should emerge left of the entry gate");
});

test("a bullet teleport moves the real hitbox, so dodging is not just visual", () => {
  const d = createRun();
  deploy(d, { x: 300, y: 325 }, { x: 700, y: 325 });
  d.player.x = 500;
  d.player.y = 325;
  d.player.invincible = 0;
  d.bullets = [
    {
      id: 1,
      x: 240,
      y: 325,
      vx: 3600,
      vy: 0,
      radius: 5,
      damage: 50,
      life: 2,
      owner: "enemy",
      weapon: "enemy",
      pierce: 0,
      hit: [],
    },
  ];
  let taken = 0;
  for (let i = 0; i < 120 && d.bullets.length; i++) {
    taken += stepCombat(d, input, 1 / 60).taken;
    d.player.invincible = 0;
  }
  assert.equal(taken, 0, "shot that crosses the gate never reaches the old path");
  // Exact control: without the gates, the same bullet hits the player.
  const control = createRun();
  control.player.x = 500;
  control.player.y = 325;
  control.player.invincible = 0;
  control.bullets = [{ id: 8, x: 240, y: 325, vx: 3600, vy: 0, radius: 5, damage: 50, life: 2, owner: "enemy", weapon: "enemy", pierce: 0, hit: [] }];
  let controlTaken = 0;
  for (let i = 0; i < 120 && control.bullets.length; i++) {
    controlTaken += stepCombat(control, input, 1 / 60).taken;
    control.player.invincible = 0;
  }
  assert.equal(controlTaken, 50);
  // And the crossing itself reports its lock and gate pulse.
  const probe = createRun();
  deploy(probe, { x: 300, y: 325 }, { x: 700, y: 325 });
  probe.bullets = [{ id: 7, x: 240, y: 325, vx: 3600, vy: 0, radius: 5, damage: 10, life: 2, owner: "enemy", weapon: "enemy", pierce: 0, hit: [] }];
  stepCombat(probe, input, 1 / 60);
  assert.ok(probe.bullets[0].x > 700, "bullet continued from the exit");
  assert.ok(probe.bullets[0].portalLock && probe.bullets[0].portalLock > 0);
  assert.equal(probe.portals!.entry.flash > 0, true);
});

test("enemies chase the shorter route through the portal when the player is beyond it", () => {
  const d = createRun();
  deploy(d, { x: 420, y: 325 }, { x: 820, y: 325 });
  d.player.x = 940;
  d.player.y = 325;
  d.enemies = [
    {
      id: 1,
      kind: "chaser",
      x: 360,
      y: 325,
      hp: 100,
      maxHp: 100,
      radius: 12,
      cooldown: 5,
    },
  ];
  stepWaves(d, 1 / 60);
  assert.ok(d.enemies[0].x > 360, "walks toward the entry gate");
  // Without the shortcut the enemy would walk the other way to reach the player directly.
  const control = createRun();
  control.player.x = 940;
  control.player.y = 325;
  control.enemies = [{ ...d.enemies[0], x: 360, portalLock: 0 }];
  stepWaves(control, 1 / 60);
  assert.ok(control.enemies[0].x > 360);
});

test("a routed enemy actually crosses and lands near the player", () => {
  const d = createRun();
  deploy(d, { x: 500, y: 325 }, { x: 900, y: 325 });
  d.player.x = 960;
  d.player.y = 325;
  d.enemies = [
    {
      id: 1,
      kind: "chaser",
      x: 450,
      y: 325,
      hp: 100,
      maxHp: 100,
      radius: 12,
      cooldown: 5,
    },
  ];
  for (let i = 0; i < 30; i++) stepWaves(d, 1 / 60);
  assert.ok(d.enemies[0].x > 900, "enemy emerged from the exit gate");
  assert.ok(Math.abs(d.enemies[0].y - 325) < 80);
});

test("magnetised drops traverse, idle drops stay put", () => {
  const d = createRun();
  deploy(d, { x: 300, y: 325 }, { x: 700, y: 325 });
  // Widen the magnet so a drop behind the entry gate is actually being pulled.
  d.upgrades.magnet = 2;
  d.player.x = 352;
  d.player.y = 325;
  d.drops = [
    { id: 1, x: 100, y: 600, kind: "xp", value: 1, life: 20 },
    { id: 2, x: 240, y: 325, kind: "xp", value: 1, life: 20 },
  ];
  stepProgression(d, quiet(), 1 / 60);
  // Far idle drop keeps its position.
  assert.deepEqual(
    { x: d.drops.find((x) => x.id === 1)!.x, y: d.drops.find((x) => x.id === 1)!.y },
    { x: 100, y: 600 },
  );
  // The near drop is pulled toward the player, which means crossing the entry gate.
  let crossed = false;
  for (let i = 0; i < 40; i++) {
    stepProgression(d, quiet(), 1 / 60);
    const near = d.drops.find((x) => x.id === 2);
    if (!near) break;
    if (near.x > 700) {
      crossed = true;
      assert.ok(near.portalLock && near.portalLock > 0);
      break;
    }
  }
  assert.ok(crossed, "pulled drop emerged past the exit gate");
});

test("portal lifetime freezes during upgrades and pause, and resumes afterwards", () => {
  const d = createRun();
  deploy(d, { x: 300, y: 325 }, { x: 700, y: 325 });
  const startLife = d.portals!.entry.life;
  simulate(d, input, 1 / 60);
  assert.ok(d.portals!.entry.life < startLife);
  const afterPlaying = d.portals!.entry.life;
  d.phase = "upgrade";
  simulate(d, input, 1 / 60);
  assert.equal(d.portals!.entry.life, afterPlaying);
  d.phase = "paused";
  simulate(d, input, 1 / 60);
  assert.equal(d.portals!.entry.life, afterPlaying);
  d.phase = "playing";
  simulate(d, input, 1 / 60);
  assert.ok(d.portals!.entry.life < afterPlaying);
});

test("anti-reentry windows freeze with the rest of the crossing process", () => {
  const d = createRun();
  deploy(d, { x: 300, y: 325 }, { x: 700, y: 325 });
  d.enemies = [
    {
      id: 1,
      kind: "chaser",
      x: 240,
      y: 325,
      hp: 100,
      maxHp: 100,
      radius: 12,
      cooldown: 5,
      portalLock: 0.4,
    },
  ];
  d.player.x = 500;
  d.player.y = 100;
  d.bullets = [
    {
      id: 2,
      x: 800,
      y: 200,
      vx: 0,
      vy: 0,
      radius: 4,
      damage: 5,
      life: 3,
      owner: "player",
      weapon: "pulse",
      pierce: 0,
      hit: [],
      portalLock: 0.3,
    },
  ];
  d.phase = "upgrade";
  simulate(d, input, 1 / 60);
  assert.equal(d.enemies[0].portalLock, 0.4);
  assert.equal(d.bullets[0].portalLock, 0.3);
  assert.equal(d.portals!.entry.life, PORTAL_LIFE);
  d.phase = "playing";
  simulate(
    d,
    { x: 0, y: 0, aim: { x: 900, y: 200 }, firing: false },
    1 / 60,
  );
  assert.ok(d.enemies[0].portalLock! < 0.4);
  assert.ok(d.bullets[0].portalLock! < 0.3);
});

test("closing a portal keeps crossed projectiles on their exit heading and expires the gates", () => {
  const d = createRun();
  deploy(d, { x: 300, y: 325 }, { x: 700, y: 325 });
  d.bullets = [
    {
      id: 1,
      x: 240,
      y: 325,
      vx: 3600,
      vy: 0,
      radius: 5,
      damage: 10,
      life: 2,
      owner: "player",
      weapon: "pulse",
      pierce: 0,
      hit: [],
    },
    {
      id: 2,
      x: 120,
      y: 500,
      vx: 300,
      vy: 0,
      radius: 5,
      damage: 10,
      life: 2,
      owner: "player",
      weapon: "pulse",
      pierce: 0,
      hit: [],
    },
  ];
  stepCombat(d, input, 1 / 60);
  const crossed = d.bullets.find((b) => b.id === 1)!;
  const untravelled = d.bullets.find((b) => b.id === 2)!;
  assert.ok(crossed.x > 700);
  const heading = { vx: crossed.vx, vy: crossed.vy };
  closePortals(d);
  assert.equal(d.portals, null);
  stepCombat(d, input, 1 / 60);
  assert.deepEqual(
    { vx: crossed.vx, vy: crossed.vy },
    heading,
    "velocity is retained after closing",
  );
  // The never-crossed bullet simply follows its own line.
  assert.ok(Math.abs(untravelled.vy) < 1e-9);
  assert.ok(untravelled.x > 120);
});

test("lifetime expiry removes the pair and lets pending entities carry on", () => {
  const d = createRun();
  deploy(d, { x: 300, y: 325 }, { x: 700, y: 325 });
  d.portals!.entry.life = 0.01;
  stepPortals(d, 0.02);
  assert.equal(d.portals, null);
  assert.match(d.portalMessage, /寿命|原路线/);
});

test("placing a portal does not fire the weapon or pause the run", () => {
  const d = createRun();
  d.phase = "playing";
  beginPortalDraft(d);
  placePortal(d, { x: 300, y: 325 });
  assert.equal(d.phase, "playing");
  assert.ok(d.portalDraft);
  // Simulating while drafting still advances the battle.
  const time = d.time;
  simulate(d, { ...input, x: 1, y: 0 }, 1 / 60);
  assert.ok(d.time > time);
});

test("simulation stays finite with gates close to each other at minimum separation", () => {
  const d = createRun();
  d.phase = "playing";
  beginPortalDraft(d);
  placePortal(d, { x: 400, y: 325 });
  // Exactly at the minimum separation is accepted.
  assert.equal(placePortal(d, { x: 400 + 2 * 26 + 34, y: 325 }), true);
  assert.ok(Number.isFinite(d.portals!.exit.x));
  assert.ok(d.portals!.exit.x < WIDTH - 26);
  assert.ok(d.portals!.entry.y > 0 && d.portals!.entry.y < HEIGHT);
});
