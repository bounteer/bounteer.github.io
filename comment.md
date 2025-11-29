# Orbit Call Schema Analysis & Comments

**Date**: 2025-11-27 (Initial Review)
**Updated**: 2025-11-29 (Deprecation Decision)
**Purpose**: Schema review for bidirectional Orbit Call tool (recruiter ↔ candidate matching)

---

## 🔄 DEPRECATION DECISION (2025-11-29)

**Status**: ✅ Approved

### Decision: Deprecate `orbit_call_session`

Replace with specific enrichment sessions:
- `orbit_job_description_enrichment_session` (recruiter mode)
- `orbit_candidate_profile_enrichment_session` (candidate mode)

**Rationale**:
1. ✅ **Clarity**: Specific collection names eliminate ambiguity
2. ✅ **Separation of Concerns**: Each collection has a clear purpose
3. ✅ **Symmetry**: Parallel structure for bidirectional architecture
4. ✅ **Type Safety**: No polymorphic mode field needed

### Field Naming Standard: `{entity}_enrichment_session`

**Decision**: Use specific, descriptive foreign key names

```typescript
// ❌ BAD: Generic "session" field (ambiguous)
orbit_candidate_search_request {
  session → orbit_call_session  // Which type of session?
}

// ✅ GOOD: Specific enrichment session type (self-documenting)
orbit_candidate_search_request {
  job_enrichment_session → orbit_job_description_enrichment_session
}

orbit_job_search_request {
  candidate_enrichment_session → orbit_candidate_profile_enrichment_session
}
```

**Benefits**:
- Self-documenting: Field name indicates what it references
- Prevents confusion: No ambiguity about session type
- IDE autocomplete: Clearer suggestions
- Database queries: Easier to understand relationships

See TODO.md for detailed migration plan.

---

## Executive Summary

The Directus schema at `reference/schema.json` is **well-designed** for one-way flow (recruiter searches for candidates) but **lacks critical collections** for bidirectional functionality (candidate searches for jobs).

**Current Capability**: ✅ Recruiter → Candidate (80% complete)
**Missing Capability**: ❌ Candidate → Job (0% complete)

---

## Current Schema Collections

### ✅ Existing Collections for Orbit Call

1. **`orbit_call_session`** - Main video call session
2. **`orbit_call_request`** - Request to start/join call
3. **`orbit_candidate_search_request`** - Search for candidates matching a job
4. **`orbit_candidate_search_result`** - Candidate matches with scores
5. **`orbit_search_request`** - Purpose unclear (possibly deprecated?)
6. **`orbit_search_result`** - Purpose unclear (possibly deprecated?)
7. **`orbit_search_result_role_fit_index_submission`** - Scoring submissions
8. **`job_description`** - Job posting details
9. **`candidate_profile`** - Candidate information

---

## Detailed Collection Analysis

### 1. `orbit_call_session` ⚠️ DEPRECATED - Use enrichment sessions instead

**Status**: 🔴 **MARKED FOR DEPRECATION** (2025-11-29)

**Current Schema:**
```typescript
{
  id: integer (PK)
  job_description: integer (FK → job_description) // nullable
  request: integer (FK → orbit_call_request) // nullable
  host_user: uuid (FK → users) // nullable
  user_created: uuid
  date_created: timestamp
  user_updated: uuid
  date_updated: timestamp
}
```

**Deprecation Reason:**
This collection is ambiguous - it doesn't clearly indicate whether it's for job enrichment or candidate enrichment.

**Replacement Strategy:**
- For recruiter mode: Use `orbit_job_description_enrichment_session`
- For candidate mode: Use `orbit_candidate_profile_enrichment_session`
- Move `host_user` field to `orbit_call_request` (parent level)

**Migration Path:**
1. Update `orbit_search_request` to reference `orbit_job_description_enrichment_session`
2. Migrate `host_user` to `orbit_call_request`
3. Update all frontend code to use enrichment sessions
4. Add deprecation notice in Directus
5. Remove collection after 30-90 days

**See**: TODO.md "Schema Deprecation & Migration Plan" for detailed steps

---

### 2. `orbit_candidate_search_request` ✅ Excellent design pattern (with field rename needed)

