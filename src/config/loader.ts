import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { configSchema, type Config } from './schema.js';

export function loadConfig(path: string): Config {
  try {
    const raw = readFileSync(path, 'utf-8');
    const data = parse(raw);
    return configSchema.parse(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config from ${path}: ${error.message}`);
    }
    throw error;
  }
}
