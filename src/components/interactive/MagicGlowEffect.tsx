"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type GlowState = "idle" | "listening" | "processing";

interface MagicGlowEffectProps {
  children: React.ReactNode;
  glowState?: GlowState;
  className?: string;
  borderRadius?: string; // tailwind radius class for the host
  primaryColor?: string; // used for idle/listening
  accentColor?: string; // used for processing ring
  glowSize?: number; // general glow intensity
  ringThickness?: number; // processing ring thickness (px)
  ambient?: boolean;
}

export default function MagicGlowEffect({
  children,
  glowState = "idle",
  className = "",
  borderRadius = "rounded-xl",
  primaryColor = "#7afcff",
  accentColor = "#ffcc00",
  glowSize = 12,
  ringThickness = 2,
  ambient = true,
}: MagicGlowEffectProps) {
  const [internalState, setInternalState] = useState<GlowState>("idle");
  useEffect(() => setInternalState(glowState), [glowState]);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes idleHue {
            0% { filter: hue-rotate(0deg); }
            100% { filter: hue-rotate(360deg); }
          }

          /* Listening: breathing border (primary only) */
          @keyframes breathingGlow {
            0%, 100% {
              opacity: 0.7;
              box-shadow:
                0 0 ${glowSize}px var(--primary-33),
                0 0 ${glowSize * 2}px var(--primary-22);
            }
            50% {
              opacity: 1;
              box-shadow:
                0 0 ${glowSize * 2}px var(--primary-66),
                0 0 ${glowSize * 4}px var(--primary-44);
            }
          }

          /* Processing: primary color overlay animation */
          @keyframes primaryOverlay {
            0%, 100% {
              opacity: 0.2;
              background: var(--primary-22);
            }
            50% {
              opacity: 0.4;
              background: var(--primary-33);
            }
          }

          /* Processing: inner glow animation */
          @keyframes innerGlow {
            0%, 100% {
              box-shadow: inset 0 0 ${glowSize}px var(--primary-22), inset 0 0 ${glowSize * 2}px var(--primary-11);
            }
            50% {
              box-shadow: inset 0 0 ${glowSize * 2}px var(--primary-33), inset 0 0 ${glowSize * 3}px var(--primary-22);
            }
          }

          /* Respect reduced motion */
          @media (prefers-reduced-motion: reduce) {
            .mge-anim { animation: none !important; }
          }
        `,
        }}
      />

      <div
        className={cn(
          "relative overflow-hidden backdrop-blur-2xl border transition-all duration-700",
          borderRadius,
          className
        )}
        style={{
          // CSS custom props for alpha blends (used in breathing)
          // (We precompute a few alpha variants of primary.)
          ["--primary-11" as any]: hexWithAlpha(primaryColor, 0.07),
          ["--primary-22" as any]: hexWithAlpha(primaryColor, 0.13),
          ["--primary-33" as any]: hexWithAlpha(primaryColor, 0.2),
          ["--primary-44" as any]: hexWithAlpha(primaryColor, 0.27),
          ["--primary-55" as any]: hexWithAlpha(primaryColor, 0.33),
          ["--primary-66" as any]: hexWithAlpha(primaryColor, 0.4),

          borderWidth: internalState === "idle" ? 1 : 2,
          borderColor:
            internalState === "idle"
              ? "rgba(255,255,255,0.12)"
              : primaryColor,
          boxShadow:
            internalState === "idle"
              ? `0 0 ${glowSize}px rgba(255,255,255,0.10)`
              : `0 0 ${glowSize * 1.5}px ${hexWithAlpha(primaryColor, 0.33)}`,
          animation:
            internalState === "idle" ? "idleHue 14s linear infinite" : undefined,
        }}
      >
        {/* Ambient halo */}
        {ambient && (
          <div
            style={{
              position: "absolute",
              inset: "-20%",
              background:
                "radial-gradient(circle at center, rgba(255,255,255,0.22) 0%, rgba(195,220,255,0.14) 40%, rgba(255,255,255,0) 70%)",
              filter: "blur(40px)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Listening: breathing glow only (border is on main container) */}
        {internalState === "listening" && (
          <div
            className="mge-anim"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              animation: "breathingGlow 3.4s ease-in-out infinite",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        )}

        {/* Processing: primary color overlay with inner glow */}
        {internalState === "processing" && (
          <>
            <div
              className="mge-anim"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                border: `2px solid ${hexWithAlpha(primaryColor, 0.6)}`,
                animation: "primaryOverlay 3s ease-in-out infinite",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
            <div
              className="mge-anim"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                animation: "innerGlow 2.5s ease-in-out infinite",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />
          </>
        )}

        <div className="relative z-10">{children}</div>
      </div>
    </>
  );
}

/** Add alpha to a 6-digit hex color, or pass-through rgba/hsla strings. */
function hexWithAlpha(color: string, alpha: number): string {
  // If already rgba/hsla, just inject alpha if possible
  if (/^rgba?\(/i.test(color)) {
    // rgba(r,g,b,a?) -> set a to alpha
    const parts = color.match(/[\d.]+/g);
    if (parts && (color.startsWith("rgba") || color.startsWith("rgb"))) {
      const [r, g, b] = parts.map(Number);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  if (/^hsla?\(/i.test(color)) return color; // leave hsla as-is

  // Handle #rgb/#rrggbb
  let c = color.replace("#", "");
  if (c.length === 3) {
    c = c
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (c.length !== 6) {
    // Fallback: return original if unexpected
    return color;
  }
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}