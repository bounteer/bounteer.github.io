// @ts-check
import { defineConfig } from 'astro/config';
import alpinejs from '@astrojs/alpinejs';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";


// https://astro.build/config
export default defineConfig({
  output: "static", // if we want server side rendering, add `prerender = false` at the top of the astro file
  site: 'https://bounteer.com',
  adapter: node({ mode: "standalone" }),

  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [alpinejs(), react(), sitemap()]
});