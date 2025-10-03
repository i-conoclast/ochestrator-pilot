import { log } from '../logger/index.js';
import type { Config } from '../config/schema.js';
import type { Task } from '../types/task.js';

export class Coordinator {
  constructor(private config: Config) {}

  async createPlan(intent: string, whitelistTools: string[]): Promise<Task[]> {
    log('info', 'L2 Coordinator: Creating plan', { intent }, 'L2');

    // TODO: In Day 5-7, this will call Claude Code LLM
    // For now, generate a simple stub plan
    const tasks = this.generateStubPlan(intent, whitelistTools);

    log('info', 'L2 Coordinator: Plan created', { task_count: tasks.length }, 'L2');

    return tasks;
  }

  private generateStubPlan(intent: string, whitelistTools: string[]): Task[] {
    // Parse intent and generate simple task decomposition
    const now = new Date().toISOString();

    // Simple heuristic: if intent mentions multiple actions, split them
    const actions = this.extractActions(intent);

    return actions.map((action, index) => ({
      task_id: `task-${String(index + 1).padStart(3, '0')}`,
      parent_id: index > 0 ? `task-${String(index).padStart(3, '0')}` : null,
      level: 3 as const,
      intent: action,
      inputs: {
        args: [],
        env: {},
        files: [],
      },
      tools: this.suggestTools(action, whitelistTools),
      constraints: {
        max_duration_sec: this.config.policies.max_task_duration_sec,
        max_retries: this.config.retries.max,
        concurrency: 1,
        sandbox: {
          fs: this.config.policies.default_fs_mode,
          net: this.config.policies.allow_network ? 'allow' : 'deny',
        },
      },
      state: 'planned' as const,
      retries: 0,
      logs: [],
      artifacts: [],
      metrics: {},
      timestamps: {
        created_at: now,
      },
    }));
  }

  private extractActions(intent: string): string[] {
    // Simple keyword-based splitting
    const keywords = ['and', 'then', ','];
    let actions = [intent];

    for (const keyword of keywords) {
      const temp: string[] = [];
      for (const action of actions) {
        const split = action.split(new RegExp(`\\s+${keyword}\\s+`, 'i'));
        temp.push(...split);
      }
      actions = temp;
    }

    return actions.map((a) => a.trim()).filter((a) => a.length > 0);
  }

  private suggestTools(action: string, whitelist: string[]): string[] {
    const lower = action.toLowerCase();

    // Simple keyword matching
    if (lower.includes('readme') || lower.includes('file') || lower.includes('create')) {
      return whitelist.filter((t) => ['echo', 'cat'].includes(t)).slice(0, 1);
    }

    if (lower.includes('lint') || lower.includes('test') || lower.includes('build')) {
      return whitelist.filter((t) => ['node', 'pnpm'].includes(t)).slice(0, 1);
    }

    if (lower.includes('list') || lower.includes('show')) {
      return whitelist.filter((t) => ['ls', 'cat'].includes(t)).slice(0, 1);
    }

    // Default: use echo
    return ['echo'];
  }
}