**Current Schema:**
```typescript
{
  id: integer (PK)
  session: integer (FK → orbit_call_session) // ⚠️ RENAME TO: job_enrichment_session
  job_description_snapshot: json // nullable
  status: string // nullable
  user_created: uuid
  date_created: timestamp
  user_updated: uuid
  date_updated: timestamp
}
```

**Required Change:**
- **Rename**: `session` → `job_enrichment_session`
- **New FK**: Point to `orbit_job_description_enrichment_session` (not deprecated `orbit_call_session`)
- **Reason**: Clarity - the field name should indicate what it references

**Strengths:**
- ✅ **Excellent**: Uses snapshot to preserve search criteria
- ✅ Separates request from results (good normalization)
- ✅ Status tracking for request lifecycle
- ✅ Links back to session

**Issues:**
- ⚠️ Status field has no documented valid values
- ⚠️ No constraint on status values (enum would be better)
- ⚠️ No metadata about search (number of results, duration, etc.)

**Inferred Status Values:**
Based on `OrbitCallDashboard.tsx:308`, valid statuses appear to be:
- `"pending"` - Search request created
- `"processing"` - Search in progress
- `"listed"` - Results available
- `"failed"` - Search failed

**Recommended Additions:**
```typescript
{
  status: enum("pending", "processing", "listed", "failed") // make explicit
  search_filters: json // optional advanced filters
  results_count: integer // number of results found
  search_duration_ms: integer // performance tracking
}
```

**This is an excellent pattern and should be replicated for job search.**

---

### 3. `orbit_candidate_search_result` ✅ Outstanding scoring system

**Current Schema:**
```typescript
{
  id: integer (PK)
  request: integer (FK → orbit_candidate_search_request) // nullable
  rfi_score: integer // Role Fit Index (nullable)
  candidate_profile: integer (FK → candidate_profile) // nullable
  rag_score: integer // RAG score (nullable)
  pros: json // nullable
  cons: json // nullable
  user_created: uuid
  date_created: timestamp
  user_updated: uuid
  date_updated: timestamp
}
```

**Strengths:**
- ✅ **Outstanding**: Dual scoring system (RFI + RAG)
- ✅ **Outstanding**: Stores pros/cons for explainability
- ✅ Many-to-one with request (proper normalization)
- ✅ Links to candidate profile for details

**Implementation Notes:**
- `rfi_score` appears to be 0-100 integer (from UI: `OrbitCallDashboard.tsx:554`)
- `pros` and `cons` appear to be JSON arrays of strings
- Results are fetched with expanded candidate_profile fields

**No changes needed** - this collection is exemplary and should serve as the template for `orbit_job_search_result`.

---

### 4. **MISSING: `orbit_job_search_request`** ❌ CRITICAL

**This collection does not exist but is essential for bidirectional functionality.**

**Proposed Schema:**
```typescript
{
  id: integer (PK)
  candidate_enrichment_session: integer (FK → orbit_candidate_profile_enrichment_session) // NOT "session"!
  candidate_profile_snapshot: json // nullable - snapshot of candidate data
  status: enum("pending", "processing", "listed", "failed")
  search_filters: json // nullable - optional filters like location, remote, salary
  results_count: integer // nullable
  search_duration_ms: integer // nullable
  user_created: uuid
  date_created: timestamp
  user_updated: uuid
  date_updated: timestamp
}
```

**Important**: Use `candidate_enrichment_session` (not generic `session`) for clarity and consistency.

**Purpose:**
- Enables candidates to search for matching jobs during video call
- Mirrors `orbit_candidate_search_request` structure
- Stores candidate profile snapshot for consistent results

**Usage Pattern:**
```typescript
// In CandidateProfileEnrichment.tsx (to be created)
const result = await createJobSearchRequest(
  orbitCallSession.id,
  candidateProfileSnapshot,
  EXTERNAL.directus_url
);
```

**WebSocket Monitoring:**
```typescript
// Subscribe to orbit_job_search_request updates
// Watch for status change to "listed"
// Fetch results when ready
```

---

### 5. **MISSING: `orbit_job_search_result`** ❌ CRITICAL

**This collection does not exist but is essential for bidirectional functionality.**

