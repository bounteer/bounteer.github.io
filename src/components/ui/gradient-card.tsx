"use client";
import React from 'react';
import { cn } from "../../lib/utils";
import { BackgroundGradientAnimation } from './background-gradient-animation';

interface GradientCardProps {
  children: React.ReactNode;
  className?: string;
  gradientBackgroundStart?: string;
  gradientBackgroundEnd?: string;
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
  fifthColor?: string;
  pointerColor?: string;
  interactive?: boolean;
}

export const GradientCard = ({
  children,
  className,
  gradientBackgroundStart = "rgb(108, 0, 162)",
  gradientBackgroundEnd = "rgb(0, 17, 82)",
  firstColor = "18, 113, 255",
  secondColor = "221, 74, 255", 
  thirdColor = "100, 220, 255",
  fourthColor = "200, 50, 50",
  fifthColor = "180, 180, 50",
  pointerColor = "140, 100, 255",
  interactive = true,
}: GradientCardProps) => {
  return (
    <div className={cn("rounded-lg overflow-hidden shadow-lg", className)}>
      <BackgroundGradientAnimation
        containerClassName="h-full w-full rounded-4x"
        gradientBackgroundStart={gradientBackgroundStart}
        gradientBackgroundEnd={gradientBackgroundEnd}
        firstColor={firstColor}
        secondColor={secondColor}
        thirdColor={thirdColor}
        fourthColor={fourthColor}
        fifthColor={fifthColor}
        pointerColor={pointerColor}
        interactive={interactive}
      >
        <div className="relative z-10 p-6 h-full flex items-center justify-center">
          {children}
        </div>
      </BackgroundGradientAnimation>
    </div>
  );
};