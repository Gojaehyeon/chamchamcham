export type Direction = "LEFT" | "RIGHT" | "CENTER";

export type GameMode = "attack" | "defense";

export type GamePhase =
  | "idle"
  | "calibrating"
  | "countdown"
  | "judging"
  | "result";

export type GameResult = "win" | "lose";

export interface DetectionFrame {
  hasFace: boolean;
  hasHand: boolean;
  isBlade: boolean;
  faceYaw: number;
  handDx: number;
  faceDir: Direction;
  handDir: Direction;
  timestamp: number;
}
