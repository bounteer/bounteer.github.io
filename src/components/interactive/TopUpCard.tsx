"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Product = {
  id: string | number;
  name: string;
  price: number;
  description?: string | null;
  category?: string | null;
};

type Props = {
  directusUrl: string;            // e.g. https://directus.bounteer.com
  readToken?: string;             // optional static read token
  category?: string;              // optional filter, e.g. "topup"
  limit?: number;                 // default 3
  className?: string;
};

export default function TopUpCard({
  directusUrl,
  readToken,
  category = "topup",
  limit = 3,
  className,
}: Props) {
  const [items, setItems] = React.useState<Product[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          fields: "id,name,price,description,category",
          limit: String(limit),
          sort: "price",
        });

        // Optional category filter (fallback to first 3 if none)
        if (category) {
          // Directus filter syntax
          params.set("filter[category][_eq]", category);
        }

        const res = await fetch(`${directusUrl}/items/product?${params}`, {
          signal: controller.signal,
          headers: {
            ...(readToken ? { Authorization: `Bearer ${readToken}` } : {}),
          },
        });

        if (!res.ok) {
          throw new Error(`Directus ${res.status} ${res.statusText}`);
        }

        const json = (await res.json()) as { data: Product[] };
        let data = json.data || [];

        // If category returned nothing, get 3 products as fallback
        if (data.length === 0 && category) {
          const r = await fetch(
            `${directusUrl}/items/product?fields=id,name,price,description,category&limit=${limit}&sort=price`,
            {
              signal: controller.signal,
              headers: {
                ...(readToken ? { Authorization: `Bearer ${readToken}` } : {}),
              },
            }
          );
          const j = (await r.json()) as { data: Product[] };
          data = j.data || [];
        }

        setItems(data.slice(0, limit));
        setError(null);
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [directusUrl, readToken, category, limit]);

  const fmt = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });



  const onButtonClick = async (p: Product) => {
    try {
      // Call webhook
      const webhookUrl =
        "https://n8n.bounteer.com/webhook-test/9d62c0a4-4078-4ba4-b2a8-6d4f6982d339";
      const params = new URLSearchParams({
        product_id: String(p.id),
        id: String(p.id),
      });

      const res = await fetch(`${webhookUrl}?${params.toString()}`, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(`Webhook failed: ${res.status} ${res.statusText}`);
      }

      console.log(res);
      alert("Top-up successful!");
    } catch (err) {
      console.error("Top-up failed", err);
      alert("Failed to process top-up. Please try again.");
    }
  };


  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {loading &&
        Array.from({ length: limit }).map((_, i) => (
          <Card key={`s-${i}`} className="border">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-9 w-28" />
            </CardFooter>
          </Card>
        ))}

      {!loading && error && (
        <div className="sm:col-span-2 lg:col-span-3 text-sm text-destructive">
          Failed to load products: {error}
        </div>
      )}

      {!loading &&
        !error &&
        items?.map((p) => (
          <Card key={p.id} className="border bg-white">
            <CardHeader className="space-y-2">
              {p.category ? (
                <Badge variant="outline" className="shrink-0 w-fit">
                  {p.category}
                </Badge>
              ) : null}

              <CardTitle className="text-base">{p.name}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="text-3xl font-semibold tracking-tight">
                {fmt.format(p.price ?? 0)}
              </div>
              {p.description ? (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {p.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add credit to your account instantly.
                </p>
              )}
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <Button className="w-full" onClick={() => onButtonClick(p)}>
                Top Up
              </Button>
            </CardFooter>
          </Card>
        ))
      }
    </div >
  );
}
