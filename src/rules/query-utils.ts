import { ReturnedValue, GraphQueryResult, QueryResultData } from './rule-engine';
import { Graph, Node, Edge } from '@/graph';

/**
 * Utility functions for working with query results
 * 
 * This class supports both the new GraphQueryResult format and the legacy QueryResult format.
 * For new code, use the GraphQueryResult format returned by executeQuery().
 * 
 * @example
 * ```typescript
 * const result = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
 * const names = utils.extractColumn(result, 'p.name');
 * const objects = utils.toObjectArray(result);
 * ```
 */
export class QueryUtils<NodeData = any, EdgeData = any> {
  /**
   * Extracts a specific column from query results as an array
   * 
   * @param result The query result (unified or legacy format)
   * @param columnName The name of the column to extract
   * @returns Array of values from the specified column
   */
  extractColumn(
    result: GraphQueryResult<NodeData, EdgeData>,
    columnName: string
  ): any[] {
    if (!result.success || !result.query || result.query.rows.length === 0) {
      return [];
    }

    return this.extractColumnFromQueryData(result.query, columnName);
  }

  /**
   * Helper to extract column from QueryResultData
   */
  private extractColumnFromQueryData(
    queryData: QueryResultData<NodeData, EdgeData>,
    columnName: string
  ): any[] {
    const columnIndex = queryData.columns.indexOf(columnName);
    if (columnIndex === -1) {
      throw new Error(`Column "${columnName}" not found in query results`);
    }

    return queryData.rows.map((row: ReturnedValue<NodeData, EdgeData>[]) => row[columnIndex].value);
  }

  /**
   * Converts query results to an array of objects with column names as keys
   * 
   * @param result The query result (unified or legacy format)
   * @returns Array of objects with column names as keys
   */
  toObjectArray(
    result: GraphQueryResult<NodeData, EdgeData>
  ): Record<string, any>[] {
    if (!result.success || !result.query || result.query.rows.length === 0) {
      return [];
    }

    return this.queryDataToObjectArray(result.query);
  }

  /**
   * Helper to convert QueryResultData to object array
   */
  private queryDataToObjectArray(
    queryData: QueryResultData<NodeData, EdgeData>
  ): Record<string, any>[] {
    return queryData.rows.map((row: ReturnedValue<NodeData, EdgeData>[]) => {
      const obj: Record<string, any> = {};

      for (let i = 0; i < row.length; i++) {
        const columnName = queryData.columns[i];
        obj[columnName] = row[i].value;
      }

      return obj;
    });
  }

  /**
   * Extracts all nodes from query results
   * 
   * @param result The query result (unified or legacy format)
   * @returns Array of nodes found in the query results
   */
  extractNodes(
    result: GraphQueryResult<NodeData, EdgeData>
  ): Node<NodeData>[] {
    if (!result.success || !result.query || result.query.rows.length === 0) {
      return [];
    }

    return this.extractNodesFromQueryData(result.query);
  }

  /**
   * Helper to extract nodes from QueryResultData
   */
  private extractNodesFromQueryData(
    queryData: QueryResultData<NodeData, EdgeData>
  ): Node<NodeData>[] {
    const nodes: Node<NodeData>[] = [];

    for (const row of queryData.rows) {
      for (const item of row) {
        if (item.type === 'node') {
          nodes.push(item.value as Node<NodeData>);
        }
      }
    }

    // Remove duplicates by node ID
    const uniqueNodes = new Map<string, Node<NodeData>>();
    for (const node of nodes) {
      uniqueNodes.set(node.id, node);
    }

    return Array.from(uniqueNodes.values());
  }

  /**
   * Extracts all edges from query results
   * 
   * @param result The query result (unified or legacy format)
   * @returns Array of edges found in the query results
   */
  extractEdges(
    result: GraphQueryResult<NodeData, EdgeData>
  ): Edge<EdgeData>[] {
    if (!result.success || !result.query || result.query.rows.length === 0) {
      return [];
    }

    return this.extractEdgesFromQueryData(result.query);
  }

  /**
   * Helper to extract edges from QueryResultData
   */
  private extractEdgesFromQueryData(
    queryData: QueryResultData<NodeData, EdgeData>
  ): Edge<EdgeData>[] {
    const edges: Edge<EdgeData>[] = [];

    for (const row of queryData.rows) {
      for (const item of row) {
        if (item.type === 'edge') {
          edges.push(item.value as Edge<EdgeData>);
        }
      }
    }

    // Remove duplicates using composite key since Edge doesn't have an id
    const uniqueEdges = new Map<string, Edge<EdgeData>>();
    for (const edge of edges) {
      // Create a composite key from source-label-target as the unique identifier
      const key = `${edge.source}-${edge.label}-${edge.target}`;
      uniqueEdges.set(key, edge);
    }

    return Array.from(uniqueEdges.values());
  }

