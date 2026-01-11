# CLAUDE.md - Bounteer Development Guide

This file contains important information for Claude Code to understand the Bounteer project structure and development workflow.

## 📁 Project Overview

**Framework**: Astro with React components  
**Styling**: Tailwind CSS + ShadCN/UI components  
**Package Manager**: pnpm  
**CMS**: Self-hosted Directus (directus.bounteer.com)

## 🔧 Development Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production  
pnpm build

# Preview production build
pnpm preview

# Add new ShadCN component
pnpm dlx shadcn@latest add [component-name]

# Run tests
pnpm test
```

## 📂 Key Directories

- `src/pages/` - Astro page routes (.astro files)
- `src/components/ui/` - ShadCN UI components (.tsx files)
- `src/components/interactive/` - Custom React components (.tsx files)
- `src/layouts/` - Page layouts
- `src/scripts/` - JavaScript utilities
- `src/assets/` - Images and static assets

## 🎯 Development Guidelines

### File Creation Preferences
1. **Always prefer editing existing files** over creating new ones
2. **Never create documentation files** unless explicitly requested
3. Use `.astro` for pages and `.tsx` for React components
4. Follow existing naming conventions in the codebase

### Code Style
- Use existing ShadCN components when possible
- Follow Tailwind CSS utility-first approach
- Maintain consistency with existing component patterns
- Use TypeScript for React components

### Component Architecture
- UI components in `src/components/ui/` (ShadCN)
- Interactive components in `src/components/interactive/`
- Page-specific components can be inline in `.astro` files
- Reusable logic in `src/scripts/`

## 🔍 Common Patterns

### Astro Pages Structure
```astro
---
import Layout from "../layouts/Layout.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
---

<Layout title="Page Title">
  <Header />
  <main>
    <!-- Page content -->
  </main>
  <Footer />
</Layout>
```

### React Component Integration
```astro
---
import { ComponentName } from "../components/interactive/ComponentName.tsx";
---

<ComponentName client:load />
```

## 🛠️ Available ShadCN Components

Based on package.json, these ShadCN components are available:
- Avatar
- Button  
- Card
- Checkbox
- Dialog/Sheet
- Dropdown Menu
- Form
- Input/Textarea
- Label
- Progress
- Radio Group
- Scroll Area
- Separator
- Switch
- Table
- Badge

## 📋 Recent Development Notes

### Space Management System (v0.8.0+)
- **Space Management Dashboard**: New `/dashboard/spaces` page for managing workspaces
- **Space Creation**: Users can create new spaces with automatic admin role assignment
- **Inline Editing**: Space cards support direct editing with save/cancel functionality
- **Member Management**: UI for inviting members, managing roles, and permissions
- **Space Integration**: All orbit call requests are now associated with selected spaces
- **API Functions**: Complete CRUD operations for spaces and space-user relationships

### Bounteer Orbit Call Enhancements
- **Space Selector**: Integrated space selection in orbit call setup
- **Space Filtering**: Previous orbit call can be filtered by space and call type
- **Validation**: orbit call require space selection before deployment
- **Database Schema**: Proper space relationships in orbit_call_request table

### Previous Orbit Call
- **Enhanced Filtering**: Added space and call type filters with "All" options
- **Improved UI**: Consistent styling between filter dropdowns
- **Real-time Updates**: Filters update call list dynamically
- **Empty States**: Proper messaging when no calls match filters

### Orbit Signal Action Quota System
- **Action Limit**: Maximum of 10 actions allowed in the Actions column
- **Purpose**: Prevents signal/action accumulation and encourages timely completion
- **User Experience**: ShadCN dialog blocks new actions when limit is reached
- **Dialog Message**: Users are prompted to complete or abort existing actions first
- **Implementation**: `HiringIntentDashboard.tsx` checks `actionIntents.length` before allowing moves
- **Configuration**: `ACTION_QUOTA_LIMIT = 10` constant (line 71)
- **Benefits**: Promotes focused work, prevents overwhelming action lists, reduces hanging signals

### Development Workflow
- Use TodoWrite tool for tracking complex tasks
- Always check existing components before creating new ones
- Run linting/typechecking commands after major changes
- Test responsive design across different screen sizes

## 🔗 External Dependencies

- **CMS**: Directus at directus.bounteer.com
- **Icons**: Lucide React icons
- **Styling**: Tailwind CSS v4.1.3
- **Forms**: React Hook Form with Zod validation
- **State**: React built-in state management

## ⚡ Performance Notes

- Use `client:load` directive for interactive React components
- Optimize images with Astro's built-in Sharp integration
- Lazy load components when appropriate with `client:visible`
- Keep bundle size minimal by importing only needed components

## 🚨 Important Reminders

- **Never commit sensitive data** or API keys
- **Always validate URLs** for Google Meet links and external resources  
- **Test all interactive features** before deployment
- **Maintain accessibility** standards in all components
- **Follow security best practices** for user inputs and external integrations