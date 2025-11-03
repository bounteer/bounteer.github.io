"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { GlowCard } from "./GlowCard";
import { Loader2, Check, X } from "lucide-react";
import { EXTERNAL } from '@/constant';
import { loadCredits, consumeCredit, getLoginUrl, getAuthHeaders, type Credits, type UserProfile } from '@/lib/utils';

const schema = z.object({
  jdRawInput: z.string().min(1, "Paste the JD or provide a URL"),
  cv: z.any().optional().refine((file) => !file || file instanceof File || typeof file === "string", "Please upload a valid CV"),
  linkedinUrl: z.string().optional(),
}).refine((data) => data.cv || data.linkedinUrl, {
  message: "Please provide either a CV or LinkedIn URL/handle",
  path: ["cv"], // Show error on CV field
});

type FormValues = z.infer<typeof schema>;

type Me = UserProfile | null;

type PreviousSubmission = {
  id: number;
  cv_file: string;
  date_created: string;
  job_description?: {
    role_name?: string;
    company_name?: string;
  };
};

// State machine configuration
const STATE_CONFIG = {
  idle: {
    step: 0,
    buttonText: "Analyze Role Fit Now",
    progressStep: -1,
    canSubmit: true,
    helperText: null,
    isError: false
  },
  uploading: {
    step: 1,
    buttonText: "Uploading CV…",
    progressStep: 0,
    canSubmit: false,
    helperText: null,
    isError: false
  },
  saving: {
    step: 1,
    buttonText: "Saving submission…",
    progressStep: 0,
    canSubmit: false,
    helperText: null,
    isError: false
  },
  submitted: {
    step: 2,
    buttonText: "Analyzing…",
    progressStep: 0,
    canSubmit: false,
    helperText: "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.",
    isError: false
  },
  parsed_jd: {
    step: 2,
    buttonText: "Analyzing…",
    progressStep: 2,
    canSubmit: false,
    helperText: "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.",
    isError: false
  },
  parsed_profile: {
    step: 2,
    buttonText: "Analyzing…",
    progressStep: 3,
    canSubmit: false,
    helperText: "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.",
    isError: false
  },
  generated_report: {
    step: 2,
    buttonText: "Analyzing…",
    progressStep: 4,
    canSubmit: false,
    helperText: "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.",
    isError: false
  },
  redirecting: {
    step: 2,
    buttonText: "Analyzing…",
    progressStep: 4,
    canSubmit: false,
    helperText: "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.",
    isError: false
  },
  failed_parsing_jd: {
    step: 2,
    buttonText: "Analyze Role Fit Now",
    progressStep: 1,
    canSubmit: true,
    helperText: "Failed to parse the job description. This could be led by the site blocking. Please try again, or paste JD contents.",
    isError: true
  },
  failed_parsing_profile: {
    step: 2,
    buttonText: "Analyze Role Fit Now",
    progressStep: 2,
    canSubmit: true,
    helperText: "Failed to parse the profile. Please try again.",
    isError: true
  },
  failed_generating_report: {
    step: 2,
    buttonText: "Analyze Role Fit Now",
    progressStep: 3,
    canSubmit: true,
    helperText: "Failed to generate the report. Please try again.",
    isError: true
  }
} as const;

type StateKey = keyof typeof STATE_CONFIG;