  /**
   * Creates a new subgraph from query results
   * 
   * @param result The query result (unified or legacy format)
   * @returns A new graph containing only the nodes and edges from the query result
   */
  toSubgraph(
    result: GraphQueryResult<NodeData, EdgeData>
  ): Graph<NodeData, EdgeData> {
    const subgraph = new Graph<NodeData, EdgeData>();

    // Extract all nodes and edges
    const nodes = this.extractNodes(result);
    const edges = this.extractEdges(result);

    // Add nodes to the subgraph
    for (const node of nodes) {
      subgraph.addNode(node.id, node.label, { ...node.data });
    }

    // Add edges to the subgraph
    for (const edge of edges) {
      // Only add edges if both source and target nodes exist in the subgraph
      if (subgraph.hasNode(edge.source) && subgraph.hasNode(edge.target)) {
        subgraph.addEdge(
          edge.source,
          edge.target,
          edge.label,
          { ...edge.data }
        );
      }
    }

    return subgraph;
  }

  /**
   * Checks if the query result is empty (has no rows)
   * 
   * @param result The query result (unified or legacy format)
   * @returns True if the result has no rows, false otherwise
   */
  isEmpty(
    result: GraphQueryResult<NodeData, EdgeData>
  ): boolean {
    return !result.success || !result.query || result.query.rows.length === 0;
  }

  /**
   * Gets a single value from the first row of a query result
   * 
   * @param result The query result (unified or legacy format)
   * @param columnName Optional column name to extract (defaults to first column)
   * @returns The value, or undefined if not found
   */
  getSingleValue(
    result: GraphQueryResult<NodeData, EdgeData>,
    columnName?: string
  ): any {
    if (!result.success || !result.query || result.query.rows.length === 0) {
      return undefined;
    }

    return this.getSingleValueFromQueryData(result.query, columnName);
  }

  /**
   * Helper to get a single value from QueryResultData
   */
  private getSingleValueFromQueryData(
    queryData: QueryResultData<NodeData, EdgeData>,
    columnName?: string
  ): any {
    const columnIndex = columnName ?
      queryData.columns.indexOf(columnName) :
      0;

    if (columnIndex === -1) {
      throw new Error(`Column "${columnName}" not found in query results`);
    }

    return queryData.rows[0][columnIndex].value;
  }

  /**
   * Combines multiple query results into a single result
   * (Only works if all results have the same columns)
   * 
   * @param results Array of query results to combine (unified or legacy format)
   * @returns A combined query result
   */
  combineResults(
    results: GraphQueryResult<NodeData, EdgeData>[]
  ): GraphQueryResult<NodeData, EdgeData> {
    if (results.length === 0) {
      return {
        success: true,
        matchCount: 0,
        statement: 'COMBINED QUERY',
        stats: {
          readOperations: false,
          writeOperations: false,
          executionTimeMs: 0
        }
      };
    }

    // Extract query data from all results
    const allQueryData: QueryResultData<NodeData, EdgeData>[] = [];
    let hasReadOps = false;
    let hasWriteOps = false;
    let totalMatchCount = 0;
    let totalExecutionTime = 0;

    for (const result of results) {
      if (!result.success) {
        continue;
      }

      totalMatchCount += result.matchCount;

      if (result.query) {
        allQueryData.push(result.query);
      }

      hasReadOps = hasReadOps || result.stats.readOperations;
      hasWriteOps = hasWriteOps || result.stats.writeOperations;
      totalExecutionTime += result.stats.executionTimeMs;
    }

    if (allQueryData.length === 0) {
      return {
        success: true,
        matchCount: totalMatchCount,
        statement: 'COMBINED QUERY',
        stats: {
          readOperations: hasReadOps,
          writeOperations: hasWriteOps,
          executionTimeMs: totalExecutionTime
        }
      };
    }

    // Use the first result's columns as the base
    const baseQueryData = allQueryData[0];
    const combinedRows: ReturnedValue<NodeData, EdgeData>[][] = [...baseQueryData.rows];

    for (let i = 1; i < allQueryData.length; i++) {
      const queryData = allQueryData[i];

      // Make sure columns match
      if (!this.columnsMatch(baseQueryData.columns, queryData.columns)) {
        throw new Error('Cannot combine results with different columns');
      }

      // Add rows
      combinedRows.push(...queryData.rows);
    }

    // Create combined result
    return {
      success: true,
      matchCount: totalMatchCount,
      statement: 'COMBINED QUERY',
      stats: {
        readOperations: hasReadOps,
        writeOperations: hasWriteOps,
        executionTimeMs: totalExecutionTime
      },
      query: {
        columns: baseQueryData.columns,
        rows: combinedRows
      }
    };
  }


  /**
   * Checks if two column arrays have the same values
   * 
   * @param columns1 First array of column names
   * @param columns2 Second array of column names
   * @returns True if the columns match, false otherwise
   */
  private columnsMatch(columns1: string[], columns2: string[]): boolean {
    if (columns1.length !== columns2.length) {
      return false;
    }

    for (let i = 0; i < columns1.length; i++) {
      if (columns1[i] !== columns2[i]) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Creates a new query utilities object
 * 
 * @returns A new QueryUtils instance
 */
export function createQueryUtils<NodeData = any, EdgeData = any>(): QueryUtils<NodeData, EdgeData> {
  return new QueryUtils<NodeData, EdgeData>();
}