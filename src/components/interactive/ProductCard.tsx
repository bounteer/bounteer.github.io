"use client";

import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

interface ProductCardProps {
  stage: string;
  title: string;
  subtitle: string;
  launchDate: string;
  currentStage: string;
  features: string[];
  buttonLabel: string;
  buttonHref: string;
}

export default function ProductCard({
  stage,
  title,
  subtitle,
  launchDate,
  currentStage,
  features,
  buttonLabel,
  buttonHref,
}: ProductCardProps) {
  return (
    <Card className="flex flex-col h-full shadow-md">
      {/* Header */}
      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-muted-foreground text-sm gap-1">
            <Clock className="h-4 w-4" />
            <span>{currentStage}</span>
          </div>
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700"
          >
            {launchDate}
          </Badge>
        </div>

        <h3 className="mt-2 text-lg font-semibold text-gray-900">
          {stage} · {title}
        </h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>

      {/* Features */}
      <CardContent className="flex-1 mt-2">
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          {features.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </CardContent>

      {/* CTA */}
      <CardFooter className="pt-3">
        <Button asChild className="w-full">
          <a href={buttonHref}>{buttonLabel}</a>
        </Button>
      </CardFooter>
    </Card>
  );
}
