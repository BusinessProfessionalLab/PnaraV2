import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://parley.startfrom.co',
  // The stylesheet is small, so it goes inside the page instead of blocking the first paint as a separate request.
  build: { inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
});
