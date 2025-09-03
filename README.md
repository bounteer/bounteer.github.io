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
