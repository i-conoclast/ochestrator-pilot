import { z } from 'zod';

export const configSchema = z.object({
  version: z.string(),
  policies: z.object({
    allow_network: z.boolean(),
    default_fs_mode: z.enum(['read-only', 'rw']),
    max_task_duration_sec: z.number(),
    max_total_duration_sec: z.number(),
  }),
  whitelist_tools: z.array(z.string()),
  llm: z.object({
    backend: z.literal('claude_code'),
    model: z.string(),
    prompts: z.object({
      planner: z.string(),
      summarizer: z.string(),
    }),
  }),
  retries: z.object({
    max: z.number(),
    backoff_base_sec: z.number(),
  }),
  concurrency: z.object({
    max_workers: z.number(),
  }),
  paths: z.object({
    runs: z.string(),
    logs: z.string(),
    artifacts: z.string(),
    report: z.string(),
  }),
  security: z.object({
    fs: z.object({
      allow_read: z.array(z.string()),
      allow_write: z.array(z.string()),
    }),
    net: z.object({
      allow_domains: z.array(z.string()),
    }),
    redact_secrets: z.boolean(),
  }),
  telemetry: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    format: z.literal('jsonl'),
    trace_id_header: z.string(),
  }),
});

export type Config = z.infer<typeof configSchema>;
