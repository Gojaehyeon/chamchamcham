"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  className?: string;
  mirrored?: boolean;
}

export function WebcamCanvas({ videoRef, className, mirrored = true }: Props) {
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let canceled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });
        if (canceled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play();
        }
      } catch (e) {
        console.error("[webcam]", e);
        setErr(e instanceof Error ? e.message : String(e));
      }
    }
    start();
    return () => {
      canceled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoRef]);

  return (
    <>
      <video
        ref={videoRef}
        className={className}
        style={mirrored ? { transform: "scaleX(-1)" } : undefined}
        autoPlay
        playsInline
        muted
      />
      {err ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4 text-center text-sm">
          카메라를 열 수 없습니다: {err}
        </div>
      ) : null}
    </>
  );
}
