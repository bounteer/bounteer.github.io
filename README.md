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

The main dashboard component for managing Bounteer Orbit calls, located at `src/components/interactive/OrbitCallDashboard.tsx`.

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


## Dependencies
- [Self-hosted Directus CMS](directus.bounteer.com)
