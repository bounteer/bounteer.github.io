export function cvUploader(cfg) {
  return {
    // config (injected via data-* attributes on the wrapper)
    directusUrl: cfg.directusUrl,
    token: cfg.directusToken,
    wsUrl: cfg.wsUrl,
    reportUrlTemplate: cfg.reportUrlTemplate || "/report/{id}",

    // state
    isDragging: false,
    isBusy: false,
    fileName: "",
    fileObj: null,
    error: "",
    step: 0,                 // 0 idle, 1 uploading, 2 waiting, 3 done
    submissionId: null,
    buttonText: "Analyze Role Fit",
    wsHandle: null,
    pollTimer: null,

    // handlers
    handleFile(file) { this.validateFile(file); },
    handleDrop(ev) { const f = ev.dataTransfer.files?.[0]; this.validateFile(f); },
    validateFile(file) {
      if (!file) { this.error = "No file selected"; return false; }
      const maxSize = 2 * 1024 * 1024;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (file.size > maxSize) { this.error = "File is too large. Max 2MB."; this.fileName = ""; this.fileObj = null; return false; }
      if (ext !== "pdf" || file.type !== "application/pdf") { this.error = "Only PDF allowed."; this.fileName = ""; this.fileObj = null; return false; }
      this.error = ""; this.fileName = file.name; this.fileObj = file; return true;
    },

    async analyze() {
      try {
        if (!this.fileObj) { this.error = "Please select a PDF"; return; }
        const jdText = this.$refs.jdInput?.value?.trim();
        if (!jdText) { this.error = "Please paste the JD"; return; }
        if (!this.directusUrl || !this.token) { this.error = "Missing Directus config"; return; }

        // STEP 1: Uploading (overlay visible)
        this.step = 1; this.isBusy = true; this.buttonText = "Uploading CV…";

        const fd = new FormData();
        fd.append("file", this.fileObj, this.fileName || "cv.pdf");
        const upRes = await fetch(`${this.directusUrl}/files`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.token}` },
          body: fd,
        });
        const upJson = await upRes.json();
        if (!upRes.ok) throw new Error(upJson?.errors?.[0]?.message || "Upload failed");
        const fileId = upJson?.data?.id;

        // Create submission (still step 1)
        this.buttonText = "Saving submission…";
        const subRes = await fetch(`${this.directusUrl}/items/submissions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ jd_text: jdText, cv_file: fileId, status: "uploaded" }),
        });
        const subJson = await subRes.json();
        if (!subRes.ok) throw new Error(subJson?.errors?.[0]?.message || "Submission failed");
        this.submissionId = subJson?.data?.id;

        // STEP 2: Waiting (overlay stays)
        this.step = 2; this.buttonText = "Awaiting report…";
        this.openWsAndWait(this.submissionId);
        this.startPolling(this.submissionId);

      } catch (e) {
        this.error = e?.message || "Unexpected error";
        this.isBusy = false; this.step = 0; this.buttonText = "Analyze Role Fit";
        this.clearWaiting();
      }
    },

    openWsAndWait(submissionId) {
      if (!this.wsUrl) return;
      try {
        const url = new URL(this.wsUrl);
        url.searchParams.set("submission_id", submissionId);
        this.wsHandle = new WebSocket(url.toString());
        this.wsHandle.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg?.type === "report_ready" && String(msg?.submission_id) === String(submissionId)) {
              this.finishAndGo(msg?.report_id ?? submissionId);
            }
          } catch { }
        };
      } catch { }
    },

    startPolling(submissionId) {
      const check = async () => {
        try {
          const res = await fetch(`${this.directusUrl}/items/submissions/${submissionId}?fields=id,status,report_id`, {
            headers: { Authorization: `Bearer ${this.token}` }
          });
          const json = await res.json();
          const status = json?.data?.status;
          const reportId = json?.data?.report_id || submissionId;
          if (status === "completed" || json?.data?.report_id) {
            this.finishAndGo(reportId);
            return true;
          }
        } catch { }
        return false;
      };
      let tries = 0;
      this.pollTimer = setInterval(async () => {
        tries++;
        const ok = await check();
        if (ok || tries > 30) this.clearWaiting();   // stop after ~2min
      }, 4000);
    },

    clearWaiting() {
      if (this.wsHandle) try { this.wsHandle.close(); } catch { }
      if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    },

    cancelWaiting() {
      this.clearWaiting();
      this.isBusy = false;
      this.step = 0;
      this.buttonText = "Analyze Role Fit";
    },

    finishAndGo(reportId) {
      this.clearWaiting();
      this.step = 3;
      this.isBusy = false;
      this.buttonText = "Opening report…";
      const target = this.reportUrlTemplate.replace("{id}", reportId);
      window.location.href = target;
    }
  };
}
