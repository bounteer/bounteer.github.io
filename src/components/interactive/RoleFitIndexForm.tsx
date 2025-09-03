"use client";

import { useState, useEffect, useRef } from "react";
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

const DIRECTUS_URL = "https://directus.bounteer.com";
const DIRECTUS_TOKEN = "dZtMfEuzhzUS0YATh0pOZfBAdOYlhowE";

const schema = z.object({
  jobDescription: z.string().min(1, "Paste the JD or provide a URL"),
  cv: z.any().refine((file) => file instanceof File, "Please upload a CV"),
});

type FormValues = z.infer<typeof schema>;

export default function RoleFitForm() {
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 idle, 1 uploading, 2 analyzing
  const [submitting, setSubmitting] = useState(false);
  const [buttonText, setButtonText] = useState("Analyze Role Fit Now");
  const [error, setError] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState<
    "submitted" | "parsed_jd" | "generated_report" | "redirecting"
  >("submitted");
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { jobDescription: "", cv: null },
  });

  const progressSteps = [
    "Upload CV",
    "Parse Job Description",
    "Generate Report",
    "Redirecting",
  ];

  // Map backend statuses → step index
  const statusToStep: Record<string, number> = {
    submitted: 1,        // spinner on "Parse Job Description"
    parsed_jd: 2,        // spinner on "Generate Report"
    generated_report: 3, // spinner on "Redirecting"
    redirecting: 3,      // same circle active until redirect
  };

  const currentStepIdx = statusToStep[submissionStatus] ?? 0;
  const percentDone = ((currentStepIdx + 1) / progressSteps.length) * 100;

  /** Upload CV file to Directus */
  const uploadFile = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file, file.name || "cv.pdf");
    const res = await fetch(`${DIRECTUS_URL}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body: fd,
    });
    const js = await res.json();
    if (!res.ok) throw new Error(js?.errors?.[0]?.message || "File upload failed");
    return js.data.id as string;
  };

  /** Create submission */
  const createSubmission = async (jd: string, fileId: string) => {
    const res = await fetch(`${DIRECTUS_URL}/items/role_fit_index_submission`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cv_file: fileId,
        status: "submitted",
        job_description: { raw_input: jd },
      }),
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
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        });
        const js = await res.json();
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

        setTimeout(() => {
          ws.close();
          reject(new Error("WS timeout"));
        }, 90_000);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "auth", access_token: DIRECTUS_TOKEN }));
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
                  headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
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
              reject(new Error("Submission failed"));
            }
          }
        };

        ws.onerror = () => reject(new Error("WS error"));
        ws.onclose = () => reject(new Error("WS closed"));
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
                    const isFailed = error && i === currentStepIdx;

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

            <Button
              type="submit"
              variant="default"
              className="w-full"
              disabled={submitting || step !== 0}
            >
              {buttonText}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
