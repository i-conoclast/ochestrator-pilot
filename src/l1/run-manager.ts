import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { log } from '../logger/index.js';

export interface RunDirectory {
  runId: string;
  basePath: string;
  paths: {
    root: string;
    config: string;
    plan: string;
    tasks: string;
    artifacts: string;
    report: string;
  };
}

export class RunManager {
  private basePath: string;

  constructor(basePath: string = './runs') {
    this.basePath = resolve(basePath);
  }

  createRunDirectory(runId: string): RunDirectory {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace(/T/, '_')
      .slice(0, -5);
    const runDir = resolve(this.basePath, timestamp);

    // Create directory structure
    try {
      mkdirSync(runDir, { recursive: true });
      mkdirSync(resolve(runDir, 'artifacts'), { recursive: true });

      log('info', 'Run directory created', { run_dir: runDir });
    } catch (error) {
      log('error', 'Failed to create run directory', {
        run_dir: runDir,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const paths = {
      root: runDir,
      config: resolve(runDir, 'config.yaml'),
      plan: resolve(runDir, 'plan.json'),
      tasks: resolve(runDir, 'tasks.jsonl'),
      artifacts: resolve(runDir, 'artifacts'),
      report: resolve(runDir, 'report.md'),
    };

    return {
      runId,
      basePath: this.basePath,
      paths,
    };
  }

  savePlan(runDir: RunDirectory, plan: any): void {
    try {
      writeFileSync(runDir.paths.plan, JSON.stringify(plan, null, 2), 'utf-8');
      log('info', 'Plan saved', { path: runDir.paths.plan });
    } catch (error) {
      log('error', 'Failed to save plan', {
        path: runDir.paths.plan,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  saveConfig(runDir: RunDirectory, config: string): void {
    try {
      writeFileSync(runDir.paths.config, config, 'utf-8');
      log('info', 'Config snapshot saved', { path: runDir.paths.config });
    } catch (error) {
      log('error', 'Failed to save config', {
        path: runDir.paths.config,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  saveReport(runDir: RunDirectory, report: string): void {
    try {
      writeFileSync(runDir.paths.report, report, 'utf-8');
      log('info', 'Report saved', { path: runDir.paths.report });
    } catch (error) {
      log('error', 'Failed to save report', {
        path: runDir.paths.report,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  runDirectoryExists(path: string): boolean {
    return existsSync(path);
  }
}
