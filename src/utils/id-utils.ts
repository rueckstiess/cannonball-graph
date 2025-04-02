// src/utils/id-utils.ts
import { slugify } from './string-utils';

/**
 * Generate a node ID from file path and location information
 * @param filePath - The path to the file containing the node
 * @param options - Additional options for ID generation
 * @returns A unique path-based ID
 */
export function generateNodeId(
  filePath: string,
  options?: {
    /** Heading text if the node is under a heading */
    heading?: string;
    /** Position in list (e.g., "1.2.3" for nested lists) */
    listPosition?: string;
    /** Custom identifier for the node */
    identifier?: string;
  }
): string {
  let id = filePath;

  // Add heading information if available
  if (options?.heading) {
    id += `#${slugify(options.heading)}`;
  }

  // Add list position if available
  if (options?.listPosition) {
    id += `-${options.listPosition}`;
  }

  // Add custom identifier if available
  if (options?.identifier) {
    id += `^${slugify(options.identifier)}`;
  }

  return id;
}

/**
 * Parse a node ID into its components
 * @param id - The node ID to parse
 * @returns The components of the ID
 */
export function parseNodeId(id: string): {
  filePath: string;
  heading?: string;
  listPosition?: string;
  identifier?: string;
} {
  // Extract file path (everything before the first '#' if it exists)
  const filePathMatch = id.match(/^(.+?)(?:#|$)/);
  const filePath = filePathMatch ? filePathMatch[1] : id;

  // Extract heading (between '#' and '-' or '^' or end)
  const headingMatch = id.match(/#([^-^]+)/);
  const heading = headingMatch ? headingMatch[1] : undefined;

  // Extract list position (between '-' and '^' or end)
  const listPositionMatch = id.match(/-([^^]+)/);
  const listPosition = listPositionMatch ? listPositionMatch[1] : undefined;

  // Extract identifier (after '^')
  const identifierMatch = id.match(/\^(.+)$/);
  const identifier = identifierMatch ? identifierMatch[1] : undefined;

  return {
    filePath,
    heading,
    listPosition,
    identifier,
  };
}

/**
 * Check if a node ID belongs to a specific file
 * @param id - The node ID to check
 * @param filePath - The file path to check against
 * @returns Whether the node ID belongs to the file
 */
export function isNodeInFile(id: string, filePath: string): boolean {
  const { filePath: nodePath } = parseNodeId(id);
  return nodePath === filePath;
}