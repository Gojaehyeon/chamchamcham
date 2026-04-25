"use client";

import {
  FilesetResolver,
  FaceLandmarker,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let faceLandmarker: FaceLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let initPromise: Promise<void> | null = null;
let consolePatched = false;

// MediaPipe / TFLite WASM logs `INFO:` and `WARNING:` lines via console.error.
// Next.js dev overlay treats those as runtime errors. Filter that noise so
// only real errors reach console.error.
function patchConsoleOnce(): void {
  if (consolePatched || typeof window === "undefined") return;
  consolePatched = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      (first.startsWith("INFO:") || first.startsWith("WARNING:"))
    ) {
      console.info(...args);
      return;
    }
    original(...args);
  };
}

async function doInit(): Promise<void> {
  patchConsoleOnce();
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const [fl, hl] = await Promise.all([
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
    }),
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
    }),
  ]);
  faceLandmarker = fl;
  handLandmarker = hl;
}

export function initDetectors(): Promise<void> {
  if (faceLandmarker && handLandmarker) return Promise.resolve();
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

export function getDetectors(): {
  faceLandmarker: FaceLandmarker | null;
  handLandmarker: HandLandmarker | null;
} {
  return { faceLandmarker, handLandmarker };
}
