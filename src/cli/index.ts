#!/usr/bin/env node
import { Command } from 'commander';
import { runCommand, agentCommand, evalCommand } from './commands.js';

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
  .action(runCommand);

program
  .command('agent')
  .description('Manage agents')
  .action(() => {
    console.log('Agent commands:');
    console.log('  orchestra agent ls              - List all agents');
    console.log('  orchestra agent inspect <level> - Inspect agent details');
  });

program
  .command('agent')
  .command('ls')
  .description('List all agents')
  .action(agentCommand.list);

program
  .command('agent')
  .command('inspect <level>')
  .description('Inspect agent details')
  .action(agentCommand.inspect);

program
  .command('eval')
  .command('run <scenario>')
  .description('Run evaluation scenario')
  .option('--report <format>', 'Report format (md|json)', 'md')
  .action(evalCommand.run);

program.parse();
