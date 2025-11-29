# Security Issues and TODOs

This document outlines security vulnerabilities and issues found in the Bounteer codebase that need to be addressed before deploying to production.

## CRITICAL SECURITY ISSUES

### 1. Hardcoded API Keys in Source Code

**Severity**: CRITICAL
**Location**: `src/constant.ts:4`

```typescript
directus_key: "9Qfz6A4s0RjzSPLLIR0yT7NTptiPfTGQ", // guest account
```

**Issue**: The Directus API key is hardcoded directly in the source code and committed to the public GitHub repository. This key is exposed to anyone who can view the repository.

**Impact**:
- Attackers can use this key to make unauthorized API requests to your Directus instance
- Even though labeled as "guest account", this provides access to your backend
- Key is used throughout the codebase for Bearer token authentication
- Found in 10+ locations across the codebase

**Files using this key**:
- `src/lib/utils.ts:321`
- `src/components/interactive/JobDescriptionCard.tsx:74`
- `src/components/interactive/OrbitCallDashboard.tsx:305,752`
- `src/components/interactive/ReportCard.tsx:177,188,255`
- `src/scripts/cvUploader.js:47,59,101`

**Solution**:
- [ ] Move API key to environment variables
- [ ] Create `.env` file (add to `.gitignore`)
- [ ] Use `import.meta.env.PUBLIC_DIRECTUS_KEY` or similar for client-side
- [ ] Use `import.meta.env.DIRECTUS_KEY` for server-side only
- [ ] Rotate the current API key immediately (it's already compromised)
- [ ] Set up proper Directus permissions to limit guest account access
- [ ] Consider using Directus public roles instead of a guest token

---

### 2. Guest User ID Exposed

**Severity**: HIGH
**Location**: `src/constant.ts:5`

```typescript
guest_user_id: "f25f8ce7-e4c9-40b8-ab65-40cde3409f27", // guest user id
```

**Issue**: The guest user UUID is hardcoded in source code.

**Impact**:
- Attackers know which user ID represents guest users
- Could be used to bypass authentication checks or forge guest requests
- May enable privilege escalation if not properly secured in Directus

**Solution**:
- [ ] Move to environment variable
- [ ] Review Directus permissions for the guest user
- [ ] Ensure guest user has minimal read-only permissions
- [ ] Consider if guest user is even necessary

---

### 3. XSS Vulnerability in Cover Letter Card

**Severity**: HIGH
**Location**: `src/components/interactive/CoverLetterCard.tsx:58-62`

```typescript
tempDiv.innerHTML = `
  <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
    <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Cover Letter</h1>
  </div>
  <div style="white-space: pre-wrap; text-align: justify;">${editableCoverLetter}</div>
`;
```

**Issue**: User-provided content (`editableCoverLetter`) is directly interpolated into `innerHTML` without sanitization.

**Impact**:
- Cross-Site Scripting (XSS) attack vector
- Attackers can inject malicious JavaScript
- Could steal user data, cookies, or session tokens
- Could redirect users to phishing sites

**Solution**:
- [ ] Sanitize HTML content using a library like DOMPurify
- [ ] Use `textContent` instead of `innerHTML` if HTML formatting isn't needed
- [ ] Implement Content Security Policy (CSP) headers
- [ ] Review other uses of `innerHTML` in codebase:
  - `src/components/interactive/MagicGlowEffect.tsx`
  - `src/pages/unsubscribe.astro`

---

## MEDIUM SECURITY ISSUES

### 4. Placeholder Webhook URL

**Severity**: MEDIUM
**Location**: `src/constant.ts:8`

```typescript
webhook_url: "https://webhook.site/your-webhook-endpoint" // Replace with actual webhook endpoint
```

**Issue**: Placeholder webhook URL is checked into source code.

**Impact**:
- If not replaced, webhooks will fail silently or leak data to webhook.site
- Webhook.site is a public service where anyone can view requests
- Sensitive job description data could be exposed

**Solution**:
- [ ] Move webhook URL to environment variable
- [ ] Set up actual webhook endpoint
- [ ] Add validation to ensure webhook URL is properly configured
- [ ] Consider webhook authentication/signing

---

### 5. Missing Environment Variable Configuration

**Severity**: MEDIUM
**Location**: Project-wide

**Issue**: No environment variables are used. All configuration is hardcoded in `src/constant.ts`.

**Impact**:
- Cannot have different configs for dev/staging/production
- Secrets are exposed in git history forever
- Makes it difficult to rotate keys or update endpoints

**Current hardcoded values**:
- `directus_url`: Should support different environments
- `directus_key`: MUST be in environment variables
- `guest_user_id`: Should be in environment variables
- `auth_idp_key`: Could be environment-specific
- `auth_idp_logput_url`: Could be environment-specific
- `webhook_url`: MUST be in environment variables
- `onboarding_form_url`: Could be environment-specific

**Solution**:
- [ ] Create `.env.example` file with all required variables
- [ ] Add `.env` to `.gitignore` (already missing)
- [ ] Update Astro config to load environment variables
- [ ] Refactor `src/constant.ts` to use `import.meta.env.*`
- [ ] Update deployment workflows to inject environment variables
- [ ] Document all required environment variables in README

Example `.env.example`:
```env
# Directus Configuration
PUBLIC_DIRECTUS_URL=https://directus.bounteer.com
DIRECTUS_GUEST_TOKEN=your-guest-token-here
DIRECTUS_GUEST_USER_ID=your-guest-user-id

# Authentication
PUBLIC_AUTH_IDP_KEY=logto
PUBLIC_AUTH_LOGOUT_URL=https://logto-app.bounteer.com/oidc/session/end

# Integrations
WEBHOOK_URL=https://your-webhook-endpoint.com
PUBLIC_ONBOARDING_FORM_URL=https://form.typeform.com/to/FOz4fXGm
```

---

### 6. Contact Form Without Authentication

**Severity**: MEDIUM
**Location**: `src/components/interactive/ContactForm.tsx:41-45`

```typescript
const res = await fetch(`${EXTERNAL.directus_url}/items/message`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(values),
});
```

**Issue**: Contact form submissions don't include authentication headers, relying on Directus being openly accessible for POST requests to `/items/message`.

**Impact**:
- If Directus permissions aren't configured correctly, anyone can spam the message collection
- No rate limiting on form submissions
- Could be used for DoS attacks
- Spam/bot submissions aren't prevented

**Solution**:
- [ ] Review Directus permissions for `message` collection
- [ ] Implement rate limiting (client-side and server-side)
- [ ] Add CAPTCHA or similar bot protection
- [ ] Consider using the guest token for this endpoint
- [ ] Add input validation on server-side (Directus)
- [ ] Set up webhook notifications for new messages

---

### 7. Authorization Header Exposure in Client-Side Code

**Severity**: MEDIUM
**Location**: Multiple files (see list below)

**Issue**: Authorization headers with Bearer tokens are used extensively in client-side code.

**Affected files**:
- `src/components/interactive/JobDescriptionCard.tsx:74`
- `src/components/interactive/OrbitCallDashboard.tsx:305,752`
- `src/components/interactive/ReportCard.tsx:177,188`
- `src/scripts/cvUploader.js:47,59,101`

**Impact**:
- API keys visible in browser DevTools Network tab
- Can be extracted and reused by attackers
- Guest token has whatever permissions assigned to it

**Solution**:
- [ ] Minimize use of guest token in client-side code
- [ ] Rely on user session cookies for authenticated requests where possible
- [ ] For public data, use Directus public role instead of guest token
- [ ] Implement server-side proxy for sensitive operations
- [ ] Review and minimize permissions on guest account

---

## LOW SECURITY ISSUES

### 8. TODO Comment About Authentication

**Severity**: LOW
**Location**: `src/lib/utils.ts:316`

```typescript
// TODO check if we are ussing the logged in user's session or a generic guest token
```

**Issue**: Uncertainty about authentication mechanism.

**Solution**:
- [ ] Review and document authentication flow
- [ ] Clarify when session cookies vs guest token should be used
- [ ] Update code comments with clear explanation

---

### 9. Missing .env File Configuration

**Severity**: LOW
**Location**: `.gitignore:1-5`

**Issue**: `.gitignore` doesn't explicitly include `.env*` files (though no .env files currently exist).

**Current .gitignore**:
```
/.astro
/node_modules
.DS_Store
/dist
```

**Solution**:
- [ ] Add `.env` and `.env.*` to `.gitignore`
- [ ] Add `*.env.local` pattern
- [ ] Ensure `.env.example` is NOT ignored

---

## RECOMMENDATIONS

### Immediate Actions Required

1. **IMMEDIATELY** - Rotate the exposed Directus API key (`9Qfz6A4s0RjzSPLLIR0yT7NTptiPfTGQ`)
2. **IMMEDIATELY** - Remove the hardcoded key from `src/constant.ts`
3. **IMMEDIATELY** - Set up environment variables for all secrets
4. **IMMEDIATELY** - Update `.gitignore` to include `.env*`
5. **IMMEDIATELY** - Fix XSS vulnerability in CoverLetterCard.tsx

### Short-term Actions

6. Review Directus permissions and minimize guest account access
7. Implement HTML sanitization across the codebase
8. Set up proper webhook endpoint and authentication
9. Add rate limiting to public forms
10. Implement Content Security Policy headers

### Long-term Improvements

11. Set up security scanning in CI/CD pipeline
12. Implement API request monitoring and alerting
13. Add security headers (CSP, X-Frame-Options, etc.)
14. Regular security audits of dependencies
15. Implement proper logging and audit trails
16. Consider Web Application Firewall (WAF)
17. Set up vulnerability disclosure policy

---

## Additional Security Checks Needed

- [ ] Review all Directus role permissions
- [ ] Audit Directus access logs for suspicious activity
- [ ] Check if the exposed API key has been used by unauthorized parties
- [ ] Review CORS configuration on Directus
- [ ] Ensure HTTPS is enforced everywhere
- [ ] Check for SQL injection vulnerabilities in custom Directus flows/hooks
- [ ] Review file upload security (size limits, file type validation)
- [ ] Ensure proper session management and timeout settings
- [ ] Check for CSRF protection on state-changing operations

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Astro Environment Variables](https://docs.astro.build/en/guides/environment-variables/)
- [Directus Access Control](https://docs.directus.io/configuration/security.html)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**Last Updated**: 2025-11-24
**Audited By**: Claude Code Security Audit

---

# FEATURE DEVELOPMENT TODOs

## Orbit Call - Candidate Mode Feature

### Overview
Add candidate-focused mode to Orbit Call, enabling candidates to upload their profile and search for matching jobs. This complements the existing company mode (job description → candidate search) with the reverse flow (candidate profile → job search).

### Architecture: Unified Dashboard with Mode Toggle

**Implementation Approach**: Single page with mode toggle (not separate pages)
- **Page**: `src/pages/orbit.astro` (existing, to be enhanced)
- **Component**: `OrbitCallDashboard.tsx` (add mode toggle)
- **Toggle Location**: Top of orange gradient card (not_linked stage)

### Mode Types
```typescript
type OrbitMode = "company" | "candidate";
```

### UI Design

#### Stage 1: not_linked (Gradient card with toggle)
```
┌─────────────────────────────────────────────────────────┐
│  🔄 [Company Search] [Candidate Search]  ← Mode Toggle  │
│                                                           │
│  Set Up New Orbit Call                                   │
│  [Meeting] [Testing]                                     │
│  [URL Input ________________] [Deploy]                   │
└─────────────────────────────────────────────────────────┘
```

### Mode Comparison

| Aspect | Company Mode (Current) | Candidate Mode (New) |
|--------|----------------------|---------------------|
| **Title** | "Job Description Enrichment" | "Candidate Profile Enrichment" |
| **Component** | `JobDescriptionEnrichment.tsx` | `CandidateProfileEnrichment.tsx` (NEW) |
| **Action Button** | "Search People" | "Search Jobs" |
| **Results Section** | "Potential Candidates" | "Matching Jobs" |
| **Gradient Color** | Orange (#ff6b35) | Green/Teal (#10b981) |
| **Data Model** | `JobDescriptionFormData` | `CandidateProfileFormData` (NEW) |

### Implementation Checklist

#### Phase 1: Foundation
- [ ] Get `candidate_profile` schema from Directus database
- [ ] Create `src/schemas/directus.ts` for centralized schema definitions
- [ ] Define `CandidateProfileSchema` interface
- [ ] Define `CandidateProfileFormData` type
- [ ] Define `JobSearchResult` interface
- [ ] Migrate existing types from `src/types/models.ts` to use schemas

#### Phase 2: Dashboard Enhancement
- [ ] Add `orbitMode` state to `OrbitCallDashboard.tsx`
- [ ] Add mode toggle buttons in `renderNotLinkedStage()` (line ~618)
- [ ] Add candidate-specific state variables:
  - [ ] `candidateData` state
  - [ ] `candidateProfileId` state
  - [ ] `jobSearchRequestId` state
  - [ ] `jobs` state
  - [ ] `jobSearchWsRef` WebSocket reference
- [ ] Implement mode-aware gradient colors
- [ ] Add conditional rendering based on `orbitMode`

#### Phase 3: New Components
- [ ] Create `CandidateProfileEnrichment.tsx`
  - [ ] Mirror structure of `JobDescriptionEnrichment.tsx`
  - [ ] 3-stage flow: not_linked → ai_enrichment → manual_enrichment
  - [ ] AI/Manual toggle switch
  - [ ] Form fields for candidate information
  - [ ] WebSocket/polling for real-time updates
  - [ ] Save functionality
  - [ ] Green/Teal gradient theme
- [ ] Create `JobSearchResults.tsx`
  - [ ] Card-based layout for matched jobs
  - [ ] Job fit percentage visualization
  - [ ] Job details display
  - [ ] Horizontal scrollable layout

#### Phase 4: API Integration
- [ ] Add candidate API functions to `src/lib/utils.ts`:
  - [ ] `createOrbitCandidateCallRequest()`
  - [ ] `createCandidateProfile()`
  - [ ] `updateCandidateProfile()`
  - [ ] `createJobSearchRequest()`
  - [ ] `fetchJobSearchResults()`
- [ ] Implement WebSocket subscription for job search status
- [ ] Handle job search request lifecycle

#### Phase 5: Testing & Polish
- [ ] Test company mode (ensure no regressions)
- [ ] Test candidate mode end-to-end
- [ ] Test mode switching behavior
- [ ] Test with both meeting and testing input modes
- [ ] Verify WebSocket connections
- [ ] Test form validation
- [ ] Test save functionality

### Data Models (To Be Defined)

#### Candidate Profile Schema
```typescript
// Pending: Get actual schema from Directus database
export interface CandidateProfileSchema {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  year_of_experience?: number;
  current_title?: string;
  company_name?: string;
  education?: string;
  summary?: string;
  skills?: string[]; // JSON array
  work_history?: string;
  achievements?: string;
  // ... other fields from database
  date_created?: string;
  date_updated?: string;
}

export type CandidateProfileFormData = Omit<
  CandidateProfileSchema,
  'id' | 'date_created' | 'date_updated'
>;
```

#### Job Search Result
```typescript
interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  jobFitPercentage: number;
  skills: string[];
  salary?: string;
}
```

### Expected Directus Collections

Based on existing company flow pattern:
- `orbit_candidate_call_request` (similar to `orbit_call_request`)
- `orbit_candidate_call_session` (similar to `orbit_call_session`)
- `candidate_profile` (EXISTING - need schema)
- `job_search_request` (similar to `orbit_candidate_search_request`)
- `job_search_result` (similar to `orbit_candidate_search_result`)

### Design Specifications

#### Color Schemes
- **Company Mode**: rgb(255, 154, 0) → rgb(255, 87, 34) [Orange]
- **Candidate Mode**: rgb(16, 185, 129) → rgb(5, 150, 105) [Green/Teal]

#### Toggle Button States
```typescript
// Active state
className="bg-white text-black hover:bg-gray-200"

// Inactive state
className="bg-white/20 border-white/40 text-white hover:bg-white/30 backdrop-blur-sm"
```

### Benefits
✅ Unified interface (single page for both flows)
✅ Consistent UX (same patterns and interactions)
✅ Easy mode switching without navigation
✅ Code reuse (shared URL validation, WebSocket logic)
✅ Maintainability (parallel structures)

### Open Questions
1. What are the exact fields in the Directus `candidate_profile` collection?
2. Are job postings stored in Directus or external API?
3. Do candidates and companies use different authentication/roles?
4. Should the page default to company or candidate mode?

### Files to Create
- `src/schemas/directus.ts` (centralized schema definitions)
- `src/components/interactive/CandidateProfileEnrichment.tsx`
- `src/components/interactive/JobSearchResults.tsx`

### Files to Modify
- `src/components/interactive/OrbitCallDashboard.tsx` (add mode toggle)
- `src/types/models.ts` (migrate to use schemas)
- `src/lib/utils.ts` (add candidate API functions)

### References
- Current implementation: `src/components/interactive/OrbitCallDashboard.tsx:31-844`
- Enrichment pattern: `src/components/interactive/JobDescriptionEnrichment.tsx:1-773`
- Form data types: `src/types/models.ts:65-118`

---

**Feature Status**: Planning / Documentation Phase
**Last Updated**: 2025-11-27
**Priority**: Medium
**Blocked By**: Need candidate_profile schema from database

---

## Orbit Call - Schema Deprecation & Migration Plan

**Status**: Approved - 2025-11-29
**See detailed analysis in**: `comment.md`

### 🔄 DEPRECATION: `orbit_call_session` Collection

**Decision**: Deprecate `orbit_call_session` in favor of two specific enrichment session collections.

**Rationale**:
- ✅ Better separation of concerns (job enrichment vs candidate enrichment)
- ✅ Clearer purpose and intent
- ✅ Aligns with bidirectional architecture
- ✅ Eliminates ambiguity about session type

#### Phase 1: Schema Rename & Field Updates (P0) 🔴

**IMPORTANT**: Rename generic `session` field to specific enrichment session type

- [ ] **Rename field in `orbit_candidate_search_request`**
  - Current: `session` (FK → orbit_call_session) ❌ Generic, ambiguous
  - New: `job_enrichment_session` (FK → orbit_job_description_enrichment_session) ✅
  - Reason: Recruiters enrich a job, then search for candidates
  - SQL: `ALTER TABLE orbit_candidate_search_request RENAME COLUMN session TO job_enrichment_session;`

- [ ] **Create `orbit_job_search_request` with correct field name**
  - Field: `candidate_enrichment_session` (FK → orbit_candidate_profile_enrichment_session)
  - NOT: `session` (too generic)
  - Reason: Candidates enrich their profile, then search for jobs
  - Pattern: Mirror `orbit_candidate_search_request` structure
  - Reference: comment.md section 4

- [ ] **Create `orbit_job_search_result` collection**
  - Fields: `id`, `request` (FK), `jfi_score` (integer 0-100), `job_description` (FK), `rag_score`, `pros` (json), `cons` (json), timestamps
  - Purpose: Store job matches with fit scores
  - Pattern: Mirror `orbit_candidate_search_result` structure
  - Reference: comment.md section 5

#### Phase 2: Migrate `orbit_search_request` (P0) 🔴

**Current Issue**: `orbit_search_request` references deprecated `orbit_call_session`

- [ ] **Update `orbit_search_request` schema**
  - Current: Has `orbit_call_session` FK ❌
  - New: Replace with `job_enrichment_session` FK ✅
  - SQL:
    ```sql
    -- Add new column
    ALTER TABLE orbit_search_request
      ADD COLUMN job_enrichment_session INTEGER
      REFERENCES orbit_job_description_enrichment_session(id);

    -- Migrate data: find matching enrichment session for each call session
    UPDATE orbit_search_request osr
    SET job_enrichment_session = (
      SELECT id FROM orbit_job_description_enrichment_session ojdes
      WHERE ojdes.request = (
        SELECT request FROM orbit_call_session ocs
        WHERE ocs.id = osr.orbit_call_session
      )
      AND ojdes.job_description = osr.job_description
      LIMIT 1
    );

    -- Verify migration
    SELECT COUNT(*) FROM orbit_search_request WHERE job_enrichment_session IS NULL;

    -- Drop old column
    ALTER TABLE orbit_search_request DROP COLUMN orbit_call_session;
    ```

- [ ] **Clarify `orbit_search_request` purpose**
  - Is this still used? Or is it replaced by `orbit_candidate_search_request`?
  - If deprecated: Add deprecation notice, schedule deletion
  - If active: Document how it differs from `orbit_candidate_search_request`

#### Phase 3: Deprecate `orbit_call_session` (P0) 🔴

- [ ] **Audit codebase for `orbit_call_session` usage**
  - [ ] Search frontend code (TypeScript/TSX files)
  - [ ] Search API calls to `/items/orbit_call_session`
  - [ ] Check Directus flows/hooks/webhooks
  - [ ] Document all usage locations

- [ ] **Replace `orbit_call_session` with enrichment sessions**
  - Move `host_user` field to `orbit_call_request` (parent level)
  - OR add `host_user` to both enrichment sessions
  - Update all code references to use specific enrichment sessions

- [ ] **Add deprecation notice in Directus**
  - Mark collection as deprecated
  - Add note: "Use orbit_job_description_enrichment_session or orbit_candidate_profile_enrichment_session"
  - Set deprecation date: 2025-12-01

- [ ] **Remove `orbit_call_session` collection**
  - Wait 30-90 days after deprecation notice
  - Verify no active usage
  - Backup existing data
  - Drop collection

### Critical Schema Changes Required (P0) ❌

#### 2. Extend Existing Collections

- [ ] **Add `mode` field to `orbit_call_request`** (NOT orbit_call_session - that's deprecated)
  - Type: `enum("recruiter", "candidate")`
  - Required: YES (after backfill)
  - Purpose: Identify which mode the call request is using
  - Migration: Set existing records to "recruiter"
  - Location: Parent level (orbit_call_request) since it applies to the entire call

- [ ] **Add `host_user` to `orbit_call_request`** (move from deprecated orbit_call_session)
  - Type: `uuid` (FK → users)
  - Nullable: NO
  - Purpose: Track who initiated the call
  - Migration: Copy from existing orbit_call_session records before deletion

#### 3. Fix Data Type Issues

- [ ] **Fix `candidate_profile.year_of_experience`**
  - Current: `string` ❌
  - Should be: `integer` or `float`
  - Impact: Enables numeric comparisons for job matching
  - Migration: Parse existing string values to integers

### High Priority Schema Improvements (P1) ⚠️

#### 4. Enhance `candidate_profile` Collection

Missing fields needed for job search:

- [ ] Add `first_name: string`
- [ ] Add `last_name: string`
- [ ] Add `email: string`
- [ ] Add `phone: string`
- [ ] Add `linkedin_url: string`
- [ ] Add `education: text`
- [ ] Add `preferred_locations: json` (array of strings)
- [ ] Add `remote_preference: enum("remote", "hybrid", "onsite", "flexible")`
- [ ] Add `preferred_employment_types: json` (array: ["full-time", "contract"])
- [ ] Add `availability: string` ("immediately", "2 weeks", etc.)
- [ ] Add `work_authorization: string` ("US Citizen", "H1B", etc.)
- [ ] Add `resume_file: uuid` (FK → directus_files)
- [ ] Add `career_goals: text`
- [ ] Add `salary_expectation_min: integer`
- [ ] Add `salary_expectation_max: integer`

#### 5. Enhance `job_description` Collection

Missing fields for better matching:

- [ ] Add `remote_policy: enum("remote", "hybrid", "onsite")`
- [ ] Add `employment_type: enum("full-time", "part-time", "contract")`
- [ ] Add `seniority_level: enum("entry", "junior", "mid", "senior", "lead")`
- [ ] Add `visa_sponsorship: boolean`
- [ ] Add `is_active: boolean`
- [ ] Verify `skill: json` field exists (mentioned in code but not seen in schema)

#### 6. Document Status Enums

- [ ] Create enum type for `search_request_status`
  - Values: "pending", "processing", "listed", "failed"
  - Apply to: `orbit_candidate_search_request`, `orbit_job_search_request`

- [ ] Document valid values for existing string fields:
  - `orbit_call_session.mode`
  - `candidate_profile.employment_type`
  - `candidate_profile.remote_preference`
  - `job_description.backfill_status`

### Medium Priority - Schema Optimization (P2)

#### 7. Database Constraints & Validation

- [ ] Add NOT NULL constraints to critical FKs:
  - `orbit_candidate_search_request.session`
  - `orbit_candidate_search_result.request`
  - `orbit_job_search_request.session`
  - `orbit_job_search_result.request`

- [ ] Add CHECK constraints for score ranges:
  - `orbit_candidate_search_result.rfi_score` (0-100)
  - `orbit_job_search_result.jfi_score` (0-100)

- [ ] Add enum constraints where applicable (see P1 item 6)

#### 8. Performance Indexes

- [ ] Create index: `idx_orbit_call_session_mode` on `orbit_call_session(mode)`
- [ ] Create index: `idx_orbit_call_session_host_user` on `orbit_call_session(host_user)`
- [ ] Create index: `idx_candidate_search_request_status` on `orbit_candidate_search_request(status)`
- [ ] Create index: `idx_candidate_search_result_rfi_score` on `orbit_candidate_search_result(rfi_score DESC)`
- [ ] Create index: `idx_job_search_request_status` on `orbit_job_search_request(status)`
- [ ] Create index: `idx_job_search_result_jfi_score` on `orbit_job_search_result(jfi_score DESC)`
- [ ] Create composite index: `idx_candidate_profile_location_experience`
- [ ] Create composite index: `idx_job_description_location_active`

#### 9. Security & Privacy

- [ ] Add to `candidate_profile`:
  - `consent_given: boolean`
  - `consent_date: timestamp`
  - `data_retention_until: date`
  - `is_public: boolean`

- [ ] Review and configure Directus permissions:
  - Candidate role: Can manage own profile, view matched jobs only
  - Recruiter role: Can manage job descriptions, view matched candidates only
  - Admin role: Full access

- [ ] Implement row-level security for sensitive data

### Low Priority - Cleanup & Documentation (P3)

#### 10. Resolve Ambiguous Collections

- [ ] **Investigate `orbit_search_request` collection**
  - Document: What is this used for?
  - Question: Is it deprecated?
  - Action: Rename, consolidate, or remove

- [ ] **Investigate `orbit_search_result` collection**
  - Document: How does it differ from `orbit_candidate_search_result`?
  - Question: Is it for job search or deprecated?
  - Action: Clarify purpose or deprecate

- [ ] **Document `role_fit_index_submission`**
  - What is this array?
  - How is it used in scoring?

#### 11. Schema Documentation

- [ ] Create `reference/schema-docs.md` with:
  - Field descriptions for all collections
  - Valid enum values
  - Relationship cardinality
  - Required vs optional fields
  - JSON field structures
  - Score calculation methods

- [ ] Add inline comments to schema fields in Directus

- [ ] Document status lifecycles (pending → processing → listed → failed)

#### 12. Data Migration Plan

- [ ] Document migration steps for:
  - Adding `orbit_call_session.mode` field
  - Backfilling mode = "recruiter" for existing sessions
  - Converting `year_of_experience` from string to integer
  - Adding new nullable fields

- [ ] Create rollback plan for schema changes

### Open Questions for Product/Backend Team

1. **Job Source**: Are jobs stored in Directus `job_description` or fetched from external API?
2. **Authentication**: Do candidates and recruiters have different Directus roles/permissions?
3. **AI Scoring**: Where are RFI/RAG scores computed? (Backend service? Directus Flow?)
4. **WebSocket**: Is status update WebSocket Directus built-in or custom implementation?
5. **Deprecated Collections**: Can we safely remove `orbit_search_request/result`?
6. **Data Retention**: What's the policy for cleaning up old search requests and snapshots?

### Dependencies & Blockers

**Blocked by Backend/DB Team:**
- All P0 schema changes (critical path)
- Understanding of deprecated collections
- Confirmation of job source (Directus vs external)

**Blocked by Product:**
- Default mode decision (recruiter vs candidate)
- Privacy/consent requirements
- Data retention policies

**Can proceed in parallel:**
- Frontend UI development (with mock data)
- Component creation (CandidateProfileEnrichment, JobSearchResults)
- API utility functions (with TypeScript interfaces)

---

**Schema Review Status**: Complete - See comment.md
**Last Updated**: 2025-11-27
**Reviewer**: Claude Code
**Priority**: P0 items are critical for bidirectional functionality
