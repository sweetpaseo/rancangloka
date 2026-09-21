/**
 * RancangLoka — Cloudflare Worker Native Entrypoint
 * Phase: 5L9
 *
 * Wraps the Astro SSR runtime application for incoming fetch requests and
 * provides native Cloudflare scheduled event handling for publication automation.
 */
// @ts-ignore
import astroWorker from '../dist/_worker.js/index.js';
import {
  handleScheduledEvent,
  type ScheduledEvent,
  type ExecutionContext
} from './lib/publication/cron-router.ts';

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    return astroWorker.fetch(request, env, ctx);
  },

  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext): Promise<void> {
    await handleScheduledEvent(event, env, ctx);
  }
};
