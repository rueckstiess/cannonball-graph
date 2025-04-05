import { QueryResult, ReturnedValue } from './rule-engine';
import { Graph, Node, Edge } from '@/graph';

/**
 * Utility functions for working with query results
 */
export class QueryUtils<NodeData = any, EdgeData = any> {
  /**
   * Extracts a specific column from query results as an array
   * 
   * @param result The query result
   * @param columnName The name of the column to extract
   * @returns Array of values from the specified column
   */
  extractColumn(
    result: QueryResult<NodeData, EdgeData>,
    columnName: string
  ): any[] {
    if (!result.success || result.rows.length === 0) {
      return [];
    }
    
    const columnIndex = result.columns.indexOf(columnName);
    if (columnIndex === -1) {
      throw new Error(`Column "${columnName}" not found in query results`);
    }
    
    return result.rows.map(row => row[columnIndex].value);
  }
  
  /**
   * Converts query results to an array of objects with column names as keys
   * 
   * @param result The query result
   * @returns Array of objects with column names as keys
   */
  toObjectArray(
    result: QueryResult<NodeData, EdgeData>
  ): Record<string, any>[] {
    if (!result.success || result.rows.length === 0) {
      return [];
    }
    
    return result.rows.map(row => {
      const obj: Record<string, any> = {};
      
      for (let i = 0; i < row.length; i++) {
        const columnName = result.columns[i];
        obj[columnName] = row[i].value;
      }
      
      return obj;
    });
  }
  
  /**
   * Extracts all nodes from query results
   * 
   * @param result The query result
   * @returns Array of nodes found in the query results
   */
  extractNodes(
    result: QueryResult<NodeData, EdgeData>
  ): Node<NodeData>[] {
    if (!result.success || result.rows.length === 0) {
      return [];
    }
    
    const nodes: Node<NodeData>[] = [];
    
    for (const row of result.rows) {
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
   * @param result The query result
   * @returns Array of edges found in the query results
   */
  extractEdges(
    result: QueryResult<NodeData, EdgeData>
  ): Edge<EdgeData>[] {
    if (!result.success || result.rows.length === 0) {
      return [];
    }
    
    const edges: Edge<EdgeData>[] = [];
    
    for (const row of result.rows) {
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
   * @param result The query result
   * @returns A new graph containing only the nodes and edges from the query result
   */
  toSubgraph(
    result: QueryResult<NodeData, EdgeData>
  ): Graph<NodeData, EdgeData> {
    const subgraph = new Graph<NodeData, EdgeData>();
    
    if (!result.success || result.rows.length === 0) {
      return subgraph;
    }
    
    // Extract all nodes and edges
    const nodes = this.extractNodes(result);
    const edges = this.extractEdges(result);
    
    // Add nodes to the subgraph
    for (const node of nodes) {
      subgraph.addNode(node.id, { ...node.data });
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
   * @param result The query result
   * @returns True if the result has no rows, false otherwise
   */
  isEmpty(
    result: QueryResult<NodeData, EdgeData>
  ): boolean {
    return !result.success || result.rows.length === 0;
  }
  
  /**
   * Gets a single value from the first row of a query result
   * 
   * @param result The query result
   * @param columnName Optional column name to extract (defaults to first column)
   * @returns The value, or undefined if not found
   */
  getSingleValue(
    result: QueryResult<NodeData, EdgeData>,
    columnName?: string
  ): any {
    if (!result.success || result.rows.length === 0) {
      return undefined;
    }
    
    const columnIndex = columnName ? 
      result.columns.indexOf(columnName) : 
      0;
      
    if (columnIndex === -1) {
      throw new Error(`Column "${columnName}" not found in query results`);
    }
    
    return result.rows[0][columnIndex].value;
  }
  
  /**
   * Combines multiple query results into a single result
   * (Only works if all results have the same columns)
   * 
   * @param results Array of query results to combine
   * @returns A combined query result
   */
  combineResults(
    results: QueryResult<NodeData, EdgeData>[]
  ): QueryResult<NodeData, EdgeData> {
    if (results.length === 0) {
      return {
        success: true,
        rows: [],
        columns: [],
        matchCount: 0
      };
    }
    
    // Use the first result's columns as the base
    const baseResult = results[0];
    const combinedRows: ReturnedValue<NodeData, EdgeData>[][] = [...baseResult.rows];
    let totalMatchCount = baseResult.matchCount;
    
    for (let i = 1; i < results.length; i++) {
      const result = results[i];
      
      // Skip unsuccessful results
      if (!result.success) {
        continue;
      }
      
      // Make sure columns match
      if (!this.columnsMatch(baseResult.columns, result.columns)) {
        throw new Error('Cannot combine results with different columns');
      }
      
      // Add rows and update match count
      combinedRows.push(...result.rows);
      totalMatchCount += result.matchCount;
    }
    
    return {
      success: true,
      rows: combinedRows,
      columns: baseResult.columns,
      matchCount: totalMatchCount
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