import { CannonballGraph } from '../core/graph';
import { NodeType, RelationType, Node, TaskState } from '../core/types';

/**
 * Options for serializing the graph to markdown
 */
export interface SerializationOptions {
  /**
   * Whether to split the output into multiple files
   */
  splitIntoFiles?: boolean;

  /**
   * Function to determine the file path for a node
   * If not provided, nodes will be grouped by their original file path
   */
  getFilePath?: (node: Node) => string;

  /**
   * Whether to include metadata inline in the generated markdown
   */
  includeMetadata?: boolean;
}

/**
 * Result of serializing a graph to markdown
 */
export interface SerializationResult {
  /**
   * Map of file paths to markdown content
   */
  files: Map<string, string>;
}

/**
 * Serializer that converts a Cannonball graph into markdown
 */
export class MarkdownSerializer {
  /**
   * Serialize a Cannonball graph to markdown
   * @param graph - The graph to serialize
   * @param options - Options for serialization
   * @returns The serialization result
   */
  serialize(graph: CannonballGraph, options: SerializationOptions = {}): SerializationResult {
    const result: SerializationResult = {
      files: new Map<string, string>()
    };

    // Group nodes by file
    const nodesByFile = this.groupNodesByFile(graph, options);

    // Process each file
    for (const [filePath, nodes] of nodesByFile) {
      const markdown = this.serializeFile(graph, nodes, options);
      result.files.set(filePath, markdown);
    }

    return result;
  }

  /**
   * Group nodes by the file they belong to
   */
  private groupNodesByFile(
    graph: CannonballGraph,
    options: SerializationOptions
  ): Map<string, Node[]> {
    const nodesByFile = new Map<string, Node[]>();
    const allNodes = graph.getAllNodes();

    for (const node of allNodes) {
      // Determine which file this node belongs to
      let filePath: string;

      if (options.getFilePath) {
        // Use custom function to determine file path
        filePath = options.getFilePath(node);
      } else {
        // Use the node's original file path or derive one
        filePath = node.metadata.filePath as string || 'output.md';
      }

      // Add node to the appropriate file group
      if (!nodesByFile.has(filePath)) {
        nodesByFile.set(filePath, []);
      }
      nodesByFile.get(filePath)!.push(node);
    }

    return nodesByFile;
  }

  /**
   * Serialize all nodes for a single file
   */
  private serializeFile(
    graph: CannonballGraph,
    nodes: Node[],
    options: SerializationOptions
  ): string {
    // Find top-level nodes (notes and headings without parents)
    const topLevelNodes = nodes.filter(node => {
      if (node.type !== NodeType.Note && node.type !== NodeType.Section) {
        return false;
      }

      const parentNodes = graph.getRelatingNodes(node.id, RelationType.ContainsChild);
      return parentNodes.length === 0 ||
        (parentNodes.length === 1 && parentNodes[0].type === NodeType.Note);
    });

    // Sort nodes by position in the document
    topLevelNodes.sort((a, b) => {
      const posA = a.metadata.position?.start.line || 0;
      const posB = b.metadata.position?.start.line || 0;
      return posA - posB;
    });

    // Build markdown content
    let markdown = '';

    for (const node of topLevelNodes) {
      if (node.type === NodeType.Note) {
        // For notes, just add title if it's not the filename
        if (node.content && !node.content.includes('.md')) {
          markdown += `# ${node.content}\n\n`;
        }

        // Process direct children of the note
        const children = graph.getRelatedNodes(node.id, RelationType.ContainsChild);
        markdown += this.serializeNodes(graph, children, 0, options);
      } else if (node.type === NodeType.Section) {
        // Add heading with appropriate level
        const level = node.metadata.level as number || 1;
        markdown += `${'#'.repeat(level)} ${node.content}\n\n`;

        // Process children of the heading
        const children = graph.getRelatedNodes(node.id, RelationType.ContainsChild);
        markdown += this.serializeNodes(graph, children, 0, options);
      }
    }

    return markdown;
  }

  /**
   * Recursively serialize a set of nodes
   */
  private serializeNodes(
    graph: CannonballGraph,
    nodes: Node[],
    indentLevel: number,
    options: SerializationOptions
  ): string {
    let markdown = '';

    // Sort nodes by position
    nodes.sort((a, b) => {
      const posA = a.metadata.position?.start.line || 0;
      const posB = b.metadata.position?.start.line || 0;
      return posA - posB;
    });

    for (const node of nodes) {
      // Handle different node types
      if (node.type === NodeType.Section) {
        const level = node.metadata.level as number || 1;
        markdown += `${'#'.repeat(level)} ${node.content}\n\n`;

        // Process children
        const children = graph.getRelatedNodes(node.id, RelationType.ContainsChild);
        markdown += this.serializeNodes(graph, children, indentLevel, options);
      } else if (node.type === NodeType.Task) {
        // Get task state marker
        const stateMarker = this.getTaskStateMarker(node.metadata.taskState as TaskState);

        // Add task with appropriate indentation
        markdown += `${' '.repeat(indentLevel * 2)}- [${stateMarker}] ${node.content}\n`;

        // Add metadata if configured
        if (options.includeMetadata) {
          const relations = this.getNodeRelations(graph, node);
          if (relations.length > 0) {
            for (const relation of relations) {
              markdown += `${' '.repeat((indentLevel + 1) * 2)}- ${relation.type}:: ${relation.target}\n`;
            }
          }
        }

        // Process children
        const children = graph.getRelatedNodes(node.id, RelationType.ContainsChild);
        markdown += this.serializeNodes(graph, children, indentLevel + 1, options);
      } else if (node.type === NodeType.Bullet) {
        // Add bullet with appropriate indentation
        markdown += `${' '.repeat(indentLevel * 2)}- ${node.content}\n`;

        // Process children
        const children = graph.getRelatedNodes(node.id, RelationType.ContainsChild);
        markdown += this.serializeNodes(graph, children, indentLevel + 1, options);
      } else if (node.metadata.language) {
        // This is a code block
        const language = node.metadata.language as string;
        markdown += '```' + language + '\n';
        markdown += node.content + '\n';
        markdown += '```\n\n';
      } else {
        // Generic node - output as paragraph
        markdown += `${node.content}\n\n`;
      }
    }

    return markdown;
  }

  /**
   * Get the marker character for a task state
   */
  private getTaskStateMarker(state: TaskState): string {
    switch (state) {
      case TaskState.Complete:
        return 'x';
      case TaskState.InProgress:
        return '/';
      case TaskState.Blocked:
        return '!';
      case TaskState.Cancelled:
        return '-';
      case TaskState.Open:
      default:
        return ' ';
    }
  }

  /**
   * Get all outgoing relations for a node except ContainsChild
   */
  private getNodeRelations(
    graph: CannonballGraph,
    node: Node
  ): Array<{ type: string, target: string }> {
    const relations: Array<{ type: string, target: string }> = [];
    const edges = graph.getAllEdges().filter(edge =>
      edge.source === node.id &&
      edge.relation !== RelationType.ContainsChild
    );

    for (const edge of edges) {
      const targetNode = graph.getNode(edge.target);
      if (targetNode) {
        relations.push({
          type: edge.relation,
          target: `[[${targetNode.content}]]`
        });
      }
    }

    return relations;
  }
}