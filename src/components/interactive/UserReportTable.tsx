"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { EXTERNAL } from "@/constant";

type Props = {
  /** Filter reports where report.submission.user.id === userId */
  userId: string;
  /** Optional: items per page (default 10) */
  pageSize?: number;
};

type ReportRow = {
  id: number;
  index: number;
  date_created: string;
  submission?: {
    id: number;
    cv_file?: string; // Directus file UUID
    job_description?: { role_name?: string; name?: string };
  };
};

export default function UserReportTable({ userId, pageSize = 10 }: Props) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState(""); // client-side text filter
  const [page, setPage] = useState(1); // client-side pagination

  // Keep a stable local alias so we can safely reference it in deps
  const DIRECTUS_URL = EXTERNAL.directus_url;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        // fields we need
        const fields =
          "fields=id,index,date_created,submission.id,submission.cv_file,submission.job_description.id,submission.job_description.role_name";

        // filter by report.submission.user.id = userId
        const filter = `filter[submission][user_created][id][_eq]=${encodeURIComponent(userId)}`;

        // sort newest first; no server-side limit so we can client-paginate
        const url = `${DIRECTUS_URL}/items/role_fit_index_report?${fields}&${filter}&sort[]=-date_created`;
        console.log(url);

        const res = await fetch(url, {
          signal: controller.signal,
          credentials: "include", // send Directus session cookies
        });
        if (!res.ok) throw new Error(`Directus ${res.status} ${res.statusText}`);
        const json = await res.json();
        if (!cancelled) setRows(Array.isArray(json.data) ? json.data : []);
      } catch (e: any) {
        if (!cancelled && e?.name !== "AbortError")
          setErr(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId, DIRECTUS_URL]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => {
      const jobName =
        r.submission?.job_description?.role_name ||
        r.submission?.job_description?.name ||
        "";
      return (
        jobName.toLowerCase().includes(needle) ||
        String(r.index).includes(needle) ||
        new Date(r.date_created).toLocaleString().toLowerCase().includes(needle)
      );
    });
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe, pageSize]);

  function cvHref(uuid?: string) {
    if (!uuid) return "";
    // With session cookies, no token needed in URL
    return `${DIRECTUS_URL}/assets/${uuid}`;
  }

  return (
    <Card className="p-6 rounded-2xl shadow-md">
      <div className="mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <h2 className="text-xl font-semibold">My Role Fit Index Reports</h2>
        <div className="ml-auto w-full md:w-72">
          <Input
            placeholder="Filter by job, index, date…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && !err && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Description</TableHead>
                <TableHead className="w-24 text-right">Index</TableHead>
                <TableHead className="w-56">Date Created</TableHead>
                <TableHead className="w-32 text-right">CV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageSlice.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-8 text-gray-500"
                  >
                    No reports found.
                  </TableCell>
                </TableRow>
              ) : (
                pageSlice.map((r) => {
                  const jobName =
                    r.submission?.job_description?.role_name ||
                    r.submission?.job_description?.name ||
                    "Unnamed Job";
                  const date = new Date(r.date_created).toLocaleString();
                  const href = cvHref(r.submission?.cv_file);

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{jobName}</TableCell>
                      <TableCell className="text-right">{r.index}</TableCell>
                      <TableCell>{date}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="secondary"
                          size="sm"
                          disabled={!href}
                          title={href ? "Open CV" : "No CV"}
                        >
                          <a
                            href={href || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" /> View CV
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-500">
              {filtered.length} result{filtered.length === 1 ? "" : "s"} · Page{" "}
              {pageSafe} / {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
