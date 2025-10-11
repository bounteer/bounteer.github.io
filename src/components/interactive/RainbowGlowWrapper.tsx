"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type GlowState = "idle" | "listening" | "processing" | "done";

interface RainbowGlowWrapperProps {
  children: React.ReactNode;
  glowState?: GlowState;
  className?: string;
  borderRadius?: string;
}

export default function RainbowGlowWrapper({
  children,
  glowState = "idle",
  className = "",
  borderRadius = "rounded-xl",
}: RainbowGlowWrapperProps) {
  const [internalState, setInternalState] = useState<GlowState>("idle");

  useEffect(() => {
    if (glowState === "done") {
      setInternalState("done");
      const t = setTimeout(() => setInternalState("idle"), 1200);
      return () => clearTimeout(t);
    }
    setInternalState(glowState);
  }, [glowState]);

  const baseClasses = cn(
    "relative transition-all duration-700 backdrop-blur-md border overflow-hidden",
    borderRadius,
    className
  );

  const isGlowing = internalState === "processing" || internalState === "listening";

  return (
    <>
      <style jsx>{`
        /* --- Keyframes --- */
        @keyframes aurora-x {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        @keyframes aurora-y {
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
        @keyframes aurora-rotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes breathe {
          0%, 100% {
            opacity: 0.9;
          }
          50% {
            opacity: 1;
          }
        }

        /* --- Layers --- */
        .aurora-layer {
          position: absolute;
          inset: -40%;
          filter: blur(50px);
          mix-blend-mode: screen;
          background-size: 400% 400%;
          animation: breathe 6s ease-in-out infinite;
        }

        .aurora-layer.layer1 {
          background: linear-gradient(
            270deg,
            #ff48f0,
            #8dd9ff,
            #5fff9f,
            #ffe158,
            #ff48f0
          );
          animation: aurora-x 6s ease-in-out infinite, breathe 6s ease-in-out infinite;
          opacity: 0.9;
        }

        .aurora-layer.layer2 {
          background: linear-gradient(
            120deg,
            #ff66f5,
            #5ecbff,
            #73ff6b,
            #ffed60,
            #ff66f5
          );
          animation: aurora-y 10s ease-in-out infinite, breathe 7s ease-in-out infinite;
          opacity: 0.75;
        }

        .aurora-layer.layer3 {
          background: conic-gradient(
            from 0deg,
            #ff9dfb,
            #91d4ff,
            #9effc4,
            #fff59e,
            #ff9dfb
          );
          animation: aurora-rotate 30s linear infinite, breathe 8s ease-in-out infinite;
          opacity: 0.6;
        }
      `}</style>

      <div
        className={baseClasses}
        style={{
          borderColor:
            internalState === "done"
              ? "rgba(34,197,94,0.9)"
              : "rgba(255,255,255,0.3)",
          boxShadow:
            internalState === "done"
              ? "0 0 35px rgba(34,197,94,0.7)"
              : isGlowing
                ? "0 0 40px rgba(180,200,255,0.4)"
                : "none",
        }}
      >
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
