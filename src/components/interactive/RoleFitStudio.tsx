"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import DragAndDropUpload from "./DragAndDropUpload";
import {
  Search,
  Loader2,
  Check,
  X,
  Calendar,
  Building2,
  MapPin,
  DollarSign
} from "lucide-react";
import { EXTERNAL } from '@/constant';
import {
  getUserProfile,
  loadCredits,
  consumeCredit,
  getLoginUrl,
  type Credits,
  type UserProfile,
  cn
} from '@/lib/utils';

const schema = z.object({
  jobDescription: z.string().min(1, "Please select a job description or provide a URL/text"),
  cv: z.any().refine((file) => file instanceof File || typeof file === "string", "Please upload a CV")
});

type FormValues = z.infer<typeof schema>;
type Me = UserProfile | null;

type JobDescription = {
  id: string;
  raw_input: string;
  role_name?: string;
  company_name?: string;
  location?: string;
  salary_range?: string;
  responsibility?: string;
  minimum_requirement?: string;
  preferred_requirement?: string;
  perk?: string;
  backfill_status?: string;
  date_created: string;
  date_updated: string;
};

type PreviousReport = {
  id: string;
  date_created: string;
  index?: number;
  submission?: {
    id: number;
    cv_file: string;
    job_description?: {
      id: string;
      role_name?: string;
      company_name?: string;
    };
  };
};

// State machine from the original form
const STATE_CONFIG = {
  idle: {
    step: 0,
    buttonText: "Analyze Role Fit Now",
    progressStep: -1,
    isProcessing: false,
    canSubmit: true,
    helperText: null,
    isError: false
  },
  uploading: {
    step: 1,
    buttonText: "Uploading CV…",
    progressStep: 0,
    isProcessing: true,
    canSubmit: false,
    helperText: null,
    isError: false
  },
  saving: {
    step: 1,
    buttonText: "Saving submission…",
    progressStep: 0,
    isProcessing: true,
    canSubmit: false,
    helperText: null,
    isError: false
  },
  submitted: {
    step: 2,
    buttonText: "Analyzing…",
    progressStep: 1,
    isProcessing: true,
    canSubmit: false,
    helperText: "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.",
    isError: false
  },
  parsed_jd: {
    step: 2,
    buttonText: "Analyzing…",
    progressStep: 2,
    isProcessing: true,
    canSubmit: false,
    helperText: "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.",
    isError: false
  },
  generated_report: {
    step: 2,
    buttonText: "Analyzing…",
    progressStep: 3,
    isProcessing: true,
    canSubmit: false,
    helperText: "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.",
    isError: false
  },
  redirecting: {
    step: 2,
    buttonText: "Analyzing…",
    progressStep: 3,
    isProcessing: true,
    canSubmit: false,
    helperText: "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.",
    isError: false
  },
  failed_parsing_jd: {
    step: 2,
    buttonText: "Analyze Role Fit Now",
    progressStep: 1,
    isProcessing: false,
    canSubmit: true,
    helperText: "Failed to parse the job description. This could be led by the site blocking. Please try again, or paste JD contents.",
    isError: true
  },
  failed_generating_report: {
    step: 2,
    buttonText: "Analyze Role Fit Now",
    progressStep: 2,
    isProcessing: false,
    canSubmit: true,
    helperText: "Failed to generate the report. Please try again.",
    isError: true
  }
} as const;

type StateKey = keyof typeof STATE_CONFIG;

