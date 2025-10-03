import { log } from '../logger/index.js';
import type { Task } from '../types/task.js';

export interface DAGNode {
  task_id: string;
  depends_on: string[];
}

export interface DAG {
  nodes: DAGNode[];
  edges: [string, string][]; // [from, to]
}

export class DAGBuilder {
  buildDAG(tasks: Task[]): DAG {
    const nodes: DAGNode[] = tasks.map((task) => ({
      task_id: task.task_id,
      depends_on: task.parent_id ? [task.parent_id] : [],
    }));

    const edges: [string, string][] = [];
    for (const task of tasks) {
      if (task.parent_id) {
        edges.push([task.parent_id, task.task_id]);
      }
    }

    log('info', 'DAG built', { node_count: nodes.length, edge_count: edges.length }, 'L2');

    return { nodes, edges };
  }

  /**
   * Topological sort using Kahn's algorithm
   * Returns tasks in execution order
   */
  topologicalSort(tasks: Task[]): Task[] {
    const dag = this.buildDAG(tasks);

    // Build adjacency list and in-degree map
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize
    for (const node of dag.nodes) {
      adjList.set(node.task_id, []);
      inDegree.set(node.task_id, 0);
    }

    // Build graph
    for (const [from, to] of dag.edges) {
      adjList.get(from)?.push(to);
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }

    // Find nodes with no incoming edges
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const sorted: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      // Reduce in-degree for neighbors
      for (const neighbor of adjList.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for cycles
    if (sorted.length !== tasks.length) {
      const missing = tasks.filter((t) => !sorted.includes(t.task_id));
      log('error', 'Cycle detected in task graph', { missing_tasks: missing.map((t) => t.task_id) }, 'L2');
      throw new Error(`Cycle detected in task dependencies. Unable to sort: ${missing.map((t) => t.task_id).join(', ')}`);
    }

    // Return tasks in sorted order
    const taskMap = new Map(tasks.map((t) => [t.task_id, t]));
    const sortedTasks = sorted.map((id) => taskMap.get(id)!);

    log('info', 'Topological sort completed', { order: sorted }, 'L2');

    return sortedTasks;
  }

  /**
   * Validate DAG has no cycles
   */
  validateNoCycles(tasks: Task[]): boolean {
    try {
      this.topologicalSort(tasks);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get tasks that can run in parallel (same depth level)
   */
  getParallelBatches(tasks: Task[]): Task[][] {
    const sorted = this.topologicalSort(tasks);
    const batches: Task[][] = [];
    const completed = new Set<string>();

    while (completed.size < sorted.length) {
      const batch: Task[] = [];

      for (const task of sorted) {
        if (completed.has(task.task_id)) continue;

        // Check if all dependencies are completed
        const canRun = !task.parent_id || completed.has(task.parent_id);

        if (canRun) {
          batch.push(task);
        }
      }

      if (batch.length === 0) {
        // This shouldn't happen if topological sort is correct
        throw new Error('Unable to find runnable tasks');
      }

      batches.push(batch);
      batch.forEach((t) => completed.add(t.task_id));
    }

    log('info', 'Parallel batches created', { batch_count: batches.length }, 'L2');

    return batches;
  }
}
