import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages repo name when deploying to
// https://<user>.github.io/<repo>/ . Override with VITE_BASE env var.
// For a user/org page or local dev, '/' is fine.
const base = process.env.VITE_BASE ?? '/sungrow-developers-daybook-review-2026/'

export default defineConfig({
  plugins: [react()],
  base,
})
