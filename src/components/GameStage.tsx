"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { WebcamCanvas } from "./WebcamCanvas";
import { useDetector } from "@/hooks/useDetector";
import { beep, primeAudio, speak } from "@/lib/audio";
import type { Direction, GameMode, GamePhase, GameResult } from "@/lib/types";

const BEAT_INTERVAL_MS = 500;
const JUDGE_WINDOW_MS = 320;
const REVEAL_DELAY_MS = 800;
const ANIM_INTERVAL_MS = 380;

const IMG = {
  defenseIdle: ["/images/defense-1.png", "/images/defense-2.png"],
  defenseLeft: "/images/defense-left.png",
  defenseRight: "/images/defense-right.png",
  attackIdle: ["/images/attack-1.png", "/images/attack-2.png"],
  attackLeft: "/images/attack-left.png",
  attackRight: "/images/attack-right.png",
  // Files are named from the AI character's perspective.
  // win-*.png = AI celebrating (V-sign), lose-*.png = AI dejected (thumbs down).
  aiCelebrate: ["/images/win-1.png", "/images/win-2.png"],
  aiDejected: ["/images/lose-1.png", "/images/lose-2.png"],
} as const;

function randomDir(): Direction {
  return Math.random() < 0.5 ? "LEFT" : "RIGHT";
}

function arrow(dir: Direction): string {
  if (dir === "LEFT") return "←";
  if (dir === "RIGHT") return "→";
  return "·";
}

function pickMode(arr: Direction[]): Direction {
  if (!arr.length) return "CENTER";
  const counts: Record<string, number> = {};
  for (const d of arr) counts[d] = (counts[d] ?? 0) + 1;
  let best: Direction = "CENTER";
  let bestN = -1;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestN) {
      bestN = v;
      best = k as Direction;
    }
  }
  return best;
}

interface Score {
  wins: number;
  losses: number;
}

