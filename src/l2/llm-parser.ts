import { log } from '../logger/index.js';
import type { Task } from '../types/task.js';

export class LLMParser {
  /**
   * Extract JSON from LLM response
   * Handles various formats:
   * - Plain JSON
   * - JSON wrapped in markdown code blocks
   * - JSON with surrounding text
   */
  static extractJSON(response: string): any {
    // Try direct parsing first
    try {
      return JSON.parse(response.trim());
    } catch {
      // Continue to other methods
    }

    // Try extracting from code blocks
    const codeBlockMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (error) {
        log('warn', 'Failed to parse JSON from code block', { error: String(error) }, 'L2');
      }
    }

    // Try finding JSON array pattern
    const arrayMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (error) {
        log('warn', 'Failed to parse extracted JSON array', { error: String(error) }, 'L2');
      }
    }

    // Try finding JSON object pattern
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (error) {
        log('warn', 'Failed to parse extracted JSON object', { error: String(error) }, 'L2');
      }
    }

    log('error', 'No valid JSON found in LLM response', { response: response.slice(0, 200) }, 'L2');
    throw new Error('Unable to extract valid JSON from LLM response');
  }

  /**
   * Validate and enrich task objects
   */
  static validateTasks(rawTasks: any[], config: any): Task[] {
    if (!Array.isArray(rawTasks)) {
      throw new Error('Tasks must be an array');
    }

    const tasks: Task[] = [];

    for (let i = 0; i < rawTasks.length; i++) {
      const raw = rawTasks[i];

      // Validate required fields
      if (!raw.task_id) {
        throw new Error(`Task ${i} missing task_id`);
      }
      if (!raw.intent) {
        throw new Error(`Task ${raw.task_id} missing intent`);
      }
      if (!raw.tools || !Array.isArray(raw.tools) || raw.tools.length === 0) {
        throw new Error(`Task ${raw.task_id} missing or invalid tools`);
      }

      // Enrich with defaults
      const task: Task = {
        task_id: raw.task_id,
        parent_id: raw.parent_id || null,
        level: raw.level || 3,
        intent: raw.intent,
        inputs: raw.inputs || { args: [], env: {}, files: [] },
        tools: raw.tools,
        constraints: raw.constraints || {
          max_duration_sec: config.policies?.max_task_duration_sec || 300,
          max_retries: config.retries?.max || 2,
          concurrency: 1,
          sandbox: {
            fs: config.policies?.default_fs_mode || 'read-only',
            net: config.policies?.allow_network ? 'allow' : 'deny',
          },
        },
        state: 'planned',
        retries: 0,
        logs: [],
        artifacts: [],
        metrics: {},
        timestamps: {
          created_at: new Date().toISOString(),
        },
      };

      tasks.push(task);
    }

    log('info', 'Tasks validated', { count: tasks.length }, 'L2');

    return tasks;
  }

  /**
   * Validate tools are in whitelist
   */
  static validateWhitelist(tasks: Task[], whitelist: string[]): void {
    for (const task of tasks) {
      for (const tool of task.tools) {
        if (!whitelist.includes(tool)) {
          throw new Error(
            `Task ${task.task_id} uses non-whitelisted tool: ${tool}. Allowed: ${whitelist.join(', ')}`
          );
        }
      }
    }

    log('info', 'Whitelist validation passed', undefined, 'L2');
  }
}
