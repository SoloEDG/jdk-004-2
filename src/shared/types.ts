export type Vec = { x: number; y: number };
export type Phase = "ready" | "playing" | "paused" | "upgrade" | "ended";
export type WeaponId = "pulse" | "orbit" | "nova";
export interface Portal extends Vec {
  radius: number;
  /** Seconds of operational life left. Frozen while the run is paused or upgrading. */
  life: number;
  /** Visual pulse fed by a recent crossing. */
  flash: number;
}
export interface PortalPair {
  entry: Portal;
  exit: Portal;
}
export interface Player extends Vec {
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  invincible: number;
  /** Brief anti-reentry window after a teleport. */
  portalLock?: number;
}
export interface Enemy extends Vec {
  id: number;
  kind: "chaser" | "shooter" | "elite";
  hp: number;
  maxHp: number;
  radius: number;
  cooldown: number;
  /** Brief anti-reentry window after a teleport. */
  portalLock?: number;
}
export interface Bullet extends Vec {
  id: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  owner: "player" | "enemy";
  weapon: WeaponId | "enemy";
  pierce: number;
  hit: number[];
  /** Brief anti-reentry window after a teleport. */
  portalLock?: number;
}
export interface Drop extends Vec {
  id: number;
  kind: "xp" | "heal" | "magnet";
  value: number;
  life: number;
  /** Brief anti-reentry window after a teleport. */
  portalLock?: number;
}
export interface Weapon {
  id: WeaponId;
  level: number;
  cooldown: number;
}
export interface Upgrade {
  id: string;
  name: string;
  description: string;
  category: string;
  max: number;
}
export interface RunStats {
  kills: number;
  damage: number;
  taken: number;
  collected: number;
  shots: number;
  byWeapon: Record<WeaponId, number>;
}
export interface RunRecord {
  id: string;
  duration: number;
  wave: number;
  level: number;
  kills: number;
  damage: number;
  weapons: string[];
  victory: boolean;
}
export interface GameDoc {
  version: 1;
  seed: number;
  initialSeed: number;
  nextId: number;
  phase: Phase;
  time: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  drops: Drop[];
  /** Deployed bidirectional portal pair, or null while undeployed. */
  portals: PortalPair | null;
  /** Pending placement stage for the deployment UI. */
  portalDraft: PortalDraft | null;
  /** Transient deployment feedback shown beside the battlefield. */
  portalMessage: string;
  weapons: Weapon[];
  upgrades: Record<string, number>;
  choices: string[];
  xp: number;
  level: number;
  pendingLevels: number;
  wave: number;
  waveTime: number;
  spawnBudget: number;
  stats: RunStats;
  records: RunRecord[];
  notice: string;
  victory: boolean;
}
export interface Input {
  x: number;
  y: number;
  aim: Vec;
  firing: boolean;
  /** Cannon-space pointer position used for portal placement. */
  pointer?: Vec;
}
export interface PortalDraft {
  stage: "entry" | "exit";
  entry: Vec;
  pointer: Vec;
}
export interface KillEvent {
  enemy: Enemy;
  weapon: WeaponId;
}
export interface FrameEvents {
  weaponDamage?: Partial<Record<WeaponId, number>>;
  kills: KillEvent[];
  damage: number;
  taken: number;
  shots: number;
  collected: number;
}
export const WIDTH = 1000;
export const HEIGHT = 650;
