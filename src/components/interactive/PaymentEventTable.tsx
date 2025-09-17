"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getUserProfile, type UserProfile } from "@/lib/utils";

type Row = {
  date_created: string;
  payment_status: string;
  payment_session?: {
    purchase?: {
      product?: {
        name?: string;
      };
    };
  };
};

type Props = {
  directusUrl: string;
  readToken?: string;
};

export default function PaymentEventTable({ directusUrl, readToken }: Props) {
  const [sessionId, setSessionId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<UserProfile | null>(null);

  const fetchEvents = async (session?: string) => {
    setLoading(true);
    setError(null);
    setRows([]);

    try {
      const base = new URL(`${directusUrl}/items/payment_event`);
      base.searchParams.set(
        "fields",
        "date_created,payment_status,payment_session.purchase.product.name"
      );
      base.searchParams.append("sort[]", "-date_created");

      if (session?.trim()) {
        base.searchParams.set("filter[stripe_session_id][_eq]", session.trim());
      }

      // filter by current user ID
      if (user?.id) {
        base.searchParams.set(
          "filter[payment_session][purchase][user][_eq]",
          user.id
        );
      }

      const res = await fetch(base.toString(), {
        headers: {
          ...(readToken ? { Authorization: `Bearer ${readToken}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`Directus ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  // fetch user profile on mount
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const userProfile = await getUserProfile(directusUrl);
      if (!cancelled) {
        setUser(userProfile);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [directusUrl]);

  // load events when user is available
  React.useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents(sessionId);
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Payment Events</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-4 flex-wrap">
          <div className="space-y-2">
            <Label htmlFor="session">Stripe Session ID</Label>
            <Input
              id="session"
              placeholder="cs_test_123..."
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading}>
              {loading ? "Loading..." : "Search"}
            </Button>
          </div>
        </form>

        <Separator className="my-6" />

        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

        {rows.length === 0 && !loading && !error && (
          <div className="text-sm text-muted-foreground">No results found.</div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {new Date(r.date_created).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      {r.payment_session?.purchase?.product?.name ?? "—"}
                    </td>
                    <td className="py-2">
                      <Badge
                        variant={
                          r.payment_status === "paid" ? "default" : "secondary"
                        }
                      >
                        {r.payment_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
