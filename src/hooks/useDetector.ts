"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { initDetectors, getDetectors } from "@/lib/mediapipe";
import {
  computeFaceYaw,
  computeHandPose,
  classifyFace,
  classifyBlade,
} from "@/lib/direction";
import type { DetectionFrame } from "@/lib/types";

export interface UseDetectorResult {
  ready: boolean;
  error: string | null;
  frameRef: RefObject<DetectionFrame>;
  start: () => void;
  stop: () => void;
}

export function useDetector(
  videoRef: RefObject<HTMLVideoElement | null>,
  options: { baselineYaw?: number } = {},
): UseDetectorResult {
  const { baselineYaw = 0 } = options;
  const baselineRef = useRef(baselineYaw);
  baselineRef.current = baselineYaw;

  const frameRef = useRef<DetectionFrame>({
    hasFace: false,
    hasHand: false,
    isBlade: false,
    faceYaw: 0,
    handDx: 0,
    faceDir: "CENTER",
    handDir: "CENTER",
    timestamp: 0,
  });
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastFaceTsRef = useRef(-1);
  const lastHandTsRef = useRef(-1);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    initDetectors()
      .then(() => {
        if (!canceled) setReady(true);
      })
      .catch((err: unknown) => {
        console.error("[mediapipe] init failed", err);
        if (!canceled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const { faceLandmarker, handLandmarker } = getDetectors();
    if (video && faceLandmarker && handLandmarker && video.readyState >= 2) {
      const now = performance.now();
      const faceTs = Math.max(now, lastFaceTsRef.current + 1);
      const handTs = Math.max(now, lastHandTsRef.current + 1);
      lastFaceTsRef.current = faceTs;
      lastHandTsRef.current = handTs;

      try {
        const faceRes = faceLandmarker.detectForVideo(video, faceTs);
        const handRes = handLandmarker.detectForVideo(video, handTs);

        let hasFace = false;
        let faceYaw = 0;
        const faceLm = faceRes.faceLandmarks?.[0];
        if (faceLm) {
          hasFace = true;
          faceYaw = computeFaceYaw(faceLm, baselineRef.current);
        }

        let hasHand = false;
        let handDx = 0;
        let isBlade = false;
        const handLm = handRes.landmarks?.[0];
        if (handLm) {
          hasHand = true;
          const pose = computeHandPose(handLm);
          handDx = pose.dx;
          isBlade = pose.isBlade;
        }

        frameRef.current = {
          hasFace,
          hasHand,
          isBlade,
          faceYaw,
          handDx,
          faceDir: hasFace ? classifyFace(faceYaw) : "CENTER",
          // Judgment uses hand orientation alone; the strict blade pose only
          // gates the live "손날?" badge so users get pose feedback in the PIP.
          handDir: hasHand
            ? handDx > 0.15
              ? "RIGHT"
              : handDx < -0.15
                ? "LEFT"
                : "CENTER"
            : "CENTER",
          timestamp: now,
        };
      } catch (err) {
        console.error("[mediapipe] detect error", err);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    loop();
  }, [loop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { ready, error, frameRef, start, stop };
}