**Proposed Schema:**
```typescript
{
  id: integer (PK)
  request: integer (FK → orbit_job_search_request) // nullable
  jfi_score: integer // Job Fit Index 0-100 (nullable)
  job_description: integer (FK → job_description) // nullable
  rag_score: integer // RAG-based relevance score (nullable)
  pros: json // nullable - array of strings: why this job matches
  cons: json // nullable - array of strings: potential concerns
  match_reasoning: text // nullable - AI explanation
  user_created: uuid
  date_created: timestamp
  user_updated: uuid
  date_updated: timestamp
}
```

**Purpose:**
- Stores job matches for candidates
- Parallel structure to `orbit_candidate_search_result`
- Enables ranking and filtering of job opportunities

**Display:**
```typescript
interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  jobFitPercentage: number; // from jfi_score
  skills: string[];
  pros: string[];
  cons: string[];
}
```

---

### 6. `candidate_profile` ⚠️ Needs improvement

**Current Schema:**
```typescript
{
  id: integer (PK)
  name: string // nullable
  year_of_experience: string // nullable - ⚠️ SHOULD BE INTEGER
  job_title: string // nullable
  employment_type: string // nullable
  company_size: string // nullable
  location: string // nullable
  salary_range: string // nullable
  skills: json // nullable
  raw: string // nullable
  context: string // nullable
  source: string // nullable
  client_id: string // nullable
  user_created: uuid
  date_created: timestamp
  user_updated: uuid
  date_updated: timestamp
}
```

**Issues:**

#### Issue 1: Data Type Problems
- ❌ `year_of_experience` is `string` but should be `integer` or `float`
  - Makes numeric comparisons difficult
  - Inconsistent with job requirements

#### Issue 2: Missing Critical Fields
For job search functionality, candidates need to specify:
- ❌ No `education` field
- ❌ No `preferred_locations` (array for job search)
- ❌ No `work_authorization` (visa status)
- ❌ No `availability` or `notice_period`
- ❌ No `linkedin_url` or social profiles
- ❌ No contact fields (`email`, `phone`)
- ❌ No `resume_file` attachment
- ❌ No `career_goals` or `preferred_roles`
- ❌ No `remote_preference` (remote/hybrid/onsite)
- ❌ No `preferred_employment_types` (full-time/contract/etc)

#### Issue 3: Unclear Field Structures
- ⚠️ `skills` structure not documented (array? object?)
- ⚠️ `raw` and `context` purposes unclear
- ⚠️ `source` values not enumerated

**Recommended Additions:**
```typescript
{
  // Fix existing
  year_of_experience: integer (not string)

  // Contact & identity
  first_name: string
  last_name: string
  email: string
  phone: string
  linkedin_url: string
  portfolio_url: string

  // Employment preferences
  preferred_locations: json // array of location strings
  remote_preference: enum("remote", "hybrid", "onsite", "flexible")
  preferred_employment_types: json // ["full-time", "contract"]
  availability: string // "immediately", "2 weeks", "1 month"
  notice_period: string
  work_authorization: string // "US Citizen", "Green Card", "H1B"

  // Professional background
  education: text
  certifications: json
  resume_file: uuid (FK → directus_files)
  career_goals: text

  // Compensation
  salary_expectation_min: integer
  salary_expectation_max: integer
  salary_currency: string

  // Additional
  languages: json // [{"language": "English", "proficiency": "Native"}]
  willing_to_relocate: boolean
}
```

---

### 7. `job_description` ⚠️ Mostly complete

**Current Schema (partial, from schema.json:18585-18665):**
```typescript
{
  id: integer (PK)
  role_name: string // nullable
  raw_input: string // nullable
  minimum_requirement: string // nullable
  preferred_requirement: string // nullable
  company_name: string // nullable
  location: string // nullable
  responsibility: string // nullable
  salary_range: string // nullable
  backfill_status: string // nullable
  perk: string // nullable
  user_created: uuid
  date_created: timestamp
  user_updated: uuid
  date_updated: timestamp
}
```

**Strengths:**
- ✅ Core fields for job posting
- ✅ Separates minimum vs preferred requirements
- ✅ Stores raw input for reference

