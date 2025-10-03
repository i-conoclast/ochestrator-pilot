import { v4 as uuid } from 'uuid';
import { setTraceId, log } from '../logger/index.js';
import { orchestrate } from '../l1/orchestrator.js';

export interface RunOptions {
  planOnly?: boolean;
  dryRun?: boolean;
  maxDepth?: string;
  retries?: string;
  concurrency?: string;
  out?: string;
  config?: string;
}

export async function runCommand(task: string, options: RunOptions): Promise<void> {
  const runId = uuid();
  setTraceId(runId);

  log('info', 'Orchestra CLI started', {
    task,
    run_id: runId,
    options,
  });

  console.log('🎭 Orchestra CLI v0.1.0');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Task: ${task}`);
  console.log(`📂 Run ID: ${runId}`);
  console.log('');

  if (options.planOnly) {
    console.log('ℹ️  Plan-only mode enabled');
  }

  if (options.dryRun) {
    console.log('ℹ️  Dry-run mode enabled');
  }

  console.log('');

  try {
    await orchestrate(task, {
      runId,
      planOnly: options.planOnly || false,
      dryRun: options.dryRun || false,
      maxDepth: parseInt(options.maxDepth || '3'),
      retries: options.retries ? parseInt(options.retries) : undefined,
      concurrency: parseInt(options.concurrency || '1'),
      outPath: options.out || './runs',
      configPath: options.config || './orchestra.config.yaml',
    });

    log('info', 'CLI execution completed');
  } catch (error) {
    log('error', 'CLI execution failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('');
    console.error('❌ Execution failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export const agentCommand = {
  list: () => {
    console.log('📋 Configured Agents:');
    console.log('');
    console.log('L1: Orchestrator (active)');
    console.log('L2: Coordinator (claude-sonnet-4-5)');
    console.log('L3: Worker Pool (max_workers=4)');
  },

  inspect: (level: string) => {
    console.log(`🔍 Agent Details: ${level}`);
    console.log('');
    console.log('⚠️  Agent inspection not yet implemented');
  },
};

export const evalCommand = {
  run: (scenario: string, options: { report?: string }) => {
    console.log(`📊 Running evaluation scenario: ${scenario}`);
    console.log(`📄 Report format: ${options.report || 'md'}`);
    console.log('');
    console.log('⚠️  Evaluation framework not yet implemented');
  },
};