export default function RoleFitStudio() {
  const [currentState, setCurrentState] = useState<StateKey>("idle");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [genericError, setGenericError] = useState("");

  // auth + quota states
  const [me, setMe] = useState<Me>(null);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [credits, setCredits] = useState<Credits>({ used: 0, remaining: 5 });

  // job description states
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [loadingJobDescriptions, setLoadingJobDescriptions] = useState(true);
  const [selectedJobDescription, setSelectedJobDescription] = useState<JobDescription | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // CV states
  const [lastSubmission, setLastSubmission] = useState<PreviousReport | null>(null);
  const [selectedPreviousCV, setSelectedPreviousCV] = useState<string | null>(null);
  const [jobDescriptionReports, setJobDescriptionReports] = useState<PreviousReport[]>([]);

  const DIRECTUS_URL = EXTERNAL.directus_url;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { jobDescription: "", cv: null }
  });

  const progressSteps = [
    "Upload CV",
    "Parse Job Description",
    "Generate Report",
    "Redirect to Report",
  ];

  const stateConfig = STATE_CONFIG[currentState];
  const currentStepIdx = stateConfig.progressStep;
  const percentDone = currentStepIdx >= 0 ? ((currentStepIdx + 1) / progressSteps.length) * 100 : 0;
  const totalQuota = useMemo(() => credits.used + credits.remaining, [credits]);

  // Helper function to get authorization header
  const getAuthHeaders = (user: UserProfile | null = null): Record<string, string> => {
    const currentUser = user || me;
    const authenticated = isAuthed !== null ? isAuthed : (currentUser !== null);
    return authenticated
      ? {} // No auth header needed for authenticated users (using session cookies)
      : { Authorization: `Bearer ${EXTERNAL.directus_key}` }; // Guest token for unauthenticated users
  };

  // Fetch job descriptions
  const fetchJobDescriptions = async (user: UserProfile | null = null): Promise<JobDescription[]> => {
    try {
      // Check if user is logged in first
      const currentUser = user || me;
      if (!currentUser?.id) {
        throw new Error("USER_NOT_LOGGED_IN");
      }

      const fields = `id,raw_input,role_name,company_name,location,salary_range,responsibility,minimum_requirement,preferred_requirement,perk,backfill_status,date_created,date_updated`;
      // Only show job descriptions created by the logged-in user
      const filter = `filter[backfill_status][_eq]=success&filter[user_created][_eq]=${encodeURIComponent(currentUser.id)}`;

      const url = `${DIRECTUS_URL}/items/job_description?fields=${fields}&${filter}&sort[]=-date_created&limit=50`;

      const res = await fetch(url, {
        credentials: "include",
        headers: getAuthHeaders(currentUser),
      });

      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    } catch (error: any) {
      if (error.message === "USER_NOT_LOGGED_IN") {
        throw error;
      }
      return [];
    }
  };

  // Fetch last submission for authenticated users (for CV reuse)
  const fetchLastSubmission = async (userId: string): Promise<PreviousReport | null> => {
    try {
      const fields = `fields=id,date_created,index,submission.id,submission.cv_file,submission.job_description.id,submission.job_description.role_name,submission.job_description.company_name`;
      const filter = `filter[submission][user_created][id][_eq]=${encodeURIComponent(userId)}`;
      const url = `${DIRECTUS_URL}/items/role_fit_index_report?${fields}&${filter}&sort[]=-date_created&limit=1`;

      const res = await fetch(url, {
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!res.ok) return null;
      const json = await res.json();
      const data = Array.isArray(json.data) ? json.data.filter((r: any) => r.submission?.cv_file) : [];
      return data.length > 0 ? data[0] : null;
    } catch (error: any) {
      return null;
    }
  };

  // Fetch reports for a specific job description
  const fetchJobDescriptionReports = async (userId: string, jobDescriptionId: string): Promise<PreviousReport[]> => {
    try {
      const fields = `fields=id,date_created,index,submission.id,submission.cv_file,submission.job_description.id,submission.job_description.role_name,submission.job_description.company_name`;
      const filter = `filter[submission][user_created][id][_eq]=${encodeURIComponent(userId)}&filter[submission][job_description][id][_eq]=${encodeURIComponent(jobDescriptionId)}`;
      const url = `${DIRECTUS_URL}/items/role_fit_index_report?${fields}&${filter}&sort[]=-date_created&limit=10`;

      const res = await fetch(url, {
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json.data) ? json.data.filter((r: any) => r.submission?.cv_file) : [];
    } catch (error: any) {
      return [];
    }
  };

  // Load auth, credits, and data
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // First check user authentication directly
        const user = await getUserProfile(DIRECTUS_URL);
        if (cancelled) return;

        setMe(user);
        setIsAuthed(user !== null);

        // Then load credits
        const result = await loadCredits(DIRECTUS_URL);
        if (cancelled) return;
        setCredits(result.credits);

        // Fetch job descriptions
        try {
          const jds = await fetchJobDescriptions(user);
          if (!cancelled) {
            setJobDescriptions(jds);
            setLoadingJobDescriptions(false);
          }
        } catch (error: any) {
          if (!cancelled) {
            if (error.message === "USER_NOT_LOGGED_IN") {
              setJobDescriptions([]);
              setGenericError("Error: User must be logged in to view job descriptions");
            } else {
              setJobDescriptions([]);
            }
            setLoadingJobDescriptions(false);
          }
        }

        // If user is authenticated, fetch their last submission
        if (user?.id) {
          const lastReport = await fetchLastSubmission(user.id);
          if (!cancelled) {
            setLastSubmission(lastReport);
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          setIsAuthed(false);
          setMe(null);
          setCredits({ used: 0, remaining: 5 });
          setLoadingJobDescriptions(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [DIRECTUS_URL]);

  // Filter job descriptions based on search
  const filteredJobDescriptions = useMemo(() => {
    if (!searchTerm) return jobDescriptions;
    return jobDescriptions.filter(jd =>
      jd.role_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      jd.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      jd.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [jobDescriptions, searchTerm]);

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "—";
    }
  };

  // Helper function to format RFI score
  const formatRFIScore = (score?: number) => {
    if (score === undefined || score === null) return "—";
    return `${Math.round(score)}%`;
  };

  // Helper function to get RFI score color
  const getRFIScoreColor = (score?: number) => {
    if (score === undefined || score === null) return "text-gray-500";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Handle job description selection
  const handleJobDescriptionSelect = async (jd: JobDescription) => {
    setSelectedJobDescription(jd);
    form.setValue("jobDescription", jd.raw_input);

    // Fetch previous reports for this job description
    if (me?.id) {
      const reports = await fetchJobDescriptionReports(me.id, jd.id);
      setJobDescriptionReports(reports);
    }
  };

  // Submission logic adapted from RoleFitIndexForm
  const wsRef = useRef<WebSocket | null>(null);

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
    url.searchParams.set("filter[sha256][_eq]", sha);
    url.searchParams.set("filter[file][_neq]", "null");
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
    const sha = await sha256OfFile(file);
    const existingId = await findFileIdBySha(sha);

    if (existingId) return existingId;

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

  /** Subscribe via WebSocket for real-time updates */
  const subscribeWS = (id: string) => {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const u = new URL(DIRECTUS_URL);
        u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
        u.pathname = "/websocket";
        u.search = "";

        const ws = new WebSocket(u.toString());
        wsRef.current = ws;

        const timeout = setTimeout(() => {
          try { ws.close(); } catch { }
          reject(new Error("WS timeout"));
        }, 90_000);

        ws.onopen = () => {
          const authPayload = JSON.stringify({
            type: "auth",
            access_token: EXTERNAL.directus_key
          });
          ws.send(authPayload);
        };

        ws.onmessage = async (evt) => {
          const msg = JSON.parse(evt.data);

          if (msg.type === "auth") {
            const subscriptionPayload = JSON.stringify({
              type: "subscribe",
              collection: "role_fit_index_submission",
              query: { fields: ["id", "status"] },
            });
            ws.send(subscriptionPayload);
          } else if (msg.type === "subscription") {
            const rec = Array.isArray(msg.data) ? msg.data[0] : msg.data?.payload ?? msg.data?.item ?? msg.data;

            if (msg.event === "update" && rec && String(rec.id) === String(id)) {
              if (rec.status && rec.status in STATE_CONFIG) {
                setCurrentState(rec.status as StateKey);
              }

              if (rec.status === "generated_report") {
                try {
                  const result = await consumeCredit(DIRECTUS_URL);
                  if (result.success) {
                    setCredits(result.credits);
                  }
                } catch (error) {
                  console.error('Failed to consume credit:', error);
                }

                // Reset form state
                form.reset({ jobDescription: "", cv: null });
                setSubmissionId(null);
                setSelectedJobDescription(null);
                setSelectedPreviousCV(null);
                setCurrentState("redirecting");

                // Get the report and redirect
                const reportUrl = new URL(`${DIRECTUS_URL}/items/role_fit_index_report`);
                reportUrl.searchParams.set("limit", "1");
                reportUrl.searchParams.set("sort", "-date_created");
                reportUrl.searchParams.set("filter[submission][_eq]", String(id));

                const reportRes = await fetch(reportUrl.toString(), {
                  credentials: isAuthed ? "include" : "omit",
                  headers: getAuthHeaders(),
                });

                const reportJs = await reportRes.json();
                if (reportRes.ok && reportJs?.data?.length) {
                  window.location.href = `/role-fit-index/report?id=${encodeURIComponent(reportJs.data[0].id)}`;
                }

                clearTimeout(timeout);
                resolve(true);
                return;
              }

              if ((rec.status || "").startsWith("failed_")) {
                if (rec.status === "failed_parsing_jd") {
                  setCurrentState("failed_parsing_jd");
                } else {
                  setCurrentState("failed_generating_report");
                }
                clearTimeout(timeout);
                resolve(false);
              }
            }
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("WS error"));
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          reject(new Error("WS closed, something went wrong, try again!"));
        };
      } catch (e) {
        reject(e);
      }
    });
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setCurrentState("uploading");

      // Handle both new file uploads and previous CV selection
      let cvFileId: string;
      if (typeof values.cv === "string") {
        // Using a previous CV
        cvFileId = values.cv;
      } else {
        // Uploading a new file
        cvFileId = await uploadFile(values.cv);
      }

      setCurrentState("saving");
      const subId = await createSubmission(values.jobDescription, cvFileId);
      setSubmissionId(subId);

      setCurrentState("submitted");
      setGenericError("");

      await subscribeWS(subId);
    } catch (err: any) {
      setGenericError(err?.message || "Unexpected error");
      setCurrentState("idle");
    }
  };

  // Cleanup websocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Role Fit Studio</h1>
        <p className="text-sm text-muted-foreground">
          Select a job description and upload your CV to get detailed Role Fit Index analysis
        </p>
      </div>

      <Card className="mb-8">
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side - Job Description Selector */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-4">Job Description</h3>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by role, company, or location..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={stateConfig.isProcessing}
                  />
                </div>

                {/* Job Description List */}
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {loadingJobDescriptions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Loading job descriptions...</span>
                    </div>
                  ) : filteredJobDescriptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {genericError.includes("logged in") ? (
                        <div className="text-red-600">
                          {genericError}
                        </div>
                      ) : searchTerm ? (
                        "No job descriptions found matching your search."
                      ) : (
                        "No job descriptions available."
                      )}
                    </div>
                  ) : (
                    filteredJobDescriptions.map((jd) => (
                      <div
                        key={jd.id}
                        className={cn(
                          "p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md",
                          selectedJobDescription?.id === jd.id
                            ? "border-primary-500 bg-primary-50"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => handleJobDescriptionSelect(jd)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h3 className="font-semibold text-sm">
                                {jd.role_name || "Untitled Role"}
                              </h3>
                              {jd.company_name && (
                                <p className="text-sm text-gray-600 flex items-center">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {jd.company_name}
                                </p>
                              )}
                            </div>
                            {selectedJobDescription?.id === jd.id && (
                              <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {jd.location && (
                              <Badge variant="secondary" className="text-xs">
                                <MapPin className="h-3 w-3 mr-1" />
                                {jd.location}
                              </Badge>
                            )}
                            {jd.salary_range && (
                              <Badge variant="secondary" className="text-xs">
                                <DollarSign className="h-3 w-3 mr-1" />
                                {jd.salary_range}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(jd.date_created)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Side - Previous Reports Overview */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Previous Reports</h3>

              {selectedJobDescription ? (
                jobDescriptionReports.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">
                      Reports for this role ({jobDescriptionReports.length})
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {jobDescriptionReports.map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm border hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-medium text-gray-900">
                                Report #{report.id}
                              </div>
                              <div className={`font-bold text-sm ${getRFIScoreColor(report.index)}`}>
                                RFI: {formatRFIScore(report.index)}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDate(report.date_created)}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs ml-3"
                            onClick={() => {
                              window.open(`/role-fit-index/report?id=${report.id}`, '_blank');
                            }}
                          >
                            View Report
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-sm">No previous reports for this role</div>
                    <div className="text-xs mt-1">Upload your CV below to create your first analysis</div>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-sm">Select a job description to see previous reports</div>
                </div>
              )}
            </div>
          </div>

          {/* CV Upload Section - Below the two columns */}
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-lg font-medium mb-4">Upload Your CV</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="cv"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CV (PDF only)</FormLabel>
                      <FormControl>
                        <DragAndDropUpload
                          onFileSelect={(file) => {
                            setSelectedPreviousCV(null);
                            field.onChange(file);
                          }}
                          lastSubmission={lastSubmission?.submission ? {
                            id: lastSubmission.submission.id,
                            cv_file: lastSubmission.submission.cv_file,
                            date_created: lastSubmission.date_created,
                            job_description: lastSubmission.submission.job_description
                          } : null}
                          selectedPreviousCV={selectedPreviousCV}
                          onSelectLastCV={() => {
                            if (lastSubmission?.submission?.cv_file) {
                              setSelectedPreviousCV(lastSubmission.submission.cv_file);
                              field.onChange(lastSubmission.submission.cv_file);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Progress & Stepper */}
                {stateConfig.step >= 1 && (
                  <div className="space-y-6">
                    {/* Step circles */}
                    <div className="flex justify-between">
                      {progressSteps.map((s, i) => {
                        const isCompleted = i < currentStepIdx;
                        const isActive = i === currentStepIdx && !stateConfig.isError;
                        const isFailed = stateConfig.isError && i === currentStepIdx;

                        return (
                          <div key={s} className="flex flex-col items-center flex-1">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${isFailed
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

                    <Progress value={percentDone} className="w-full" />

                    {/* Helper text */}
                    <p className="text-sm text-gray-600 text-center">
                      {stateConfig.helperText ||
                        (genericError
                          ? "Something went wrong. Please try again."
                          : "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.")}
                    </p>
                  </div>
                )}

                {/* Error */}
                {genericError && <p className="text-sm text-red-600">{genericError}</p>}

                {/* Credit display */}
                <div className="text-center">
                  {isAuthed === false ? (
                    <p className="text-sm text-gray-700 mb-2">
                      Credits Remaining: <span className="font-semibold">{credits.remaining}</span> / 5
                      <span className="text-xs text-gray-500 block mt-1">
                        <a
                          href={getLoginUrl(DIRECTUS_URL, EXTERNAL.auth_idp_key, "/dashboard/role-fit-studio")}
                          className="text-primary-600 hover:text-primary-800 underline"
                        >
                          Login
                        </a> and get 15 free credits
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

                {/* Submit button or top-up link */}
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
                    disabled={!stateConfig.canSubmit || !selectedJobDescription}
                  >
                    {stateConfig.buttonText}
                  </Button>
                )}
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>

      {/* View All Reports link for logged-in users */}
      {isAuthed === true && (
        <div className="text-center">
          <a
            href="/dashboard/role-fit-index"
            className="text-sm text-primary-600 hover:text-primary-800 underline"
          >
            View All Reports
          </a>
        </div>
      )}

      {/* Terms & Conditions agreement */}
      <p className="text-xs text-gray-500 text-center pt-8">
        By using this service, you agree to our{" "}
        <a href="/legal" className="text-gray-500 hover:text-gray-700 underline">
          Terms of Service and Privacy Policy
        </a>
      </p>
    </div>
  );
}