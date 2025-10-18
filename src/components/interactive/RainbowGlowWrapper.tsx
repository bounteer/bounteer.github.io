"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type GlowState = "idle" | "listening" | "processing" | "done";

interface RainbowGlowWrapperProps {
  children: React.ReactNode;
  glowState?: GlowState;
  className?: string;
  borderRadius?: string;
  /** show big ambient halo behind the card */
  ambient?: boolean;
}

export default function RainbowGlowWrapper({
  children,
  glowState = "idle",
  className = "",
  borderRadius = "rounded-2xl",
  ambient = true,
}: RainbowGlowWrapperProps) {
  const [internalState, setInternalState] = useState<GlowState>("idle");
  const isGlowing =
    internalState === "processing" || internalState === "listening";


  useEffect(() => {
    if (glowState === "done") {
      setInternalState("done");
      const t = setTimeout(() => setInternalState("idle"), 1600);
      return () => clearTimeout(t);
    }
    setInternalState(glowState);
  }, [glowState]);

  return (
    <>
      <style jsx>{`
        /* ---------- KEYFRAMES ---------- */
        @keyframes auroraShiftA {
          0% {
            background-position: 0% 50%;
            filter: hue-rotate(0deg);
          }
          50% {
            background-position: 100% 50%;
            filter: hue-rotate(180deg);
          }
          100% {
            background-position: 0% 50%;
            filter: hue-rotate(360deg);
          }
        }
        @keyframes auroraShiftB {
          0% {
            background-position: 50% 0%;
          }
          50% {
            background-position: 50% 100%;
          }
          100% {
            background-position: 50% 0%;
          }
        }
        @keyframes rotateGradient {
          0% {
            transform: rotate(0deg) scale(1);
          }
          100% {
            transform: rotate(720deg) scale(1.05);
          }
        }
        @keyframes breathe {
          0%,
          100% {
            opacity: 0.85;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.06);
          }
        }
        @keyframes donePulse {
          0% {
            box-shadow: 0 0 0 rgba(0, 255, 127, 0);
          }
          30% {
            box-shadow: 0 0 140px rgba(0, 255, 127, 1),
              0 0 260px rgba(0, 255, 127, 0.7);
          }
          100% {
            box-shadow: 0 0 60px rgba(0, 255, 127, 0.4);
          }
        }

        /* ---------- LAYERS ---------- */
        .aurora-layer {
          position: absolute;
          inset: -70%;
          border-radius: 9999px;
          background-size: 400% 400%;
          pointer-events: none;
          mix-blend-mode: screen;
          filter: blur(140px) saturate(280%) brightness(1.35);
          opacity: 0.9;
        }
        .layer1 {
          background: linear-gradient(
            115deg,
            #ff3fd8,
            #ffa63f,
            #66ff99,
            #3fc5ff,
            #a93fff,
            #ff3fd8
          );
          animation: auroraShiftA 10s ease-in-out infinite,
            breathe 6s ease-in-out infinite;
        }
        .layer2 {
          background: linear-gradient(
            250deg,
            #ff8aff,
            #9efff3,
            #ffe871,
            #ffa3a3,
            #9aa8ff,
            #ff8aff
          );
          filter: blur(160px) saturate(260%) brightness(1.4);
          opacity: 0.8;
          animation: auroraShiftB 14s ease-in-out infinite,
            breathe 7s ease-in-out infinite;
        }
        .layer3 {
          background: conic-gradient(
            from 0deg,
            #ff9dfb,
            #91d4ff,
            #9effc4,
            #fff59e,
            #ffa4e3,
            #ff9dfb
          );
          opacity: 0.65;
          animation: rotateGradient 40s linear infinite,
            breathe 8s ease-in-out infinite;
        }

        .ambient-halo {
          position: absolute;
          inset: -35%;
          background: radial-gradient(
            circle at center,
            rgba(255, 255, 255, 0.5) 0%,
            rgba(255, 210, 255, 0.35) 25%,
            rgba(195, 220, 255, 0.25) 45%,
            rgba(255, 255, 255, 0) 75%
          );
          filter: blur(120px);
          pointer-events: none;
          z-index: 0;
        }
      `}</style>

      <div
        className={cn(
          "relative overflow-hidden backdrop-blur-2xl border bg-white/5 transition-all duration-700",
          borderRadius,
          className,
          internalState === "done" ? "animate-[donePulse_1.2s_ease-out_forwards]" : ""
        )}
        style={{
          borderColor:
            internalState === "done"
              ? "rgba(34,197,94,0.8)"
              : isGlowing
                ? "rgba(255,255,255,0.5)"
                : "rgba(255,255,255,0.18)",
          boxShadow: isGlowing
            ? "0 0 80px rgba(180,200,255,0.7), 0 0 160px rgba(255,180,255,0.55), inset 0 0 60px rgba(255,255,255,0.28)"
            : "0 0 24px rgba(255,255,255,0.12)",
        }}
      >
        {ambient && <div className="ambient-halo" />}

        {isGlowing && (
          <>
            <div className="aurora-layer layer1" />
            <div className="aurora-layer layer2" />
            <div className="aurora-layer layer3" />
          </>
        )}

        <div className="relative z-10">{children}</div>
      </div>
    </>
  );
}