export default function RoleFitForm() {
  const [currentState, setCurrentState] = useState<StateKey>("idle");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [genericError, setGenericError] = useState("");

  // auth + quota states
  const [me, setMe] = useState<Me>(null);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [credits, setCredits] = useState<Credits>({ used: 0, remaining: 5 });

  // previous CV state (single last CV)
  const [lastSubmission, setLastSubmission] = useState<PreviousSubmission | null>(null);
  const [selectedPreviousCV, setSelectedPreviousCV] = useState<string | null>(null);
  const glowState = mapGlowState(currentState);
  const wsRef = useRef<WebSocket | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { jdRawInput: "", cv: null, linkedinUrl: "" },
  });

  const progressSteps = [
    "Upload Submission",
    "Parse Job Description",
    "Parse Profile",
    "Generate Report",
    "Redirect to Report",
  ];

  // Get current state configuration
  const stateConfig = STATE_CONFIG[currentState];
  const currentStepIdx = stateConfig.progressStep;
  const percentDone = currentStepIdx >= 0 ? ((currentStepIdx + 1) / progressSteps.length) * 100 : 0;

  const DIRECTUS_URL = EXTERNAL.directus_url;

  // Map RoleFitForm state → glow state
  function mapGlowState(currentState: StateKey): "idle" | "listening" | "processing" | "done" {
    if (currentState === "redirecting") return "done";
    if (
      currentState === "uploading" ||
      currentState === "saving" ||
      currentState === "submitted" ||
      currentState === "parsed_jd" ||
      currentState === "generated_report"
    ) {
      return "processing";
    }
    if (currentState.startsWith("failed_") || currentState === "idle") return "idle";
    return "idle";
  }


  /** Fetch previous submissions for authenticated users */
  const fetchPreviousSubmissions = async (userId: string): Promise<PreviousSubmission[]> => {
    try {
      const fields =
        `fields=id,cv_file,date_created,` +
        `job_description.role_name,` +
        `job_description.company_name`;

      const filter = `filter[user_created][id][_eq]=${encodeURIComponent(userId)}`;
      const url = `${DIRECTUS_URL}/items/role_fit_index_submission?${fields}&${filter}&sort[]=-date_created&limit=1`;

      // TODO the auth header is not using hte logged in user currently (using generic)
      const res = await fetch(url, {
        credentials: "include",
        headers: getAuthHeaders(me),
      });

      console.log("result:" + JSON.stringify(res));

      if (!res.ok) return [];

      const json = await res.json();
      return Array.isArray(json.data) ? json.data.filter(s => s.cv_file) : [];
    } catch {
      return [];
    }
  };

  // --- Auth & Credit loading ---
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        console.log('Loading credits');
        const result = await loadCredits(DIRECTUS_URL);
        console.log('Load credits result:', result);

        if (cancelled) return;

        setMe(result.user);
        setIsAuthed(result.isAuthenticated);
        setCredits(result.credits);
        console.log('Set credits state to:', result.credits);

        // If user is authenticated, fetch their last submission
        if (result.isAuthenticated && result.user?.id) {
          const submissions = await fetchPreviousSubmissions(result.user.id);
          if (!cancelled) {
            setLastSubmission(submissions.length > 0 ? submissions[0] : null);
          }
        }
      } catch {
        if (!cancelled) {
          setIsAuthed(false);
          setMe(null);
          setCredits({ used: 0, remaining: 5 }); // Default guest credits
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
    url.searchParams.set("filter[sha256][_eq]", sha);
    url.searchParams.set("filter[file][_neq]", "null");
    url.searchParams.set("fields", "file");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      credentials: "include",
      headers: getAuthHeaders(me),
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
      headers: getAuthHeaders(me),
      body: fd,
    });
    const uploadJs = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadJs?.errors?.[0]?.message || "File upload failed");
    }
    const fileId = uploadJs.data.id as string;

    return fileId;
  };


  async function sha256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);              // encode string → bytes
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer); // hash
    const hashArray = Array.from(new Uint8Array(hashBuffer));         // convert buffer → byte array
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join(""); // bytes → hex string
  }



  /** Get existing JD by hash or create new one */
  const getOrCreateJobDescription = async (jd_raw_input: string): Promise<string> => {
    const hash = await sha256(jd_raw_input);
    console.log("JD hash: " + hash);
    // 1. Check if JD exists
    const checkRes = await fetch(
      `${DIRECTUS_URL}/items/job_description?filter[raw_input_hash][_eq]=${hash}&fields=id`,
      {
        method: "GET",
        headers: getAuthHeaders(me),
        credentials: isAuthed ? "include" : "omit",
      }
    );
    const checkJson = await checkRes.json();
    let jdId: string | undefined = checkJson?.data?.[0]?.id;

    // 2. If not exist → create new JD
    if (!jdId) {
      const jdRes = await fetch(`${DIRECTUS_URL}/items/job_description`, {
        method: "POST",
        credentials: isAuthed ? "include" : "omit",
        headers: {
          ...getAuthHeaders(me),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw_input: jd_raw_input,
          raw_input_hash: hash,
        }),
      });

      const jdJson = await jdRes.json();
      if (!jdRes.ok) throw new Error(jdJson?.errors?.[0]?.message || "JD creation failed");
      jdId = jdJson.data.id;
    }

    return jdId!;
  };

  /** Check if user already has a submission with the same JD hash */
  const checkExistingSubmission = async (jd_raw_input: string): Promise<string | null> => {
    // Only check for authenticated users
    if (!isAuthed || !me?.id) {
      return null;
    }

    const hash = await sha256(jd_raw_input);
    console.log("Checking for existing submission with JD hash:", hash);

    // Check for existing submission with same JD hash by same user
    const checkRes = await fetch(
      `${DIRECTUS_URL}/items/role_fit_index_submission?` +
      `filter[job_description][raw_input_hash][_eq]=${hash}&` +
      `filter[user_created][id][_eq]=${me.id}&` +
      `fields=id&` +
      `limit=1`,
      {
        method: "GET",
        headers: getAuthHeaders(me),
        credentials: "include",
      }
    );

    const checkJson = await checkRes.json();
    const existingSubmission = checkJson?.data?.[0];

    if (existingSubmission) {
      console.log("Found existing submission with same JD hash:", existingSubmission.id);
      return existingSubmission.id;
    }

    return null;
  };

  /** Get or create candidate reference */
  const getOrCreateCandidateReference = async (cv_file_id?: string, linkedin_handle?: string): Promise<string | null> => {
    // Return null if both parameters are missing
    if (!cv_file_id && !linkedin_handle) {
      return null;
    }

    // Build filter query based on available parameters
    let filterQuery = '';
    const filterParts: string[] = [];

    if (cv_file_id) {
      filterParts.push(`filter[cv_file][_eq]=${encodeURIComponent(cv_file_id)}`);
    }

    if (linkedin_handle) {
      filterParts.push(`filter[linkedin_handle][_eq]=${encodeURIComponent(linkedin_handle)}`);
    }

    if (isAuthed && me?.id) {
      filterParts.push(`filter[user_created][id][_eq]=${encodeURIComponent(me.id)}`);
    }

    filterQuery = filterParts.join('&');

    // Check if candidate_reference already exists
    const checkRes = await fetch(
      `${DIRECTUS_URL}/items/candidate_reference?${filterQuery}&fields=id&limit=1`,
      {
        method: "GET",
        headers: getAuthHeaders(me),
        credentials: isAuthed ? "include" : "omit",
      }
    );

    const checkJson = await checkRes.json();
    let candidateRefId = checkJson?.data?.[0]?.id;

    // If not exists, create new candidate_reference
    if (!candidateRefId) {
      const requestBody: any = {
        ...(isAuthed && me?.id ? { user: me.id } : {}),
      };

      if (cv_file_id) {
        requestBody.cv_file = cv_file_id;
      }

      if (linkedin_handle) {
        requestBody.linkedin_handle = linkedin_handle;
      }

      const createRefRes = await fetch(`${DIRECTUS_URL}/items/candidate_reference`, {
        method: "POST",
        credentials: isAuthed ? "include" : "omit",
        headers: {
          ...getAuthHeaders(me),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const createRefJson = await createRefRes.json();
      if (!createRefRes.ok) throw new Error(createRefJson?.errors?.[0]?.message || "Candidate reference creation failed");
      candidateRefId = createRefJson.data.id;
    }

    return candidateRefId;
  };

  /** Extract LinkedIn handle from URL */
  const extractLinkedInHandle = (url: string): string => {
    if (!url) return '';

    // Clean up the URL
    const cleanUrl = url.trim();

    // If it's just a handle (no URL), return as is
    if (!cleanUrl.includes('/')) {
      return cleanUrl;
    }

    // Extract handle from LinkedIn URL patterns
    const patterns = [
      /linkedin\.com\/in\/([^/?]+)/,
      /linkedin\.com\/pub\/([^/?]+)/,
      /linkedin\.com\/profile\/view\?id=([^&]+)/
    ];

    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // If no pattern matches but it's a URL, try to extract the last segment
    try {
      const urlObj = new URL(cleanUrl);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        return pathSegments[pathSegments.length - 1];
      }
    } catch {
      // Not a valid URL, return as is
      return cleanUrl;
    }

    return cleanUrl;
  };

  /** Create submission (deduplicates JD and creates candidate_reference first) */
  const createSubmission = async (jd_raw_input: string, fileId?: string, linkedinUrl?: string) => {
    // Extract LinkedIn handle if URL is provided
    const linkedinHandle = linkedinUrl ? extractLinkedInHandle(linkedinUrl) : undefined;

    // Get or create candidate reference
    const candidateRefId = await getOrCreateCandidateReference(fileId, linkedinHandle);
    if (!candidateRefId) {
      throw new Error("Failed to create candidate reference: either cv_file_id or linkedin_handle is required");
    }
    console.log("Candidate reference ID:", candidateRefId);

    // Resolve JD (dedupe)
    const jobDescriptionId = await getOrCreateJobDescription(jd_raw_input);
    console.log(jobDescriptionId);

    // Create submission
    const body = {
      candidate_reference: candidateRefId,
      job_description: jobDescriptionId, // always link by ID
      status: "submitted",
      ...(isAuthed && me?.id ? { user: me.id } : {}),
    };

    const res = await fetch(`${DIRECTUS_URL}/items/role_fit_index_submission`, {
      method: "POST",
      credentials: isAuthed ? "include" : "omit",
      headers: {
        ...getAuthHeaders(me),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const js = await res.json();
    if (!res.ok) throw new Error(js?.errors?.[0]?.message || "Submission failed");
    return js.data.id as string;
  };

  /** Handle WebSocket authentication */
  const handleWSAuth = (ws: WebSocket) => {
    const authToken = EXTERNAL.directus_key;
    const authPayload = JSON.stringify({ type: "auth", access_token: authToken });
    ws.send(authPayload);
  };

  /** Subscribe to submission updates */
  const subscribeToSubmissions = (ws: WebSocket) => {
    const subscriptionPayload = JSON.stringify({
      type: "subscribe",
      collection: "role_fit_index_submission",
      query: {
        fields: ["id", "status"],
      },
    });
    console.log(subscriptionPayload);
    ws.send(subscriptionPayload);
  };

  /** Handle report generation completion */
  const handleReportGenerated = async (
    id: string,
    timeout: NodeJS.Timeout,
    resolve: (value: boolean) => void
  ) => {
    try {
      const url = new URL(`${DIRECTUS_URL}/items/role_fit_index_report`);
      url.searchParams.set("limit", "1");
      url.searchParams.set("sort", "-date_created");
      url.searchParams.set("filter[submission][_eq]", String(id));

      const res = await fetch(url.toString(), {
        credentials: isAuthed ? "include" : "omit",
        headers: getAuthHeaders(me),
      });

      const js = await res.json();
      if (res.ok && js?.data?.length) {
        // Consume credit at redirecting stage
        try {
          console.log('About to consume credit at redirecting stage');
          const result = await consumeCredit(DIRECTUS_URL);
          console.log('Consume credit result:', result);
          if (result.success) {
            setCredits(result.credits);
            console.log('Updated credits state:', result.credits);
          }
        } catch (error) {
          console.error('Failed to consume credit:', error);
        }

        // Reset form state
        form.reset({ jdRawInput: "", cv: null, linkedinUrl: "" });
        setSubmissionId(null);
        setCurrentState("redirecting");

        // Redirect to report
        window.location.href = `/role-fit-index/report?id=${encodeURIComponent(js.data[0].id)}`;
        clearTimeout(timeout);
        resolve(true);
        return;
      }
      setGenericError("Report ready but fetch failed.");
    } catch {
      setGenericError("Report ready but fetch failed.");
    }
  };

  /** Handle subscription events */
  const handleSubscriptionEvent = async (
    msg: any,
    id: string,
    timeout: NodeJS.Timeout,
    resolve: (value: boolean) => void,
    reject: (reason: any) => void
  ) => {
    const rec = Array.isArray(msg.data)
      ? msg.data[0]
      : msg.data?.payload ?? msg.data?.item ?? msg.data;

    switch (msg.event) {
      case "init":
        console.log("Subscription initialized");
        break;
      case "create":
        console.log("New record created:", rec);
        break;
      case "update":
        console.log("Record updated:", rec);
        if (!rec || String(rec.id) !== String(id)) return;
        //  TODO check status
        console.log("received:" + rec);
        // Handle status updates
        if (rec.status) {
          console.log(rec.status);
          if (rec.status in STATE_CONFIG) {
            setCurrentState(rec.status as StateKey);
          }
        }

        if (rec.status === "generated_report") {
          await handleReportGenerated(id, timeout, resolve);
        }

        if ((rec.status || "").startsWith("failed_")) {
          if (rec.status === "failed_parsing_jd") {
            // Show failure at the parsing step and allow retry
            setCurrentState("failed_parsing_jd");
            clearTimeout(timeout);
            resolve(false); // Resolve instead of reject to allow retry
          } else if (rec.status === "failed_parsing_profile") {
            // Show failure at the profile parsing step and allow retry
            setCurrentState("failed_parsing_profile");
            clearTimeout(timeout);
            resolve(false); // Resolve instead of reject to allow retry
          } else {
            setGenericError("Submission failed: " + rec.status);
            clearTimeout(timeout);
            reject(new Error("Submission failed"));
          }
        }
        break;
      case "delete":
        console.log("Record deleted:", rec);
        break;
      default:
        console.log("Unknown subscription event:", msg.event);
        break;
    }
  };

  /** Handle WebSocket messages */
  const handleWSMessage = async (
    evt: MessageEvent,
    ws: WebSocket,
    id: string,
    timeout: NodeJS.Timeout,
    resolve: (value: boolean) => void,
    reject: (reason: any) => void
  ) => {
    const msg = JSON.parse(evt.data);
    console.log("onMessage");
    console.log(msg);

    switch (msg.type) {
      case "auth":
        // subscription has to come after authentication is acceptedin
        subscribeToSubmissions(ws);
        break;
      case "subscription":
        await handleSubscriptionEvent(msg, id, timeout, resolve, reject);
        break;
      default:
        console.log("Unknown message type:", msg.type);
        break;
    }
  };

  /** Subscribe via WebSocket */
  const subscribeWS = (id: string) => {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const u = new URL(DIRECTUS_URL);
        u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
        u.pathname = "/websocket";
        u.search = "";
        console.log("subscription URL:", u.toString());

        const ws = new WebSocket(u.toString());
        wsRef.current = ws;

        const timeout = setTimeout(() => {
          try { ws.close(); } catch { }
          reject(new Error("WS timeout"));
        }, 90_000);

        ws.onopen = () => {
          console.log("WebSocket opened");
          handleWSAuth(ws);
          // Send subscription immediately after auth to reduce delay
          setTimeout(() => subscribeToSubmissions(ws), 50);
        };

        ws.onmessage = (evt) => handleWSMessage(evt, ws, id, timeout, resolve, reject);

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

      // Check for existing submission with same JD hash by same user
      const existingSubmissionId = await checkExistingSubmission(values.jdRawInput);

      if (existingSubmissionId) {
        // Skip insertion and redirect to existing report
        console.log("Skipping insertion - found existing submission:", existingSubmissionId);

        // Try to find the existing report for this submission
        const reportRes = await fetch(
          `${DIRECTUS_URL}/items/role_fit_index_report?` +
          `filter[submission][_eq]=${existingSubmissionId}&` +
          `fields=id&` +
          `limit=1`,
          {
            method: "GET",
            headers: getAuthHeaders(me),
            credentials: isAuthed ? "include" : "omit",
          }
        );

        const reportJson = await reportRes.json();
        const existingReport = reportJson?.data?.[0];

        if (existingReport) {
          // Redirect to existing report
          window.location.href = `/role-fit-index/report?id=${encodeURIComponent(existingReport.id)}`;
          return;
        } else {
          // No report found, treat as new submission
          console.log("No existing report found, proceeding with new submission");
        }
      }

      // Handle both new file uploads and previous CV selection
      let cvFileId: string | undefined;
      if (values.cv) {
        if (typeof values.cv === "string") {
          // Using a previous CV
          cvFileId = values.cv;
        } else {
          // Uploading a new file
          cvFileId = await uploadFile(values.cv);
        }
      }

      setCurrentState("saving");
      const subId = await createSubmission(values.jdRawInput, cvFileId, values.linkedinUrl);
      setSubmissionId(subId);

      setCurrentState("submitted");
      setGenericError("");

      await subscribeWS(subId);
    } catch (err: any) {
      setGenericError(err?.message || "Unexpected error");
      setCurrentState("idle");
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
    <div className="w-full max-w-6xl mx-auto">
      <GlowCard
        glowState={glowState}
        color="#ff6b35"
      >
        <CardHeader>
          <CardTitle>Upload Job Description and Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                {/* Left Section: Job */}
                <div className="flex flex-col space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Job</h3>
                    <FormField
                      control={form.control}
                      name="jdRawInput"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Job Description (Text or URL)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Paste the full job description, or enter a job posting URL (e.g, Indeed, Glassdoor, etc)

Example JD:
Senior Software Engineer - Full Stack
Company: Tech Innovators Inc.

We are seeking a Senior Software Engineer to join our dynamic team. You will be responsible for developing scalable web applications using modern technologies.

Requirements:
• 5+ years of experience in full-stack development
• Proficiency in React, Node.js, and TypeScript
• Experience with cloud platforms (AWS, Azure)
• Bachelor's degree in Computer Science or related field

Responsibilities:
• Design and implement new features
• Collaborate with cross-functional teams
• Participate in code reviews, mentor junior developers

or paste a URL like: https://linkedin.com/jobs/view/123456789"
                              className="h-[500px] resize-none overflow-y-auto"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Right Section: Profile */}
                  <div className="flex flex-col space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Profile</h3>
                    <div className="space-y-6 flex-1">
                      {/* LinkedIn Profile */}
                      <FormField
                        control={form.control}
                        name="linkedinUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>LinkedIn URL</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://linkedin.com/in/your-handle or your-handle"
                                className="h-12"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* And/Or Separator */}
                      <div className="flex items-center justify-center">
                        <div className="flex-1 border-t border-gray-200"></div>
                        <span className="px-3 text-sm text-gray-500 bg-white">and/or</span>
                        <div className="flex-1 border-t border-gray-200"></div>
                      </div>

                      {/* CV Upload */}
                      <FormField
                        control={form.control}
                        name="cv"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CV (PDF only)</FormLabel>
                            <FormControl>
                              <div className="space-y-4">
                                {/* File upload component with optional last CV selection */}
                                <DragAndDropUpload
                                  onFileSelect={(file) => {
                                    setSelectedPreviousCV(null);
                                    field.onChange(file);
                                  }}
                                  lastSubmission={lastSubmission}
                                  selectedPreviousCV={selectedPreviousCV}
                                  onSelectLastCV={() => {
                                    if (lastSubmission) {
                                      setSelectedPreviousCV(lastSubmission.cv_file);
                                      field.onChange(lastSubmission.cv_file);
                                    }
                                  }}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500 mt-2">
                              Provide either a CV or LinkedIn URL (or both for better results)
                            </p>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Progress & Stepper */}
                {stateConfig.step >= 1 && (
                  <div className="mt-8 space-y-6">
                    {/* Step circles */}
                    <div className="flex justify-between">
                      {progressSteps.map((s, i) => {
                        const isCompleted = i < currentStepIdx;
                        const isActive = i === currentStepIdx && !stateConfig.isError;
                        const isFailed = stateConfig.isError && i === currentStepIdx;

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
                      {stateConfig.helperText ||
                        (genericError
                          ? "Something went wrong. Please try again."
                          : "Analyzing your CV & JD — this usually takes ~20 seconds. You'll be redirected when the report is ready.")}
                    </p>
                  </div>
                )}

                {/* Error */}
                {genericError && <p className="text-sm text-red-600">{genericError}</p>}

                {/* Credit display (RIGHT ABOVE THE BUTTON) */}
                <div className="text-center">
                  {isAuthed === false ? (
                    <p className="text-sm text-gray-700 mb-2">
                      Credits Remaining: <span className="font-semibold">{credits.remaining}</span> / 5
                      <span className="text-xs text-gray-500 block mt-1">
                        <a href={getLoginUrl(DIRECTUS_URL, EXTERNAL.auth_idp_key, "/dashboard")} className="text-primary-600 hover:text-primary-800 underline">Login</a> and get 15 free credits
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
                    disabled={!stateConfig.canSubmit}
                    >
                    {stateConfig.buttonText}
                  </Button>
                )}

              </form>
            </Form>
          </CardContent>
      </GlowCard>

      {/* View All Reports link for logged-in users */}
      {isAuthed === true && (
        <div className="text-center mt-4">
          <a href="/dashboard/role-fit-index" className="text-sm text-primary-600 hover:text-primary-800 underline">
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