**Missing Fields for Job Search:**
```typescript
{
  // Missing but needed for matching
  skill: json // array of required skills - mentioned in code but not seen in schema
  remote_policy: enum("remote", "hybrid", "onsite")
  employment_type: enum("full-time", "part-time", "contract", "temporary")
  seniority_level: enum("entry", "junior", "mid", "senior", "lead", "executive")
  team_size: integer
  reporting_to: string
  benefits: text
  work_authorization_requirements: json
  relocation_assistance: boolean
  visa_sponsorship: boolean
  job_posted_date: date
  application_deadline: date
  is_active: boolean
}
```

---

### 8. `orbit_search_request` & `orbit_search_result` ❓ Purpose unclear

**Schema:**
```typescript
// orbit_search_request
{
  id: integer
  job_description: integer (FK)
  orbit_call_session: integer (FK)
}

// orbit_search_result
{
  id: integer
  status: string
  request: integer (FK)
  query: json
  role_fit_index_submission: array
}
```

**Questions:**
1. 🤔 Are these collections still in use?
2. 🤔 How do they differ from `orbit_candidate_search_request/result`?
3. 🤔 Is this for job search or candidate search?
4. 🤔 What is `role_fit_index_submission`?

**Recommendation:**
- **If unused**: Mark as deprecated and remove from active schema
- **If for job search**: Rename to clarify purpose and extend for full functionality
- **If duplicate**: Consolidate with `orbit_candidate_search_*`
- **Document**: Add comments explaining purpose and relationship to other collections

---

## Bidirectional Architecture

### Current Flow (Recruiter Mode Only)

```
User (Recruiter)
    ↓
orbit_call_request (meeting URL)
    ↓
orbit_call_session (created)
    ↓
job_description (AI extracted + manually enriched)
    ↓
orbit_candidate_search_request (status: pending → listed)
    ↓
orbit_candidate_search_result[] (candidates with RFI scores)
    ↓
Display candidates with match percentages
```

### Proposed Flow (Candidate Mode)

```
User (Candidate)
    ↓
orbit_call_request (meeting URL)
    ↓
orbit_call_session (created) + mode: "candidate"
    ↓
candidate_profile (AI extracted + manually enriched)
    ↓
orbit_job_search_request ❌ MISSING (status: pending → listed)
    ↓
orbit_job_search_result[] ❌ MISSING (jobs with JFI scores)
    ↓
Display jobs with match percentages
```

### Unified Session Model

**Recommendation:** Make `orbit_call_session` polymorphic

```typescript
{
  id: integer
  mode: enum("recruiter", "candidate")
  entity_type: enum("job_description", "candidate_profile")
  entity_id: integer // polymorphic FK
  request: integer (FK)
  host_user: uuid

  // Keep legacy fields for backward compatibility
  job_description: integer (FK) // used when mode="recruiter"
  candidate_profile: integer (FK) // used when mode="candidate"
}
```

This allows:
- Single session table for both modes
- Clear identification of session purpose
- Easy querying by mode
- Backward compatibility with existing data

---

## Schema Relationships

### Current State

```
orbit_call_request → orbit_call_session
                           ↓
                    job_description
                           ↓
            orbit_candidate_search_request
                           ↓
            orbit_candidate_search_result
                           ↓
                    candidate_profile
```

### Proposed State (Bidirectional)

```
orbit_call_request → orbit_call_session (mode toggle)
                          ↓              ↓
                  job_description   candidate_profile
                        ↓                    ↓
          orbit_candidate_search_request  orbit_job_search_request ❌
                        ↓                    ↓
          orbit_candidate_search_result  orbit_job_search_result ❌
                        ↓                    ↓
                 candidate_profile      job_description
```

**Symmetry:** Each mode has parallel collections and workflows.

---

## Data Snapshots Strategy

**Current Implementation:** ✅ Excellent approach

The schema uses snapshots (`job_description_snapshot` in `orbit_candidate_search_request`) to preserve search criteria. This is excellent because:

1. ✅ Results remain consistent even if job description is edited
2. ✅ Historical searches are reproducible
3. ✅ Audit trail of what was searched
4. ✅ No broken references if entities are deleted

**Apply to candidate mode:**
- `orbit_job_search_request.candidate_profile_snapshot` should store complete candidate data at search time

