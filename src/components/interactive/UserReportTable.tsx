"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { EXTERNAL } from "@/constant";
import { getUserProfile, type UserProfile } from "@/lib/utils";

type Props = {
  /** Optional: items per page (default 10) */
  pageSize?: number;
};

type ReportRow = {
  id: number;
  index: number;
  weighted_index?: number;
  date_created: string;
  opt_in_talent_pool?: boolean;
  submission?: {
    id: number;
    cv_file?: string; // Directus file UUID
    job_description?: {
      id?: string;
      role_name?: string;
      name?: string;
      company?: string;
    };
  };
};

export default function UserReportTable({ pageSize = 10 }: Props) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState(""); // client-side text filter
  const [page, setPage] = useState(1); // client-side pagination
  const [user, setUser] = useState<UserProfile | null>(null);

  // Keep a stable local alias so we can safely reference it in deps
  const DIRECTUS_URL = EXTERNAL.directus_url;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        // First, get the current user profile
        const userProfile = await getUserProfile(DIRECTUS_URL);
        if (!cancelled) setUser(userProfile);

        if (!userProfile?.id) {
          throw new Error("User not authenticated");
        }

        // fields we need
        const fields =
          `fields=*,` +
          `submission.id,` +
          `submission.cv_file,` +
          `submission.job_description.id,` +
          `submission.job_description.role_name`;

        // filter by report.submission.user.id = userId
        const filter = `filter[submission][user_created][id][_eq]=${encodeURIComponent(userProfile.id)}`;

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
  }, [DIRECTUS_URL]);

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

  const downloadCV = async (fileId: string) => {
    try {
      // First get file info to get the filename
      const fileInfoRes = await fetch(`${DIRECTUS_URL}/files/${fileId}`, {
        credentials: "include",
      });

      let filename = 'cv.pdf';
      if (fileInfoRes.ok) {
        const fileInfo = await fileInfoRes.json();
        filename = fileInfo?.data?.filename_download || fileInfo?.data?.title || 'cv.pdf';
      }

      // Fetch the file
      const fileRes = await fetch(`${DIRECTUS_URL}/assets/${fileId}`, {
        credentials: "include",
      });

      if (!fileRes.ok) {
        throw new Error('Failed to download CV');
      }

      // Create blob and download
      const blob = await fileRes.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading CV:', error);
      alert('Failed to download CV. Please try again.');
    }
  };

  return (
    <Card className="rounded-2xl shadow-md">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <CardTitle>My Role Fit Index Reports</CardTitle>
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
      </CardHeader>

      <CardContent>
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}

        {!loading && !err && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">Date</TableHead>
                  <TableHead className="w-18">RFI</TableHead>
                  <TableHead className="w-18">WRFI</TableHead>
                  <TableHead>Job Description (JD)</TableHead>
                  <TableHead className="w-32">Talent Pool</TableHead>
                  <TableHead className="w-32">JD Link</TableHead>
                  <TableHead className="w-32">CV Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageSlice.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
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
                      "Untitled";
                    const date = new Date(r.date_created).toLocaleString();
                    const cvFileId = r.submission?.cv_file;
                    const jdHref = r.submission?.job_description?.id
                      ? `/role-fit-index/job-description?id=${r.submission.job_description.id}`
                      : null;

                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => window.location.href = `/role-fit-index/report?id=${r.id}`}
                      >
                        <TableCell>{date}</TableCell>
                        <TableCell >{r.index}</TableCell>
                        <TableCell >{r.weighted_index || "—"}</TableCell>
                        <TableCell>{jobName}</TableCell>
                        <TableCell>
                          {r.index > 75 ? (
                            r.opt_in_talent_pool ? (
                              <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
                                ✓ Opted In
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                Not Opted In
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-gray-400 border-gray-300">
                              Not Eligible
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell >
                          <Button
                            asChild
                            variant="secondary"
                            size="sm"
                            disabled={!jdHref}
                            title={jdHref ? "View Job Description" : "No JD available"}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={jdHref || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" /> View JD
                            </a>
                          </Button>
                        </TableCell>
                        <TableCell >
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!cvFileId}
                            title={cvFileId ? "Download CV" : "No CV"}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cvFileId) downloadCV(cvFileId);
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" /> Download CV
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
      </CardContent>
    </Card>
  );
}
