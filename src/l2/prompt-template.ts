export class PromptTemplate {
  /**
   * Replace template variables with values
   * Example: "Hello {name}" with {name: "World"} => "Hello World"
   */
  static render(template: string, variables: Record<string, any>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      const replacement = typeof value === 'string' ? value : JSON.stringify(value);
      result = result.split(placeholder).join(replacement);
    }

    return result;
  }

  /**
   * Create planner prompt with few-shot examples
   */
  static createPlannerPrompt(
    intent: string,
    whitelistTools: string[],
    constraints: any
  ): string {
    const fewShotExamples = this.getFewShotExamples();

    return `You are the L2 Coordinator in Orchestra CLI, a 3-depth agent orchestration system.

Your task is to decompose a high-level user intent into a sequence of executable tasks.

## Input
**User Intent**: ${intent}

**Available Tools** (whitelist): ${JSON.stringify(whitelistTools)}

**Constraints**: ${JSON.stringify(constraints, null, 2)}

## Instructions
1. Break down the intent into concrete, executable steps
2. Each task MUST use only tools from the whitelist
3. Assign dependencies using \`parent_id\` (tasks run sequentially by default)
4. Keep tasks atomic and focused
5. Output ONLY a valid JSON array, no explanation or markdown

## Output Format
You MUST respond with a JSON array of tasks following this exact schema:

\`\`\`json
[
  {
    "task_id": "task-001",
    "parent_id": null,
    "level": 3,
    "intent": "Create a new file called README.md",
    "tools": ["echo"],
    "inputs": {
      "args": ["echo", "\\"# Project\\"", ">", "README.md"],
      "env": {},
      "files": []
    }
  },
  {
    "task_id": "task-002",
    "parent_id": "task-001",
    "level": 3,
    "intent": "Run linter on the project",
    "tools": ["node"],
    "inputs": {
      "args": ["node", "lint.js"],
      "env": {},
      "files": []
    }
  }
]
\`\`\`

## Few-Shot Examples

${fewShotExamples}

## Now generate the plan

User Intent: ${intent}

Output (JSON array only):`;
  }

  private static getFewShotExamples(): string {
    return `### Example 1
**Input**: "Create a README file and run tests"
**Output**:
\`\`\`json
[
  {
    "task_id": "task-001",
    "parent_id": null,
    "level": 3,
    "intent": "Create README.md with project title",
    "tools": ["echo"],
    "inputs": {"args": ["echo", "\\"# My Project\\"", ">", "README.md"], "env": {}, "files": []}
  },
  {
    "task_id": "task-002",
    "parent_id": "task-001",
    "level": 3,
    "intent": "Run project tests",
    "tools": ["pnpm"],
    "inputs": {"args": ["pnpm", "test"], "env": {}, "files": []}
  }
]
\`\`\`

### Example 2
**Input**: "List files and show git status"
**Output**:
\`\`\`json
[
  {
    "task_id": "task-001",
    "parent_id": null,
    "level": 3,
    "intent": "List all files in current directory",
    "tools": ["ls"],
    "inputs": {"args": ["ls", "-la"], "env": {}, "files": []}
  },
  {
    "task_id": "task-002",
    "parent_id": "task-001",
    "level": 3,
    "intent": "Show git repository status",
    "tools": ["git"],
    "inputs": {"args": ["git", "status"], "env": {}, "files": []}
  }
]
\`\`\``;
  }
}