**Snapshot Structure:**
```typescript
// job_description_snapshot
{
  company_name: string,
  role_name: string,
  location: string,
  salary_range: string,
  responsibility: string,
  minimum_requirement: string,
  preferred_requirement: string,
  perk: string,
  skill: string[]
}

// candidate_profile_snapshot (proposed)
{
  name: string,
  job_title: string,
  year_of_experience: number,
  location: string,
  salary_range: string,
  skills: string[],
  preferred_locations: string[],
  remote_preference: string,
  // ... other relevant fields
}
```

---

## Scoring Systems

### RFI (Role Fit Index) - For Candidate Search ✅

**Current:** `orbit_candidate_search_result.rfi_score` (integer 0-100)

**Purpose:** How well a candidate matches a job
**Display:** Used in UI as percentage (92% = strong match)

**Color Coding (from OrbitCallDashboard.tsx:405-410):**
- 90-100: Green (excellent match)
- 75-89: Yellow (good match)
- 60-74: Orange (moderate match)
- 0-59: Red (poor match)

### JFI (Job Fit Index) - For Job Search ❌ NEEDED

**Proposed:** `orbit_job_search_result.jfi_score` (integer 0-100)

**Purpose:** How well a job matches a candidate
**Should mirror RFI implementation**

### RAG Score - Both Modes ✅

**Current:** Both result collections have `rag_score`

**Purpose:** Retrieval Augmented Generation relevance score
**Usage:** Secondary scoring metric, possibly from AI model

**Questions:**
- What scale is RAG score on? (0-100? 0-1?)
- How does it differ from RFI/JFI?
- Is it used in ranking?

---

## Status Lifecycles

### Candidate Search Request Status

**Inferred from code (OrbitCallDashboard.tsx):**

1. `"pending"` - Request created, not yet processing
2. `"processing"` - AI/backend is searching candidates
3. `"listed"` - Results available in database
4. `"failed"` - Search failed (error occurred)

**WebSocket monitors status changes:**
```typescript
// OrbitCallDashboard.tsx:302
if (rec.status === "listed") {
  // Fetch results
  fetchCandidateSearchResults(requestId);
}
```

### Job Search Request Status (Proposed)

**Should mirror candidate search:**

1. `"pending"` - Request created
2. `"processing"` - Searching jobs
3. `"listed"` - Results available
4. `"failed"` - Search failed

---

## Security & Privacy Considerations

### 1. Personal Identifiable Information (PII)

**Collections with PII:**
- `candidate_profile`: name, email, phone, location, linkedin_url
- `candidate_profile.raw`: May contain resume text with sensitive info
- `job_description.raw_input`: May contain internal company info

**Recommendations:**
- ✅ Add `consent_given: boolean` to `candidate_profile`
- ✅ Add `consent_date: timestamp` to track when consent obtained
- ✅ Add `data_retention_until: date` for GDPR compliance
- ✅ Implement data anonymization for expired profiles
- ✅ Add `is_public: boolean` to control profile visibility

### 2. Access Control

**Questions:**
- Who can see candidate profiles? (Only after match? Always?)
- Who can see job descriptions? (Only posted jobs? Internal drafts?)
- Can candidates see other candidates?
- Can recruiters see other companies' jobs?

**Recommendations:**
- Implement Directus role-based access control
- Separate permissions for:
  - `candidate_profile_owner`: Full access to own profile
  - `recruiter`: Can see matched candidates only
  - `candidate`: Can see matched jobs only
  - `admin`: Full access

### 3. Data Retention

**Current:** No expiration fields

**Recommendations:**
```typescript
// Add to relevant collections
{
  expires_at: timestamp // Auto-delete after date
  is_archived: boolean // Soft delete
  archived_at: timestamp
  retention_policy: enum("30_days", "90_days", "1_year", "indefinite")
}
```

### 4. Audit Trail

**Current:** ✅ Good
- `user_created`, `date_created`
- `user_updated`, `date_updated`

**Additional recommendations:**
- Track who viewed candidate profiles
- Track who viewed job descriptions
- Log all search requests
- Monitor API key usage (from constant.ts)

---

## Performance Considerations

### Indexing Recommendations

