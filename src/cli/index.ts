#!/usr/bin/env node
import { Command } from 'commander';
import { log, setTraceId } from '../logger/index.js';
import { v4 as uuid } from 'uuid';

const program = new Command();

program
  .name('orchestra')
  .description('3-Depth Agent Orchestration CLI powered by Claude Code')
  .version('0.1.0');

program
  .command('run <task>')
  .description('Execute a high-level task')
  .option('--plan-only', 'Generate plan only, do not execute')
  .option('--dry-run', 'Simulate execution without running tools')
  .option('--max-depth <n>', 'Agent depth limit', '3')
  .option('--retries <n>', 'Retry count override')
  .option('--concurrency <n>', 'Parallel worker count', '1')
  .option('--out <path>', 'Run directory path', './runs')
  .option('--config <path>', 'Configuration file', './orchestra.config.yaml')
  .action((task: string, options: any) => {
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
    console.log('⚠️  Core orchestration logic not yet implemented');
    console.log('💡 This is a minimal CLI stub for Day 1-2 setup');

    log('info', 'CLI execution completed (stub mode)');
  });

program
  .command('agent')
  .description('Manage agents')
  .action(() => {
    console.log('Agent management commands:');
    console.log('  orchestra agent ls       - List all agents');
    console.log('  orchestra agent inspect  - Inspect agent details');
  });

program
  .command('eval')
  .description('Run evaluation scenarios')
  .action(() => {
    console.log('Evaluation framework not yet implemented');
  });

program.parse();