export function GameStage({ mode }: { mode: GameMode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [baselineYaw, setBaselineYaw] = useState(0);
  const { ready, error, frameRef, start, stop } = useDetector(videoRef, {
    baselineYaw,
  });

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [countdownIdx, setCountdownIdx] = useState(0);
  const [aiDir, setAiDir] = useState<Direction>("CENTER");
  const [userDir, setUserDir] = useState<Direction>("CENTER");
  const [result, setResult] = useState<GameResult | null>(null);
  const [score, setScore] = useState<Score>({ wins: 0, losses: 0 });
  const [liveDir, setLiveDir] = useState<Direction>("CENTER");
  const [hasTarget, setHasTarget] = useState(false);
  const [animTick, setAnimTick] = useState(0);
  const [erroredUrls, setErroredUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (ready) start();
    return () => stop();
  }, [ready, start, stop]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const f = frameRef.current;
      if (mode === "attack") {
        setLiveDir(f.handDir);
        setHasTarget(f.hasHand && f.isBlade);
      } else {
        setLiveDir(f.faceDir);
        setHasTarget(f.hasFace);
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [frameRef, mode]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAnimTick((t) => (t === 0 ? 1 : 0));
    }, ANIM_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const pickFromPair = useCallback(
    (pair: readonly [string, string]): string => {
      const [a, b] = pair;
      if (animTick === 1 && !erroredUrls.has(b)) return b;
      return a;
    },
    [animTick, erroredUrls],
  );

  const aiImage = useMemo<string | null>(() => {
    if (phase === "result" && result) {
      const pair = result === "win" ? IMG.aiDejected : IMG.aiCelebrate;
      return pickFromPair(pair as readonly [string, string]);
    }
    const showsDir = phase === "judging" || phase === "countdown";
    if (mode === "attack") {
      if (showsDir) {
        if (aiDir === "LEFT") return IMG.defenseLeft;
        if (aiDir === "RIGHT") return IMG.defenseRight;
      }
      return pickFromPair(IMG.defenseIdle as readonly [string, string]);
    }
    if (showsDir) {
      if (aiDir === "LEFT") return IMG.attackLeft;
      if (aiDir === "RIGHT") return IMG.attackRight;
    }
    return pickFromPair(IMG.attackIdle as readonly [string, string]);
  }, [mode, phase, aiDir, result, pickFromPair]);

  const handleImgError = useCallback(() => {
    if (!aiImage) return;
    setErroredUrls((s) => {
      if (s.has(aiImage)) return s;
      const next = new Set(s);
      next.add(aiImage);
      return next;
    });
  }, [aiImage]);

  const showImg = aiImage && !erroredUrls.has(aiImage);

  const calibrate = useCallback(async () => {
    primeAudio();
    setPhase("calibrating");
    const waitDeadline = performance.now() + 4000;
    await new Promise<void>((res) => {
      const tick = () => {
        if (frameRef.current.hasFace || performance.now() > waitDeadline) {
          res();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
    const samples: number[] = [];
    const sampleEnd = performance.now() + 1200;
    await new Promise<void>((res) => {
      const tick = () => {
        const f = frameRef.current;
        if (f.hasFace) samples.push(f.faceYaw + baselineYaw);
        if (performance.now() > sampleEnd) {
          res();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
    if (samples.length) {
      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)];
      setBaselineYaw(median);
      beep(1320, 100, 0.2);
    }
    setPhase("idle");
  }, [frameRef, baselineYaw]);

  const runRound = useCallback(async () => {
    primeAudio();
    setResult(null);
    setUserDir("CENTER");
    setAiDir("CENTER");

    const ai = randomDir();

    setPhase("countdown");
    for (let i = 1; i <= 3; i++) {
      setCountdownIdx(i);
      // On the final beat, AI commits and its head/hand snaps to its direction.
      if (i === 3) setAiDir(ai);
      speak("참", { rate: i === 3 ? 1.3 : 1.6, pitch: i === 3 ? 1.4 : 1.0 });
      if (i === 3) beep(1320, 80, 0.15);
      await new Promise((r) => setTimeout(r, BEAT_INTERVAL_MS));
    }

    setPhase("judging");
    const judgeEnd = performance.now() + JUDGE_WINDOW_MS;
    const handSamples: Direction[] = [];
    const faceSamples: Direction[] = [];
    await new Promise<void>((res) => {
      const tick = () => {
        const f = frameRef.current;
        if (f.hasHand && f.handDir !== "CENTER") handSamples.push(f.handDir);
        if (f.hasFace && f.faceDir !== "CENTER") faceSamples.push(f.faceDir);
        if (performance.now() > judgeEnd) {
          res();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });

    const u =
      mode === "attack" ? pickMode(handSamples) : pickMode(faceSamples);
    setUserDir(u);

    let r: GameResult;
    if (u === "CENTER") {
      r = "lose";
    } else if (mode === "attack") {
      r = u === ai ? "win" : "lose";
    } else {
      r = u === ai ? "lose" : "win";
    }

    // Reveal AI's direction first; the AI image now shows left/right pose
    // because aiDir was just set. Hold the pose so the player can see it.
    await new Promise((res) => setTimeout(res, REVEAL_DELAY_MS));

    setResult(r);
    setScore((s) => ({
      wins: s.wins + (r === "win" ? 1 : 0),
      losses: s.losses + (r === "lose" ? 1 : 0),
    }));
    setPhase("result");
    beep(r === "win" ? 1760 : 220, 400, 0.25);
    speak(
      r === "win" ? "당신이 이겼어요." : "GO가 이겼어요. 분발하세요.",
      { rate: 1.05, pitch: r === "win" ? 1.15 : 0.95 },
    );
  }, [frameRef, mode]);

  const isBusy =
    phase === "countdown" || phase === "judging" || phase === "calibrating";

  return (
    <div className="flex flex-col items-center gap-5 p-4 w-full max-w-4xl mx-auto">
      <header className="flex w-full items-center justify-between">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-black dark:hover:text-white"
        >
          ← 홈
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold">
          {mode === "attack" ? "공격 모드 (손)" : "수비 모드 (얼굴)"}
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold shadow-sm">
              승
            </span>
            <span className="tabular-nums font-bold text-zinc-800 dark:text-zinc-100">
              {score.wins}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold shadow-sm">
              패
            </span>
            <span className="tabular-nums font-bold text-zinc-800 dark:text-zinc-100">
              {score.losses}
            </span>
          </div>
        </div>
      </header>

      <div
        className={
          "relative w-full aspect-[4/3] rounded-2xl overflow-hidden transition-colors duration-300 " +
          (phase === "result" && result === "win"
            ? "bg-gradient-to-br from-emerald-100 to-emerald-300"
            : phase === "result" && result === "lose"
              ? "bg-gradient-to-br from-rose-100 to-rose-300"
              : "bg-gradient-to-br from-amber-50 to-zinc-200")
        }
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={aiImage}
            alt="상대"
            className="absolute inset-0 w-full h-full object-contain"
            onError={handleImgError}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-zinc-300">
            {aiImage ? (
              <>
                <div className="text-sm opacity-70">사진이 필요해요</div>
                <code className="text-xs bg-black/40 px-2 py-1 rounded">
                  public{aiImage}
                </code>
              </>
            ) : (
              <div className="text-sm opacity-60">대기 중…</div>
            )}
          </div>
        )}

        {phase === "countdown" && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-4 left-4 text-zinc-900 text-3xl sm:text-5xl font-black drop-shadow-[0_2px_8px_rgba(255,255,255,0.7)] leading-none">
              참 참 참!
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-zinc-900 text-[22vw] sm:text-[18vw] font-black drop-shadow-[0_4px_12px_rgba(255,255,255,0.7)] leading-none tabular-nums">
                {4 - countdownIdx}
              </div>
            </div>
          </div>
        )}

        {phase === "calibrating" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
            <div className="text-white text-2xl font-bold text-center">
              카메라를 정면으로 바라봐주세요
              <div className="text-base mt-2 font-normal opacity-80">
                기준값 측정 중…
              </div>
            </div>
          </div>
        )}

        <div className="absolute right-3 bottom-3 w-32 sm:w-40 aspect-[4/3] rounded-xl overflow-hidden border-2 border-white/40 shadow-xl bg-black">
          <WebcamCanvas
            videoRef={videoRef}
            className="w-full h-full object-cover"
          />
          <div className="absolute left-1 top-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] whitespace-nowrap">
            {!ready
              ? "로딩…"
              : hasTarget
                ? `${mode === "attack" ? "손날" : "얼굴"} ${arrow(liveDir)}`
                : mode === "attack"
                  ? "손날?"
                  : "얼굴?"}
          </div>
        </div>
      </div>

      {error ? (
        <div className="w-full rounded-xl p-3 bg-red-500/10 text-red-600 text-sm">
          감지 모델 로드 실패: {error}
        </div>
      ) : null}

      {phase === "result" && result && (
        <div
          className={
            "w-full rounded-2xl p-4 text-center text-2xl font-bold " +
            (result === "win"
              ? "bg-green-500/15 text-green-600"
              : "bg-red-500/15 text-red-600")
          }
        >
          {result === "win" ? "당신이 이겼어요." : "GO가 이겼어요. 분발하세요."}
          <div className="mt-1 text-sm font-normal text-zinc-500">
            나 {arrow(userDir)} · 상대 {arrow(aiDir)}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={calibrate}
          disabled={isBusy || !ready}
          className="px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
        >
          정면 보정
        </button>
        <button
          type="button"
          onClick={runRound}
          disabled={isBusy || !ready}
          className="px-6 py-2 rounded-full bg-black text-white dark:bg-white dark:text-black font-semibold disabled:opacity-40"
        >
          {phase === "result" ? "한 번 더" : "시작"}
        </button>
      </div>

      <details className="w-full text-sm text-zinc-500">
        <summary className="cursor-pointer">플레이 방법</summary>
        <ol className="mt-2 ml-4 list-decimal space-y-1">
          <li>웹캠을 켠 뒤 정면을 보고 “정면 보정”을 누르세요.</li>
          <li>“시작”을 누르면 참! 참! 참! 비트가 3번 울립니다.</li>
          <li>
            마지막 참! 순간에{" "}
            {mode === "attack"
              ? "손날(옆으로 세운 손)을 좌 또는 우로 향하세요."
              : "얼굴을 좌 또는 우로 돌리세요."}
          </li>
          <li>
            {mode === "attack"
              ? "상대 얼굴 방향과 같으면 승리."
              : "상대 손날 방향과 같으면 패배."}
          </li>
        </ol>
      </details>
    </div>
  );
}
