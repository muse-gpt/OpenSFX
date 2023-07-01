import { readFileSync } from 'node:fs';

/**
 * Reads a JSON spec file.
 *
 * Parse failures are explicit: the CLI never guesses a default spec or falls
 * back to a preset when the file is malformed.
 */
export function readSpecFile<T>(file: string): T {
    const text = readFileSync(file, 'utf8');
    try {
        return JSON.parse(text) as T;
    }
    catch (error) {
        throw new Error(`spec: ${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}
