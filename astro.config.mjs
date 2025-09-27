// @ts-check
import { defineConfig } from 'astro/config';
import alpinejs from '@astrojs/alpinejs';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: 'https://bounteer.com',
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [alpinejs(), react(), sitemap()],
  redirects: {
    '/rfi': '/role-fit-index'
  }
});