```sql
-- High priority indexes
CREATE INDEX idx_orbit_call_session_mode ON orbit_call_session(mode);
CREATE INDEX idx_orbit_call_session_host_user ON orbit_call_session(host_user);
CREATE INDEX idx_candidate_search_request_status ON orbit_candidate_search_request(status);
CREATE INDEX idx_candidate_search_result_rfi_score ON orbit_candidate_search_result(rfi_score DESC);
CREATE INDEX idx_job_search_request_status ON orbit_job_search_request(status); -- when created
CREATE INDEX idx_job_search_result_jfi_score ON orbit_job_search_result(jfi_score DESC); -- when created

-- Foreign key indexes
CREATE INDEX idx_candidate_search_request_session ON orbit_candidate_search_request(session);
CREATE INDEX idx_candidate_search_result_request ON orbit_candidate_search_result(request);
CREATE INDEX idx_job_search_request_session ON orbit_job_search_request(session);
CREATE INDEX idx_job_search_result_request ON orbit_job_search_result(request);

-- Composite indexes for common queries
CREATE INDEX idx_candidate_profile_location_experience ON candidate_profile(location, year_of_experience);
CREATE INDEX idx_job_description_location_active ON job_description(location, is_active);
```

### Query Optimization

**Current potential issue:**
```typescript
// OrbitCallDashboard.tsx:511
const response = await fetch(
  `${EXTERNAL.directus_url}/items/orbit_candidate_search_result?` +
  `filter[request][_eq]=${searchRequestId}&` +
  `fields=*,candidate_profile.id,candidate_profile.name,...`
);
```

This loads all fields (`*`) which may be wasteful.

**Recommendation:**
- Only fetch needed fields
- Use GraphQL if available for more efficient queries
- Implement pagination for large result sets

---

## Schema Validation & Constraints

### Missing Constraints

**Current:** Most foreign keys are nullable, which may allow orphaned records.

**Recommendations:**

1. **Required FKs:**
```sql
-- These should NOT be nullable
ALTER TABLE orbit_candidate_search_request
  ALTER COLUMN session SET NOT NULL;

ALTER TABLE orbit_candidate_search_result
  ALTER COLUMN request SET NOT NULL;

ALTER TABLE orbit_job_search_request
  ALTER COLUMN session SET NOT NULL;

ALTER TABLE orbit_job_search_result
  ALTER COLUMN request SET NOT NULL;
```

2. **Status Enums:**
```sql
CREATE TYPE search_request_status AS ENUM (
  'pending',
  'processing',
  'listed',
  'failed'
);

ALTER TABLE orbit_candidate_search_request
  ALTER COLUMN status TYPE search_request_status;

ALTER TABLE orbit_job_search_request
  ALTER COLUMN status TYPE search_request_status;
```

3. **Score Ranges:**
```sql
ALTER TABLE orbit_candidate_search_result
  ADD CONSTRAINT rfi_score_range CHECK (rfi_score >= 0 AND rfi_score <= 100);

ALTER TABLE orbit_job_search_result
  ADD CONSTRAINT jfi_score_range CHECK (jfi_score >= 0 AND jfi_score <= 100);
```

4. **Mode Validation:**
```sql
CREATE TYPE orbit_call_mode AS ENUM ('recruiter', 'candidate');

ALTER TABLE orbit_call_session
  ADD COLUMN mode orbit_call_mode;
```

---

## Documentation Gaps

### What's Missing from Schema

1. **Field descriptions:** No comments on what each field stores
2. **Valid value enums:** Status, mode, employment_type, etc. not documented
3. **Relationship cardinality:** One-to-many? Many-to-many?
4. **Required vs optional:** All fields nullable, unclear what's required
5. **Data formats:** JSON fields structure not documented
6. **Score calculations:** How are RFI/RAG scores computed?

### Recommended Documentation

Create `reference/schema-docs.md`:
```markdown
# Directus Schema Documentation

## Collections

### orbit_call_session
Main video call session record.

**Fields:**
- `id` (integer, required, PK): Unique session identifier
- `mode` (enum, required): "recruiter" | "candidate"
- `job_description` (FK, optional): Job being discussed (recruiter mode)
- `candidate_profile` (FK, optional): Candidate profile (candidate mode)
...

**Relationships:**
- Belongs to: orbit_call_request
- Has many: orbit_candidate_search_request, orbit_job_search_request

**Access Control:**
- Creator: Full access
- Session participants: Read access
- Others: No access
```

---

## Migration Path

