"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type GlowState = "idle" | "listening" | "processing" | "done";

interface RainbowGlowWrapperProps {
  children: React.ReactNode;
  glowState?: GlowState;
  isActive?: boolean;
  duration?: number;
  intensity?: "subtle" | "medium" | "strong";
  animationSpeed?: number;
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
      // Flash "done" then fade back to idle
      setInternalState("done");
      const t = setTimeout(() => setInternalState("idle"), 1200);
      return () => clearTimeout(t);
    }
    setInternalState(glowState);
  }, [glowState]);

  // Keyframes for pastel rainbow animation
  const rainbowKeyframes = `
    @keyframes pastel-shift {
      0% { box-shadow: 0 0 12px 4px rgba(255,153,240,0.5); border-color: rgba(255,153,240,0.6); }
      25% { box-shadow: 0 0 12px 6px rgba(173,216,255,0.5); border-color: rgba(173,216,255,0.6); }
      50% { box-shadow: 0 0 12px 6px rgba(180,255,200,0.5); border-color: rgba(180,255,200,0.6); }
      75% { box-shadow: 0 0 12px 6px rgba(255,235,153,0.5); border-color: rgba(255,235,153,0.6); }
      100% { box-shadow: 0 0 12px 4px rgba(255,200,200,0.5); border-color: rgba(255,200,200,0.6); }
    }
  `;

  const baseClasses = cn(
    "relative transition-all backdrop-blur-md border",
    borderRadius,
    className
  );

  const stateStyles: Record<GlowState, React.CSSProperties> = {
    idle: {
      borderColor: "rgba(200,200,200,0.3)",
      boxShadow: "none",
    },
    listening: {
      animation: "pulse 3s ease-in-out infinite",
      borderColor: "rgba(200,200,255,0.4)",
      boxShadow: "0 0 8px rgba(200,200,255,0.3)",
    },
    processing: {
      animation: "pastel-shift 6s ease-in-out infinite",
    },
    done: {
      borderColor: "rgba(34,197,94,0.8)",
      boxShadow: "0 0 20px rgba(34,197,94,0.6)",
      transition: "all 0.6s ease",
    },
  };

  return (
    <>
      <style>{rainbowKeyframes}</style>
      <div className={baseClasses} style={stateStyles[internalState]}>
        {children}
      </div>
    </>
  );
}
