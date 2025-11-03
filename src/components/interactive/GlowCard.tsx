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
} from "@/components/ui/card";

export type GlowState = "idle" | "listening" | "processing";

interface GlowCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  glowState?: GlowState;
  color?: string;
  ringThickness?: number;
  glowRadius?: number;
  padding?: boolean;
}

const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  (
    {
      className,
      glowState = "idle",
      color = "#7afcff",
      ringThickness = 4,
      glowRadius = 24,
      padding = true,
      ...props
    },
    ref
  ) => {
    const borderRadius = (props.style?.borderRadius as string) || "1.5rem";
    const borderColor = hexWithAlpha(color, 0.95);

    const outerGlow = `
      0 0 ${glowRadius}px ${hexWithAlpha(color, 0.45)},
      0 0 ${glowRadius * 2}px ${hexWithAlpha(color, 0.3)},
      0 0 ${glowRadius * 3}px ${hexWithAlpha(color, 0.18)}
    `;
    const innerGlow = `
      inset 0 0 ${glowRadius * 1.2}px ${hexWithAlpha(color, 0.7)},
      inset 0 0 ${glowRadius * 1.8}px ${hexWithAlpha(color, 0.5)},
      inset 0 0 ${glowRadius * 2.5}px ${hexWithAlpha(color, 0.3)}
    `;

    const isActive = glowState !== "idle";

    return (
      <div
        ref={ref}
        className={cn("relative transition-all duration-500 ease-in-out", className)}
        style={{ borderRadius }}
      >
        {/* === Shared border ring always rendered (fades in/out) === */}
        <div
          className="absolute inset-0 z-30 pointer-events-none transition-all duration-700 ease-in-out"
          style={{
            borderRadius,
            border: isActive ? `${ringThickness}px solid ${borderColor}` : "none",
            opacity: isActive ? 1 : 0,
          }}
        />

        {/* === OUTER glow layer === */}
        <div
          className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-700 ease-in-out"
          style={{
            borderRadius,
            boxShadow: outerGlow,
            opacity: glowState === "listening" ? 1 : 0,
          }}
        />

        {/* === INNER glow layer === */}
        <div
          className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-700 ease-in-out"
          style={{
            borderRadius,
            boxShadow: innerGlow,
            opacity: glowState === "processing" ? 1 : 0,
            animation:
              glowState === "processing"
                ? "gc_innerPulse 3s ease-in-out infinite"
                : "none",
          }}
        />

        {/* === Card content === */}
        <Card
          className={cn(
            "relative z-0 w-full h-full border border-border bg-card/85 backdrop-blur-sm shadow-sm overflow-hidden",
            !padding && "py-0",
            isActive && "border-transparent"
          )}
          style={{ borderRadius }}
          {...props}
        >
          {props.children}
        </Card>

        {/* Animations */}
        <style jsx>{`
          @keyframes gc_innerPulse {
            0%, 100% {
              box-shadow:
                inset 0 0 ${glowRadius}px ${hexWithAlpha(color, 0.4)},
                inset 0 0 ${glowRadius * 2}px ${hexWithAlpha(color, 0.25)};
            }
            50% {
              box-shadow:
                inset 0 0 ${glowRadius * 2}px ${hexWithAlpha(color, 0.9)},
                inset 0 0 ${glowRadius * 3}px ${hexWithAlpha(color, 0.6)};
            }
          }
        `}</style>
      </div>
    );
  }
);

GlowCard.displayName = "GlowCard";

export {
  GlowCard,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};

function hexWithAlpha(color: string, alpha: number): string {
  if (/^rgba?\(/i.test(color))
    return color.replace(/\)$/, '').replace(/^rgb\(/, 'rgba(') + `, ${alpha})`;
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const num = parseInt(hex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
