# 🤖 Guidelines for AI Agents (Antigravity / Coding Assistant)

## 📌 Critical Cloudflare Hosting Rules

1. **Target Platform:** **Cloudflare Workers** (with Static Assets), **NOT Cloudflare Pages**.
2. **`wrangler.toml` Rules:**
   - Always keep:
     ```toml
     name = "rancangloka"
     main = "dist/_worker.js/index.js"
     assets = { directory = "dist" }
     ```
   - **NEVER** add `pages_build_output_dir = "dist"` to `wrangler.toml`.
3. **Deployment Command:**
   - Always use `npx wrangler deploy` (or `npm run deploy`).
   - **NEVER** use or suggest `wrangler pages deploy`.
4. **Reference Guide:**
   - Read [`CLOUDFLARE_DEPLOYMENT_GUIDE.md`](file:///CLOUDFLARE_DEPLOYMENT_GUIDE.md) and [`HISTORY.md`](file:///HISTORY.md) for full context.
