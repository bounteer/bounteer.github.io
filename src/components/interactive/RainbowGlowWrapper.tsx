"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RainbowGlowWrapperProps {
  children: React.ReactNode;
  isActive?: boolean;
  duration?: number; // Duration in milliseconds, default 10000 (10 seconds)
  className?: string;
  animationSpeed?: number; // Animation cycle speed in seconds, default 3
  intensity?: 'subtle' | 'medium' | 'strong'; // Glow intensity
  borderRadius?: string; // Custom border radius, defaults to 'rounded-lg'
}

export default function RainbowGlowWrapper({
  children,
  isActive = false,
  duration = 10000,
  className = "",
  animationSpeed = 3,
  intensity = 'subtle',
  borderRadius = 'rounded-lg'
}: RainbowGlowWrapperProps) {
  const [showGlow, setShowGlow] = useState(false);

  // Intensity configurations
  const intensityConfig = {
    subtle: {
      boxShadow: '0 0 8px {color1}, 0 0 12px {color2}',
      borderOpacity: 0.6,
      glowOpacity1: 0.4,
      glowOpacity2: 0.2
    },
    medium: {
      boxShadow: '0 0 12px {color1}, 0 0 20px {color2}',
      borderOpacity: 0.7,
      glowOpacity1: 0.6,
      glowOpacity2: 0.3
    },
    strong: {
      boxShadow: '0 0 20px {color1}, 0 0 30px {color2}, 0 0 40px {color3}',
      borderOpacity: 0.8,
      glowOpacity1: 0.8,
      glowOpacity2: 0.6,
      glowOpacity3: 0.4
    }
  };

  const config = intensityConfig[intensity];
  
  // Generate CSS keyframes based on intensity
  const generateKeyframes = () => {
    const colors = [
      [255, 0, 0],     // Red
      [255, 165, 0],   // Orange
      [255, 255, 0],   // Yellow
      [0, 255, 0],     // Green
      [0, 0, 255],     // Blue
      [75, 0, 130],    // Indigo
      [238, 130, 238]  // Violet
    ];

    return colors.map((color, index) => {
      const percentage = (index * 100 / (colors.length - 1)).toFixed(2);
      const [r, g, b] = color;
      
      let boxShadow = config.boxShadow
        .replace('{color1}', `rgba(${r}, ${g}, ${b}, ${config.glowOpacity1})`)
        .replace('{color2}', `rgba(${r}, ${g}, ${b}, ${config.glowOpacity2})`);
      
      if (intensity === 'strong') {
        boxShadow = boxShadow.replace('{color3}', `rgba(${r}, ${g}, ${b}, ${config.glowOpacity3 || 0.4})`);
      }

      return `
        ${percentage}% {
          box-shadow: ${boxShadow};
          border-color: rgba(${r}, ${g}, ${b}, ${config.borderOpacity});
        }
      `;
    }).join('');
  };

  const rainbowGlowStyles = `
    @keyframes rainbow-glow-${intensity} {
      ${generateKeyframes()}
    }
  `;

  useEffect(() => {
    if (isActive) {
      setShowGlow(true);
      const timeout = setTimeout(() => {
        setShowGlow(false);
      }, duration);

      return () => clearTimeout(timeout);
    } else {
      setShowGlow(false);
    }
  }, [isActive, duration]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: rainbowGlowStyles }} />
      <div
        className={cn("transition-all", borderRadius, className)}
        style={showGlow ? {
          animation: `rainbow-glow-${intensity} ${animationSpeed}s ease-in-out infinite`,
        } : {}}
      >
        {children}
      </div>
    </>
  );
}