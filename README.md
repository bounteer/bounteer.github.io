# Bounteer website (Astro)

This is the official website code of [Bounteer](https://bounteer.com). 

## 📦 Project Structure

```text
/
├── public/             # Static assets
│   └── favicon.svg
├── src/
│   ├── assets/         # Images and other assets
│   ├── components/     # Reusable UI components
│   ├── layouts/        # Page layouts
│   ├── pages/          # Page routes
│   ├── scripts/        # JavaScript utilities
│   └── styles/         # Global styles
│       ├── global.css
│       └── transitions.css
├── astro.config.mjs    # Astro configuration
├── tailwind.config.mjs # Tailwind CSS configuration
└── package.json        # Project dependencies
```

## 🏗️ Component Architecture

### OrbitCallDashboard Component

The main dashboard component for managing Bounteer orbit call, located at `src/components/interactive/OrbitCallDashboard.tsx`.

**Key Features:**
- 3-stage workflow: `not_linked` → `ai_enrichment` → `manual_enrichment`
- Real-time job description enrichment via WebSocket/polling
- Candidate search integration with Directus CMS
- Database-driven request system for external integrations

**State Management:**
- Manages job description data as single source of truth
- Handles orbit call session lifecycle
- Coordinates candidate search requests and results

### JobDescriptionEnrichment Component

A controlled component for job description form and AI enrichment, located at `src/components/interactive/JobDescriptionEnrichment.tsx`.

**Design Pattern: Controlled Component**
```tsx
// Parent manages state and passes it down
<JobDescriptionEnrichment
  jobData={jobData}              // Props from parent (single source of truth)
  onJobDataChange={handleChange} // Callback to update parent
  stage={jdStage}
  // ... other props
/>
```

**Props Interface:**
```typescript
interface JobDescriptionEnrichmentProps {
  jobDescriptionId: string | null;
  callUrl: string;
  inputMode: "meeting" | "testing";
  stage: JDStage; // "not_linked" | "ai_enrichment" | "manual_enrichment"
  jobData: JobDescriptionFormData; // Receives data from parent
  onStageChange: (stage: JDStage) => void;
  onJobDataChange: (jobData: JobDescriptionFormData) => void; // Notifies parent of changes
}
```

**Data Flow:**
1. **Parent → Child:** `jobData` prop provides current state
2. **Child → Parent:** `onJobDataChange()` callback updates parent state
3. **Real-time updates:** WebSocket/polling updates flow through parent
4. **Candidate Search:** Uses parent's `jobData` (always in sync)

**Features:**
- AI/Manual enrichment toggle with conditional editing
- Real-time updates via WebSocket or polling (configurable)
- Form validation for all job description fields
- Save functionality with change tracking
- Skills management with drag-and-drop
- Animated gradient background header

**Why Controlled Component Pattern?**
- ✅ Single source of truth (parent state)
- ✅ No duplicate state between parent and child
- ✅ Predictable data flow
- ✅ Ensures candidate search gets correct data
- ✅ Easier to debug and maintain

### Data Flow Diagram

```
OrbitCallDashboard (Parent)
    │
    ├─── jobData state (source of truth)
    │
    ├─→ JobDescriptionEnrichment (Child)
    │       │
    │       ├─ Receives: jobData prop
    │       ├─ Renders: form with current data
    │       └─ Updates: calls onJobDataChange()
    │
    └─→ Candidate Search Request
            │
            ├─ Creates: orbit_candidate_search_request record
            ├─ Snapshot: jobData at request time
            └─ Monitors: request status via WebSocket
```

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command        | Action                                       |
| :------------- | :------------------------------------------- |
| `pnpm install` | Installs dependencies                        |
| `pnpm dev`     | Starts local dev server at `localhost:4321`  |
| `pnpm build`   | Build your production site to `./dist/`      |
| `pnpm preview` | Preview your build locally, before deploying |

## 🎨 Customization

### Colors

The template includes a custom color palette defined in `tailwind.config.mjs`:

But I am transitioning to use ShadCN just to make my life easier. I am just a frontend vibe coder.
```bash
# add new shadcn component
pnpm dlx shadcn@latest add badge
```

## 📋 Development Roadmap

See [TODO.md](./TODO.md) for:
- Security issues and fixes
- **Feature Development**: Upcoming features including Orbit Call Candidate Mode
- Implementation checklists and architecture documentation

## 🚀 Getting Started

1. Clone this repository
2. Install dependencies with `pnpm install`
3. Start the development server with `pnpm dev`
4. Visit `http://localhost:4321` to see your site


## 👀 Tech Stacks
- [Astro Documentation](https://docs.astro.build)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Alpine.js Documentation](https://alpinejs.dev/start-here)
- [Directus Documentation](https://directus.io/docs)


# Orbit Signals – Final Model Summary
The system is reference-centric, not entity-centric.
Identity is handled by company_reference (stable, enrichable handle).
Knowledge snapshots live in company_profile (replaceable, enrichable).
Beliefs / hypotheses live in hiring_intent.
Edit ownership is per space, so hiring_intent is owned by space.
Duplication is allowed; no global dedup or reconciliation is required.
hiring_intent → company_profile → company_reference is the core chain.
Queries and UI can safely use intent.company_profile.*.
Spaces organize and edit beliefs; they do not own identity or profiles.
The resulting graph is a space-scoped belief graph, not a global truth graph.

## Orbit Signal Workflow & Limits

### Action Quota Limit
To prevent signal/action accumulation and encourage timely follow-through:

**Limit:** Maximum of **10 actions** in the Actions column at any time

**Behavior:**
- When attempting to move a signal to actions with 10 existing actions, a dialog appears
- Message: "You have exceeded the maximum of 10 actions. Please complete or abort existing actions first before adding new ones."
- User must complete or abort actions to free up slots

**Why this limit exists:**
- Prevents overwhelming action lists that lead to inaction
- Encourages users to actively manage and close out actions
- Promotes focused work on high-priority signals
- Prevents signals from "hanging" indefinitely without resolution

**Implementation:** `src/components/interactive/HiringIntentDashboard.tsx:180-185`

## Dependencies
- [Self-hosted Directus CMS](directus.bounteer.com)
