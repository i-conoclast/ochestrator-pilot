import { log } from '../logger/index.js';
import type { Config } from '../config/schema.js';
import type { Task } from '../types/task.js';
import { ClaudeCodeAdapter } from './llm-adapter.js';
import { PromptTemplate } from './prompt-template.js';
import { LLMParser } from './llm-parser.js';
import { DAGBuilder } from './dag.js';

export class Coordinator {
  private llmAdapter: ClaudeCodeAdapter;
  private dagBuilder: DAGBuilder;

  constructor(private config: Config) {
    this.llmAdapter = new ClaudeCodeAdapter({
      model: config.llm.model,
      maxTokens: 4000,
      temperature: 0, // Deterministic for planning
    });
    this.dagBuilder = new DAGBuilder();
  }

  async createPlan(intent: string, whitelistTools: string[]): Promise<Task[]> {
    log('info', 'L2 Coordinator: Creating plan', { intent }, 'L2');

    try {
      // Step 1: Generate prompt with few-shot examples
      const prompt = PromptTemplate.createPlannerPrompt(
        intent,
        whitelistTools,
        this.config.policies
      );

      log('debug', 'Generated prompt', { prompt_length: prompt.length }, 'L2');

      // Step 2: Call LLM
      const response = await this.llmAdapter.generate(prompt);

      log('debug', 'Received LLM response', { response_length: response.length }, 'L2');

      // Step 3: Parse and extract JSON
      const rawTasks = LLMParser.extractJSON(response);

      log('info', 'Extracted tasks from LLM response', { count: rawTasks.length }, 'L2');

      // Step 4: Validate and enrich tasks
      const tasks = LLMParser.validateTasks(rawTasks, this.config);

      // Step 5: Validate whitelist
      LLMParser.validateWhitelist(tasks, whitelistTools);

      // Step 6: Validate DAG (no cycles)
      const isValid = this.dagBuilder.validateNoCycles(tasks);
      if (!isValid) {
        throw new Error('Generated plan contains cycles');
      }

      // Step 7: Sort tasks topologically
      const sortedTasks = this.dagBuilder.topologicalSort(tasks);

      log('info', 'L2 Coordinator: Plan created successfully', {
        task_count: sortedTasks.length,
      }, 'L2');

      return sortedTasks;
    } catch (error) {
      log('error', 'L2 Coordinator: Plan creation failed', {
        error: error instanceof Error ? error.message : String(error),
        intent,
      }, 'L2');

      throw error;
    }
  }

  /**
   * Get parallel execution batches (for future use in L3)
   */
  getParallelBatches(tasks: Task[]): Task[][] {
    return this.dagBuilder.getParallelBatches(tasks);
  }
}
