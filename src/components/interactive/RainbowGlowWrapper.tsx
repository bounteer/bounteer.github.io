"use client";

import { useEffect, useState } from "react";
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
  borderRadius = "rounded-3xl",
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
      <style dangerouslySetInnerHTML={{__html: `
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
          0%, 100% {
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
            box-shadow: 0 0 140px rgba(0, 255, 127, 1), 0 0 260px rgba(0, 255, 127, 0.7);
          }
          100% {
            box-shadow: 0 0 60px rgba(0, 255, 127, 0.4);
          }
        }
      `}} />

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
        {ambient && (
          <div
            style={{
              position: "absolute",
              inset: "-10%",
              background: "radial-gradient(circle at center, rgba(255, 255, 255, 0.5) 0%, rgba(255, 210, 255, 0.35) 25%, rgba(195, 220, 255, 0.25) 45%, rgba(255, 255, 255, 0) 75%)",
              filter: "blur(30px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}

        {isGlowing && (
          <>
            <div
              style={{
                position: "absolute",
                inset: "-20%",
                borderRadius: "9999px",
                backgroundSize: "400% 400%",
                pointerEvents: "none",
                mixBlendMode: "screen",
                filter: "blur(30px) saturate(280%) brightness(1.35)",
                opacity: 0.9,
                background: "linear-gradient(115deg, #ff3fd8, #ffa63f, #66ff99, #3fc5ff, #a93fff, #ff3fd8)",
                animation: "auroraShiftA 10s ease-in-out infinite, breathe 6s ease-in-out infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "-20%",
                borderRadius: "9999px",
                backgroundSize: "400% 400%",
                pointerEvents: "none",
                mixBlendMode: "screen",
                filter: "blur(40px) saturate(260%) brightness(1.4)",
                opacity: 0.8,
                background: "linear-gradient(250deg, #ff8aff, #9efff3, #ffe871, #ffa3a3, #9aa8ff, #ff8aff)",
                animation: "auroraShiftB 14s ease-in-out infinite, breathe 7s ease-in-out infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "-20%",
                borderRadius: "9999px",
                backgroundSize: "400% 400%",
                pointerEvents: "none",
                mixBlendMode: "screen",
                filter: "blur(30px) saturate(280%) brightness(1.35)",
                opacity: 0.65,
                background: "conic-gradient(from 0deg, #ff9dfb, #91d4ff, #9effc4, #fff59e, #ffa4e3, #ff9dfb)",
                animation: "rotateGradient 40s linear infinite, breathe 8s ease-in-out infinite",
              }}
            />
          </>
        )}

        <div className="relative z-10">{children}</div>
      </div>
    </>
  );
}
