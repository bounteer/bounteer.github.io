"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"; // Adjust this import path if necessary

export type GlowState = "idle" | "listening" | "processing";

interface GlowCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  glowState?: GlowState;
  primaryColor?: string; // used for idle/listening glows
  accentColor?: string; // used for processing ring
  glowSize?: number; // general glow intensity (for box-shadows)
  ringThickness?: number; // thickness of the active border ring
  ambient?: boolean; // toggle for background ambient glow (idle state)
}

const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  (
    {
      className,
      glowState = "idle",
      primaryColor = "#7afcff", // Default to a light cyan
      accentColor = "#ffcc00", // Default to a golden yellow
      glowSize = 12,
      ringThickness = 2,
      ambient = true,
      ...props
    },
    ref
  ) => {
    const [internalState, setInternalState] = React.useState<GlowState>(glowState);
    React.useEffect(() => setInternalState(glowState), [glowState]);

    const resolvedBorderRadius = props.style?.borderRadius || "var(--radius)";

    return (
      <>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @keyframes glowCardIdleHue {
              0% { filter: hue-rotate(0deg); }
              100% { filter: hue-rotate(360deg); }
            }

            @keyframes glowCardBreathingGlow {
              0%, 100% {
                opacity: 0.8;
                box-shadow:
                  0 0 ${glowSize}px ${hexWithAlpha(primaryColor, 0.5)},
                  0 0 ${glowSize * 2}px ${hexWithAlpha(primaryColor, 0.35)};
              }
              50% {
                opacity: 1;
                box-shadow:
                  0 0 ${glowSize * 2}px ${hexWithAlpha(primaryColor, 0.8)},
                  0 0 ${glowSize * 4}px ${hexWithAlpha(primaryColor, 0.6)};
              }
            }

            @keyframes glowCardProcessingBackground {
              0% {
                background: linear-gradient(45deg, 
                  ${hexWithAlpha(primaryColor, 0.3)} 0%, 
                  ${hexWithAlpha(primaryColor, 0.2)} 25%, 
                  ${hexWithAlpha(primaryColor, 0.35)} 50%, 
                  ${hexWithAlpha(primaryColor, 0.25)} 75%, 
                  ${hexWithAlpha(primaryColor, 0.3)} 100%),
                  hsl(var(--card));
              }
              25% {
                background: radial-gradient(ellipse at top left, 
                  ${hexWithAlpha(primaryColor, 0.4)} 0%, 
                  ${hexWithAlpha(primaryColor, 0.2)} 50%, 
                  ${hexWithAlpha(primaryColor, 0.35)} 100%),
                  hsl(var(--card));
              }
              50% {
                background: linear-gradient(135deg, 
                  ${hexWithAlpha(primaryColor, 0.35)} 0%, 
                  ${hexWithAlpha(primaryColor, 0.4)} 30%, 
                  ${hexWithAlpha(primaryColor, 0.25)} 70%, 
                  ${hexWithAlpha(primaryColor, 0.35)} 100%),
                  hsl(var(--card));
              }
              75% {
                background: radial-gradient(ellipse at bottom right, 
                  ${hexWithAlpha(primaryColor, 0.4)} 0%, 
                  ${hexWithAlpha(primaryColor, 0.25)} 40%, 
                  ${hexWithAlpha(primaryColor, 0.35)} 100%),
                  hsl(var(--card));
              }
              100% {
                background: linear-gradient(45deg, 
                  ${hexWithAlpha(primaryColor, 0.3)} 0%, 
                  ${hexWithAlpha(primaryColor, 0.2)} 25%, 
                  ${hexWithAlpha(primaryColor, 0.35)} 50%, 
                  ${hexWithAlpha(primaryColor, 0.25)} 75%, 
                  ${hexWithAlpha(primaryColor, 0.3)} 100%),
                  hsl(var(--card));
              }
            }

            /* For the rotating accent border using a pseudo-element */
            @keyframes glowCardRotateBorder {
              0%   { transform: translate(-50%, -50%) rotate(0deg); }
              100% { transform: translate(-50%, -50%) rotate(360deg); }
            }

            @media (prefers-reduced-motion: reduce) {
              .glow-card-anim { animation: none !important; }
            }
          `,
          }}
        />

        <div
          ref={ref}
          className={cn(
            "relative overflow-hidden backdrop-blur-2xl border transition-all duration-700",
            className
          )}
          style={{
            // Apply radius to the outer container for consistency
            borderRadius: resolvedBorderRadius,
            // CSS custom props for alpha blends (similar to MagicGlowEffect)
            ["--primary-11" as any]: hexWithAlpha(primaryColor, 0.07),
            ["--primary-22" as any]: hexWithAlpha(primaryColor, 0.13),
            ["--primary-33" as any]: hexWithAlpha(primaryColor, 0.2),
            ["--primary-44" as any]: hexWithAlpha(primaryColor, 0.27),
            ["--primary-55" as any]: hexWithAlpha(primaryColor, 0.33),
            ["--primary-66" as any]: hexWithAlpha(primaryColor, 0.4),

            borderWidth: internalState === "idle" ? 2 : 3,
            borderColor:
              internalState === "idle"
                ? "rgba(255,255,255,0.12)"
                : primaryColor,
            boxShadow:
              internalState === "idle"
                ? `0 0 ${glowSize}px rgba(255,255,255,0.10)`
                : `0 0 ${glowSize * 1.5}px ${hexWithAlpha(primaryColor, 0.6)}`,
            animation:
              internalState === "idle" ? "glowCardIdleHue 14s linear infinite" : undefined,
          }}
        >
          {/* Ambient halo (only in idle state) */}
          {ambient && internalState === "idle" && (
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

          {/* Listening: breathing border */}
          {internalState === "listening" && (
            <div
              className="glow-card-anim"
              style={{
                position: "absolute",
                // This div acts as the glowing border
                inset: `-${ringThickness}px`,
                borderRadius: "inherit",
                border: `${ringThickness}px solid ${hexWithAlpha(primaryColor, 0.7)}`,
                animation: "glowCardBreathingGlow 3.4s ease-in-out infinite",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />
          )}


          {/* The actual Shadcn Card component is placed inside */}
          <Card
            className={cn(
              "relative z-10 w-full h-full border-none shadow-none",
              internalState === "processing" ? "glow-card-anim" : "bg-card/95"
            )}
            style={{
              borderRadius: "inherit",
              ...(internalState === "processing" && {
                animation: "glowCardProcessingBackground 4s ease-in-out infinite",
                background: `${hexWithAlpha(primaryColor, 0.3)}, hsl(var(--card))`, // Fallback
              }),
            }}
            {...props}
          />
        </div>
      </>
    );
  }
);

GlowCard.displayName = "GlowCard";

export { GlowCard, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };


/** Add alpha to a 6-digit hex color, or pass-through rgba/hsla strings. */
function hexWithAlpha(color: string, alpha: number): string {
  if (/^rgba?\(/i.test(color)) {
    const parts = color.match(/[\d.]+/g);
    if (parts && (color.startsWith("rgba") || color.startsWith("rgb"))) {
      const [r, g, b] = parts.map(Number);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  if (/^hsla?\(/i.test(color)) return color;

  let c = color.replace("#", "");
  if (c.length === 3) {
    c = c
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (c.length !== 6) {
    return color;
  }
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}