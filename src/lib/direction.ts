import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Direction } from "./types";

const NOSE_TIP = 1;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;

const WRIST = 0;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_TIP = 20;

export const FACE_THRESHOLD = 0.08;

// Blade pose tuning.
// palmAxis = wrist → middle MCP, must be near horizontal.
// crossAxis = index MCP → pinky MCP, must be near vertical (hand on its edge).
// Each finger tip must be extended past its MCP and roughly parallel to palmAxis.
const PALM_HORIZONTAL_MIN = 0.7; // |palmDx|
const CROSS_VERTICAL_MIN = 0.55; // |crossDy / |cross||
const FINGER_EXTEND_RATIO = 0.55; // |tip - mcp| / handSize
const FINGER_PARALLEL_MIN = 0.6; // dot(tip-mcp, palmAxis)

export interface HandPose {
  isBlade: boolean;
  dx: number; // -1..1, positive = pointing user-RIGHT (mirror)
}

// Positive yaw score = user turned head to their RIGHT (mirror view).
export function computeFaceYaw(
  landmarks: NormalizedLandmark[],
  baselineOffset = 0,
): number {
  const left = landmarks[LEFT_CHEEK];
  const right = landmarks[RIGHT_CHEEK];
  const nose = landmarks[NOSE_TIP];
  if (!left || !right || !nose) return 0;
  const faceWidth = Math.abs(right.x - left.x);
  if (faceWidth < 1e-4) return 0;
  const center = (left.x + right.x) / 2;
  return (nose.x - center) / (faceWidth / 2) - baselineOffset;
}

export function computeHandPose(landmarks: NormalizedLandmark[]): HandPose {
  const wrist = landmarks[WRIST];
  const indexMcp = landmarks[INDEX_MCP];
  const middleMcp = landmarks[MIDDLE_MCP];
  const ringMcp = landmarks[RING_MCP];
  const pinkyMcp = landmarks[PINKY_MCP];
  const indexTip = landmarks[INDEX_TIP];
  const middleTip = landmarks[MIDDLE_TIP];
  const ringTip = landmarks[RING_TIP];
  const pinkyTip = landmarks[PINKY_TIP];

  if (
    !wrist ||
    !indexMcp ||
    !middleMcp ||
    !ringMcp ||
    !pinkyMcp ||
    !indexTip ||
    !middleTip ||
    !ringTip ||
    !pinkyTip
  ) {
    return { isBlade: false, dx: 0 };
  }

  const palmRawDx = middleMcp.x - wrist.x;
  const palmRawDy = middleMcp.y - wrist.y;
  const handSize = Math.hypot(palmRawDx, palmRawDy);
  if (handSize < 1e-3) return { isBlade: false, dx: 0 };

  const palmDx = palmRawDx / handSize;
  const palmDy = palmRawDy / handSize;

  const palmHorizontal = Math.abs(palmDx) > PALM_HORIZONTAL_MIN;

  const crossDx = pinkyMcp.x - indexMcp.x;
  const crossDy = pinkyMcp.y - indexMcp.y;
  const crossLen = Math.hypot(crossDx, crossDy);
  const crossVertical =
    crossLen > 1e-4 && Math.abs(crossDy) / crossLen > CROSS_VERTICAL_MIN;

  const extended = (
    mcp: NormalizedLandmark,
    tip: NormalizedLandmark,
  ): boolean => {
    const tx = tip.x - mcp.x;
    const ty = tip.y - mcp.y;
    const tlen = Math.hypot(tx, ty);
    if (tlen / handSize < FINGER_EXTEND_RATIO) return false;
    const dot = (tx * palmDx + ty * palmDy) / tlen;
    return dot > FINGER_PARALLEL_MIN;
  };

  const allExtended =
    extended(indexMcp, indexTip) &&
    extended(middleMcp, middleTip) &&
    extended(ringMcp, ringTip) &&
    extended(pinkyMcp, pinkyTip);

  const isBlade = palmHorizontal && crossVertical && allExtended;

  // Raw webcam x increases toward user's left, so we negate so +ve = user right.
  return { isBlade, dx: -palmDx };
}

export function classifyFace(score: number): Direction {
  if (score > FACE_THRESHOLD) return "RIGHT";
  if (score < -FACE_THRESHOLD) return "LEFT";
  return "CENTER";
}

export function classifyBlade(pose: HandPose): Direction {
  if (!pose.isBlade) return "CENTER";
  if (pose.dx > 0) return "RIGHT";
  if (pose.dx < 0) return "LEFT";
  return "CENTER";
}
