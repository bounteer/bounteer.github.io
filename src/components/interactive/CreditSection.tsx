"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserProfile, getUserCredits } from "@/lib/utils";

type Props = {
  directusUrl: string;
  className?: string;
};

type Credits = {
  used: number;
  remaining: number;
};

export default function CreditSection({ directusUrl, className }: Props) {
  const [credits, setCredits] = React.useState<Credits | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadCredits() {
      try {
        setLoading(true);
        const user = await getUserProfile(directusUrl);
        if (user) {
          const userCredits = await getUserCredits(user.id, directusUrl);
          setCredits(userCredits);
        } else {
          setCredits({ used: 0, remaining: 0 });
        }
        setError(null);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e.message || String(e));
          setCredits({ used: 0, remaining: 0 });
        }
      } finally {
        setLoading(false);
      }
    }

    loadCredits();
    return () => controller.abort();
  }, [directusUrl]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-40" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Your Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load credits: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const totalCredits = (credits?.used || 0) + (credits?.remaining || 0);
  const progressPercentage = totalCredits > 0 ? ((credits?.remaining || 0) / totalCredits) * 100 : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {credits?.remaining || 0}/{totalCredits} credits available
          </CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = '/dashboard/role-fit-index/top-up/'}
          >
            Top Up
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={progressPercentage} className="h-3" />
      </CardContent>
    </Card>
  );
}