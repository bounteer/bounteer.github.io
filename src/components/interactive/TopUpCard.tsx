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
import { Loader2 } from "lucide-react"; // add spinner
import { EXTERNAL } from "@/constant";

type Product = {
  id: string | number;
  name: string;
  price: number;
  description?: string | null;
  category?: string | null;
  stripe_product_id?: string | null;
};

type Props = {
  directusUrl: string;
  readToken?: string;
  category?: string;
  limit?: number;
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

  // NEW: track which product is redirecting
  const [redirectingId, setRedirectingId] = React.useState<string | number | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          fields: "id,name,price,description,category,stripe_product_id",
          limit: String(limit),
          sort: "price",
        });

        if (category) {
          params.set("filter[category][_eq]", category);
        }

        const res = await fetch(`${directusUrl}/items/product?${params}`, {
          signal: controller.signal,
          headers: {
            ...(readToken ? { Authorization: `Bearer ${readToken}` } : {}),
          },
        });

        if (!res.ok) throw new Error(`Directus ${res.status} ${res.statusText}`);

        const json = (await res.json()) as { data: Product[] };
        let data = json.data || [];

        if (data.length === 0 && category) {
          const r = await fetch(
            `${directusUrl}/items/product?fields=id,name,price,description,category,stripe_product_id&limit=${limit}&sort=price`,
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
      setRedirectingId(p.id); // show banner & disable button

      // 1. Fetch the authenticated user from Directus
      const meRes = await fetch(`${EXTERNAL.directus_url}/users/me`, {
        method: "GET",
        credentials: 'include', // required for getting user data
      });

      if (!meRes.ok) {
        throw new Error(`Failed to fetch user: ${meRes.status} ${meRes.statusText}`);
      }

      const meData = await meRes.json();
      const email = meData.data.email;
      console.log(email)

      const webhookUrl = "https://n8n.bounteer.com/webhook/9d62c0a4-4078-4ba4-b2a8-6d4f6982d339";
      // const webhookUrl = "https://n8n.bounteer.com/webhook-test/9d62c0a4-4078-4ba4-b2a8-6d4f6982d339";
      const params = new URLSearchParams({
        product_id: String(p.stripe_product_id),
        id: String(p.id),
        email: email,

      });

      const res = await fetch(`${webhookUrl}?${params.toString()}`, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(`Webhook failed: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (data.payment_url) {
        // optional: small delay so the UI shows the state briefly
        // await new Promise((r) => setTimeout(r, 200));
        window.location.href = data.payment_url;
      } else {
        throw new Error("No payment_url returned");
      }
    } catch (err) {
      console.error("Top-up failed", err);
      alert("Failed to process top-up. Please try again.");
      setRedirectingId(null); // reset on error
    }
  };

  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {/* Redirecting banner */}
      {redirectingId !== null && (
        <div className="sm:col-span-2 lg:col-span-4 text-sm rounded-md border bg-muted/40 px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting to secure checkout…
        </div>
      )}

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
        items?.map((p) => {
          const isRedirecting = redirectingId === p.id;
          return (
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
                <Button
                  className="w-full"
                  onClick={() => onButtonClick(p)}
                  disabled={isRedirecting}
                >
                  {isRedirecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    "Top Up"
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
    </div>
  );
}