### Phase 1: Schema Extension (No Breaking Changes)

1. Add new collections:
   - `orbit_job_search_request`
   - `orbit_job_search_result`

2. Add new fields (nullable, so non-breaking):
   - `orbit_call_session.mode`
   - `orbit_call_session.candidate_profile`
   - `candidate_profile.*` (all recommended fields)
   - `job_description.*` (missing fields)

### Phase 2: Data Migration

1. Backfill `orbit_call_session.mode`:
   ```sql
   UPDATE orbit_call_session
   SET mode = 'recruiter'
   WHERE job_description IS NOT NULL;
   ```

2. Add validation after backfill:
   ```sql
   ALTER TABLE orbit_call_session
   ALTER COLUMN mode SET NOT NULL;
   ```

### Phase 3: Deprecation

1. Mark `orbit_search_request/result` as deprecated (if confirmed unused)
2. Add deprecation warnings in Directus
3. Plan removal date (6 months out)

### Phase 4: Optimization

1. Add indexes
2. Add constraints
3. Implement data retention policies

---

## Testing Checklist

### Schema Validation Tests

- [ ] Can create `orbit_call_session` in recruiter mode
- [ ] Can create `orbit_call_session` in candidate mode
- [ ] Foreign key constraints work correctly
- [ ] Status transitions follow valid lifecycle
- [ ] Score ranges are enforced (0-100)
- [ ] JSON fields accept valid data structures
- [ ] Null constraints prevent orphaned records

### Integration Tests

- [ ] Candidate search workflow (existing)
- [ ] Job search workflow (new)
- [ ] Mode switching in UI
- [ ] WebSocket status updates
- [ ] Result fetching with expanded fields
- [ ] Snapshot data preservation

### Performance Tests

- [ ] Query performance with indexes
- [ ] Large result set handling
- [ ] Concurrent search requests
- [ ] WebSocket connection scaling

---

## Open Questions

1. **Job Posting Source:**
   - Are jobs stored in Directus `job_description` or fetched from external API?
   - If external, how are they synchronized?

2. **Authentication & Roles:**
   - Do candidates and recruiters have different Directus roles?
   - How is role determined at login?

3. **Search Implementation:**
   - Where does the candidate/job matching happen? (Backend service? Directus Flow?)
   - What AI model computes RFI/RAG scores?

4. **Real-time Updates:**
   - WebSocket is used for status updates - is this Directus built-in or custom?
   - What triggers status change from "processing" to "listed"?

5. **Deprecated Collections:**
   - Are `orbit_search_request/result` still in use?
   - Can they be safely removed?

6. **Snapshot Cleanup:**
   - How long are snapshots retained?
   - Is there a cleanup process for old search requests?

---

## Summary & Recommendations

### What's Working Well ✅

1. **Snapshot pattern** - Preserves search criteria
2. **Dual scoring system** - RFI + RAG for better matching
3. **Pros/cons storage** - Explainable AI
4. **Status tracking** - Clear request lifecycle
5. **Separation of concerns** - Request vs Result collections

### Critical Gaps ❌

1. **Missing `orbit_job_search_request` collection**
2. **Missing `orbit_job_search_result` collection**
3. **`orbit_call_session` should be deprecated** (replaced by specific enrichment sessions)
4. **Generic `session` field names** should be renamed to `{entity}_enrichment_session`
5. **Inadequate `candidate_profile` fields for job search**
6. **Unclear purpose of `orbit_search_request/result`**

### Priority Actions

**Must Have (P0):**
- Create `orbit_job_search_request` collection (with `candidate_enrichment_session` field)
- Create `orbit_job_search_result` collection
- Deprecate `orbit_call_session` (replace with enrichment sessions)
- Rename `orbit_candidate_search_request.session` to `job_enrichment_session`
- Move `host_user` and `mode` to `orbit_call_request`
- Fix `candidate_profile.year_of_experience` type

**Should Have (P1):**
- Extend `candidate_profile` with missing fields
- Document status enums
- Add database constraints
- Clarify deprecated collections

**Nice to Have (P2):**
- Add performance indexes
- Implement data retention
- Add audit logging
- Create schema documentation

---

**Review Date**: 2025-11-27
**Next Review**: After schema changes are implemented
**Owner**: Development Team
