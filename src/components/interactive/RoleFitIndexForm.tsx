"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import DragAndDropUpload from "./DragAndDropUpload";
import { Loader2, Check, X } from "lucide-react";
import { EXTERNAL } from '@/constant';
import { loadCredits, consumeCredit, getLoginUrl, type Credits, type UserProfile, consumeUserCredit } from '@/lib/utils';

const schema = z.object({
  jobDescription: z.string().min(1, "Paste the JD or provide a URL"),
  cv: z.any().refine((file) => file instanceof File, "Please upload a CV"),
});

type FormValues = z.infer<typeof schema>;

type Me = UserProfile | null;

export default function RoleFitForm() {
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 idle, 1 uploading, 2 analyzing
  const [submitting, setSubmitting] = useState(false);
  const [buttonText, setButtonText] = useState("Analyze Role Fit Now");
  const [error, setError] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState<
    "submitted" | "parsed_jd" | "generated_report" | "redirecting"
  >("submitted");
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // auth + quota states
  const [me, setMe] = useState<Me>(null);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [credits, setCredits] = useState<Credits>({ used: 0, remaining: 2 });

  const wsRef = useRef<WebSocket | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { jobDescription: "", cv: null },
  });

  const progressSteps = [
    "Upload CV",
    "Parse Job Description",
    "Generate Report",
    "Redirect to Report",
  ];

  // Map backend statuses → step index
  const statusToStep: Record<string, number> = {
    submitted: 1,
    parsed_jd: 2,
    generated_report: 3,
    redirecting: 3,
  };

  const currentStepIdx = statusToStep[submissionStatus] ?? 0;
  const percentDone = ((currentStepIdx + 1) / progressSteps.length) * 100;

  const DIRECTUS_URL = EXTERNAL.directus_url;


  // Helper function to get authorization header
  const getAuthHeaders = (): Record<string, string> => {
    return isAuthed
      ? {} // No auth header needed for authenticated users (using session cookies)
      : { Authorization: `Bearer ${EXTERNAL.directus_key}` }; // Guest token for unauthenticated users
  };

  // --- Auth & Credit loading ---
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        console.log('Loading credits - current localStorage:', localStorage.getItem('role-fit-index-credits'));
        const result = await loadCredits(DIRECTUS_URL);
        console.log('Load credits result:', result);

        if (cancelled) return;

        setMe(result.user);
        setIsAuthed(result.isAuthenticated);
        setCredits(result.credits);
        console.log('Set credits state to:', result.credits);
      } catch {
        if (!cancelled) {
          setIsAuthed(false);
          setMe(null);
          setCredits({ used: 0, remaining: 2 }); // Default guest credits
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [DIRECTUS_URL]);

  /** Compute SHA-256 (hex) of a File/Blob */
  async function sha256OfFile(file: Blob): Promise<string> {
    const buf = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(hashBuf);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      const h = bytes[i].toString(16).padStart(2, "0");
      hex += h;
    }
    return hex;
  }

  /** Try to find an existing file by SHA in your file_checksum collection */
  async function findFileIdBySha(sha: string): Promise<string | null> {
    const url = new URL(`${DIRECTUS_URL}/items/file_checksum`);
    console.log(url);
    url.searchParams.set("filter[sha256][_eq]", sha);
    // return only the related file id to keep payload small
    url.searchParams.set("fields", "file");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      credentials: isAuthed ? "include" : "omit",
      headers: getAuthHeaders(),
    });
    const js = await res.json();
    if (!res.ok) throw new Error(js?.errors?.[0]?.message || "Checksum lookup failed");

    const item = js?.data?.[0];
    return item?.file ?? null;
  }

  /** Upload CV file to Directus (only if not already stored by sha) */
  const uploadFile = async (file: File) => {
    // 1) hash
    const sha = await sha256OfFile(file);
    console.log(sha)
    // 2) check if we already have it
    const existingId = await findFileIdBySha(sha);
    console.log("existingId: " + existingId)

    if (existingId) return existingId;
    console.log("no same sha file found")

    // 3) upload
    const fd = new FormData();
    fd.append("file", file, file.name || "cv.pdf");
    const uploadRes = await fetch(`${DIRECTUS_URL}/files`, {
      method: "POST",
      credentials: isAuthed ? "include" : "omit",
      headers: getAuthHeaders(),
      body: fd,
    });
    const uploadJs = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadJs?.errors?.[0]?.message || "File upload failed");
    }
    const fileId = uploadJs.data.id as string;

    return fileId;
  };

  /** Create submission */
  const createSubmission = async (jd: string, fileId: string) => {
    // Consume credit
    try {
      console.log('About to consume credit - current localStorage:', localStorage.getItem('role-fit-index-credits'));
      const result = await consumeCredit(DIRECTUS_URL);
      console.log('Consume credit result:', result);
      if (result.success) {
        setCredits(result.credits);
        console.log('Updated credits state:', result.credits);
        console.log('New localStorage:', localStorage.getItem('role-fit-index-credits'));
      }
    } catch (error) {
      console.error('Failed to consume credit:', error);
    }

    // consume credit if user was logged in
    if (isAuthed && me != null) {
      await consumeUserCredit(me.id, DIRECTUS_URL);
    }


    const body = {
      cv_file: fileId,
      status: "submitted",
      job_description: { raw_input: jd },
      ...(isAuthed && me?.id ? { user: me.id } : {}),
    };

    const res = await fetch(`${DIRECTUS_URL}/items/role_fit_index_submission`, {
      method: "POST",
      credentials: isAuthed ? "include" : "omit",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const js = await res.json();
    if (!res.ok) throw new Error(js?.errors?.[0]?.message || "Submission failed");
    return js.data.id as string;
  };

  /** Poll Directus for report */
  const pollReport = async (id: string) => {
    const start = Date.now();
    const ttl = 90_000;
    while (Date.now() - start < ttl) {
      try {
        const url = new URL(`${DIRECTUS_URL}/items/role_fit_index_report`);
        url.searchParams.set("limit", "1");
        url.searchParams.set("sort", "-date_created");
        url.searchParams.set("filter[submission][_eq]", id);
        const res = await fetch(url.toString(), {
          credentials: isAuthed ? "include" : "omit",
          headers: getAuthHeaders(),
        });
        const js = await res.json();
        console.log(res);
        console.log(js);
        if (res.ok && js?.data?.length) {


          // Reset form state before leaving
          form.reset({ jobDescription: "", cv: null });
          setStep(0);
          setButtonText("Analyze Role Fit Now");
          setSubmissionStatus("submitted");
          setSubmissionId(null);

          // Redirect
          setSubmissionStatus("redirecting");
          window.location.href = `/role-fit-index/report?id=${encodeURIComponent(
            js.data[0].id
          )}`;
          return;
        }
      } catch { }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setError("Still analyzing… Please refresh later.");
  };

  /** Subscribe via WebSocket */
  const subscribeWS = (id: string) => {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const u = new URL(DIRECTUS_URL);
        u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
        u.pathname = "/websocket";
        u.search = "";

        const ws = new WebSocket(u.toString());
        wsRef.current = ws;

        setSubmissionStatus("submitted");

        const timeout = setTimeout(() => {
          try { ws.close(); } catch { }
          reject(new Error("WS timeout"));
        }, 90_000);

        ws.onopen = () => {
          const authToken = isAuthed ? undefined : EXTERNAL.directus_key;
          if (authToken) {
            ws.send(JSON.stringify({ type: "auth", access_token: authToken }));
          }
        };

        ws.onmessage = async (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.type === "auth" && msg.status === "ok") {
            ws.send(
              JSON.stringify({
                type: "subscribe",
                collection: "role_fit_index_submission",
                query: {
                  fields: ["id", "status"],
                  filter: { id: { _eq: id } },
                  limit: 1,
                },
              })
            );
          }

          if (msg.type === "subscription") {
            const rec = Array.isArray(msg.data)
              ? msg.data[0]
              : msg.data?.payload ?? msg.data?.item ?? msg.data;
            if (!rec || String(rec.id) !== String(id)) return;

            if (rec.status) setSubmissionStatus(rec.status);

            if (rec.status === "generated_report") {
              try {
                const url = new URL(`${DIRECTUS_URL}/items/role_fit_index_report`);
                url.searchParams.set("limit", "1");
                url.searchParams.set("sort", "-date_created");
                url.searchParams.set("filter[submission][_eq]", String(id));
                const res = await fetch(url.toString(), {
                  credentials: isAuthed ? "include" : "omit",
                  headers: getAuthHeaders(),
                });
                const js = await res.json();
                if (res.ok && js?.data?.length) {
                  // Reset before redirect
                  form.reset({ jobDescription: "", cv: null });
                  setStep(0);
                  setButtonText("Analyze Role Fit Now");
                  setSubmissionId(null);

                  setSubmissionStatus("redirecting");
                  window.location.href = `/role-fit-index/report?id=${encodeURIComponent(
                    js.data[0].id
                  )}`;
                  clearTimeout(timeout);
                  resolve(true);
                  return;
                }
                setError("Report ready but fetch failed.");
              } catch {
                setError("Report ready but fetch failed.");
              }
            }

            if ((rec.status || "").startsWith("failed_")) {
              setError("Submission failed: " + rec.status);
              clearTimeout(timeout);
              reject(new Error("Submission failed"));
            }
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("WS error"));
        };
        ws.onclose = () => {
          clearTimeout(timeout);
          reject(new Error("WS closed"));
        };
      } catch (e) {
        reject(e);
      }
    });
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      setStep(1);
      setButtonText("Uploading CV…");
      const cvFileId = await uploadFile(values.cv);

      setButtonText("Saving submission…");
      const subId = await createSubmission(values.jobDescription, cvFileId);
      setSubmissionId(subId);

      setStep(2);
      setButtonText("Analyzing…");
      setError("");

      const ok = await subscribeWS(subId).catch(() => false);
      if (!ok) {
        await pollReport(subId);
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error");
      setStep(0);
      setButtonText("Analyze Role Fit Now");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const totalQuota = useMemo(
    () => credits.used + credits.remaining,
    [credits]
  );

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle>Upload JD and CV</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              {/* Left: JD */}
              <FormField
                control={form.control}
                name="jobDescription"
                render={({ field }) => (
                  <FormItem className="h-full flex flex-col">
                    <FormLabel>Job Description (Text or URL)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Paste the JD or a JD URL…"
                        className="h-full min-h-[300px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Right: CV Upload */}
              <FormField
                control={form.control}
                name="cv"
                render={({ field }) => (
                  <FormItem className="h-full flex flex-col">
                    <FormLabel>CV (PDF only)</FormLabel>
                    <FormControl>
                      <DragAndDropUpload onFileSelect={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Progress & Stepper */}
            {step >= 1 && (
              <div className="mt-8 space-y-6">
                {/* Step circles */}
                <div className="flex justify-between">
                  {progressSteps.map((s, i) => {
                    const isCompleted = i < currentStepIdx;
                    const isActive = i === currentStepIdx && !error;
                    const isFailed = !!error && i === currentStepIdx;

                    return (
                      <div key={s} className="flex flex-col items-center flex-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center mb-2
                            ${isFailed
                              ? "bg-red-600 text-white"
                              : isCompleted
                                ? "bg-green-600 text-white"
                                : isActive
                                  ? "border-2 border-primary-600 text-primary-600"
                                  : "border-2 border-gray-300 text-gray-400"
                            }`}
                        >
                          {isFailed && <X className="h-4 w-4" />}
                          {isCompleted && <Check className="h-4 w-4" />}
                          {isActive && <Loader2 className="h-4 w-4 animate-spin" />}
                        </div>
                        <span
                          className={`text-xs text-center ${isFailed
                            ? "text-red-600 font-medium"
                            : isCompleted
                              ? "text-green-700 font-medium"
                              : isActive
                                ? "text-primary-700 font-medium"
                                : "text-gray-500"
                            }`}
                        >
                          {s}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar always visible */}
                <Progress value={percentDone} className="w-full" />

                {/* Helper text */}
                <p className="text-sm text-gray-600 text-center">
                  {error
                    ? "Something went wrong. Please try again."
                    : "Analyzing your CV & JD — this usually takes ~30 seconds. You’ll be redirected when the report is ready."}
                </p>
              </div>
            )}

            {/* Error */}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* Credit display (RIGHT ABOVE THE BUTTON) */}
            <div className="text-center">
              {isAuthed === false ? (
                <p className="text-sm text-gray-700 mb-2">
                  Credits Remaining: <span className="font-semibold">{credits.remaining}</span> / 2
                  <span className="text-xs text-gray-500 block mt-1">
                    <a href={getLoginUrl(DIRECTUS_URL, EXTERNAL.auth_idp_key, "/dashboard")} className="text-blue-600 hover:text-blue-800 underline">Login</a> and get 5 free credits
                  </span>
                </p>
              ) : isAuthed === true ? (
                <p className="text-sm text-gray-700 mb-2">
                    Credits Remaining: <span className="font-semibold">{credits.remaining}</span> /{" "}
                  <span className="font-semibold">{totalQuota}</span>
                </p>
              ) : (
                <p className="text-xs text-gray-500 mb-2">
                  Loading credits...
                </p>
              )}
            </div>

            {/* Conditionally show button or top-up link based on credits */}
            {credits.remaining === 0 ? (
              <Button
                asChild
                variant="default"
                className="w-full"
              >
                <a href="/dashboard/role-fit-index/top-up">
                  Top Up Credits to Continue
                </a>
              </Button>
            ) : (
              <Button
                type="submit"
                variant="default"
                className="w-full"
                disabled={submitting || step !== 0}
              >
                {buttonText}
              </Button>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
