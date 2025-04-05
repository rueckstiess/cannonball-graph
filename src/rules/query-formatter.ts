import { QueryResult, ReturnedValue, GraphQueryResult, QueryResultData } from './rule-engine';
import { Graph, Node, Edge } from '@/graph';

/**
 * Options for formatting query results
 */
export interface QueryFormatterOptions {
  /**
   * Whether to include null/undefined values (default: true)
   */
  includeNulls?: boolean;
  
  /**
   * Maximum string length for values before truncation (default: 100)
   */
  maxValueLength?: number;
  
  /**
   * Whether to include node/edge IDs in output (default: true)
   */
  includeIds?: boolean;
  
  /**
   * Whether to pretty print JSON output (default: true)
   */
  prettyPrint?: boolean;
  
  /**
   * Number of spaces to use for indentation in pretty print (default: 2)
   */
  indentSpaces?: number;
}

/**
 * Default formatting options
 */
const DEFAULT_OPTIONS: QueryFormatterOptions = {
  includeNulls: true,
  maxValueLength: 100,
  includeIds: true,
  prettyPrint: true,
  indentSpaces: 2
};

/**
 * Formats query results in different output formats
 * 
 * This class supports both the new GraphQueryResult format and the legacy QueryResult format.
 * For new code, use the GraphQueryResult format returned by executeGraphQuery().
 * 
 * @example
 * ```typescript
 * const result = engine.executeGraphQuery(graph, 'MATCH (p:Person) RETURN p.name');
 * const markdown = formatter.toMarkdownTable(result);
 * ```
 */
export class QueryFormatter<NodeData = any, EdgeData = any> {
  /**
   * Converts query results to a markdown table
   * 
   * @param result The query result to format
   * @param options Formatting options
   * @returns A markdown table string
   */
  toMarkdownTable(
    result: GraphQueryResult<NodeData, EdgeData> | QueryResult<NodeData, EdgeData>,
    options: QueryFormatterOptions = {}
  ): string {
    // Merge default options with provided options
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Handle new GraphQueryResult type
    if ('query' in result) {
      if (!result.success || !result.query || result.query.rows.length === 0) {
        return 'No results';
      }
      
      return this.formatQueryDataAsMarkdown(result.query, opts);
    }
    
    // Handle legacy QueryResult type
    const queryResult = result as QueryResult<NodeData, EdgeData>;
    if (!queryResult.success || queryResult.rows.length === 0) {
      return 'No results';
    }
    
    // Create header row
    let table = '| ' + queryResult.columns.join(' | ') + ' |\n';
    
    // Create header-body separator
    table += '| ' + queryResult.columns.map(() => '---').join(' | ') + ' |\n';
    
    // Add data rows
    for (const row of queryResult.rows) {
      table += '| ' + row.map((item: ReturnedValue<NodeData, EdgeData>) => 
        this.formatValue(item, opts)
      ).join(' | ') + ' |\n';
    }
    
    return table;
  }
  
  /**
   * Formats query data as a markdown table
   * 
   * @param queryData The query data to format
   * @param options Formatting options
   * @returns A markdown table string
   */
  private formatQueryDataAsMarkdown(
    queryData: QueryResultData<NodeData, EdgeData>,
    options: QueryFormatterOptions
  ): string {
    // Create header row
    let table = '| ' + queryData.columns.join(' | ') + ' |\n';
    
    // Create header-body separator
    table += '| ' + queryData.columns.map(() => '---').join(' | ') + ' |\n';
    
    // Add data rows
    for (const row of queryData.rows) {
      table += '| ' + row.map((item: ReturnedValue<NodeData, EdgeData>) => 
        this.formatValue(item, options)
      ).join(' | ') + ' |\n';
    }
    
    return table;
  }
  
  /**
   * Converts query results to a JSON object
   * 
   * @param result The query result to format
   * @param options Formatting options
   * @returns A JSON string
   */
  toJson(
    result: GraphQueryResult<NodeData, EdgeData> | QueryResult<NodeData, EdgeData>,
    options: QueryFormatterOptions = {}
  ): string {
    // Merge default options with provided options
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Handle new GraphQueryResult type
    if ('query' in result) {
      if (!result.success) {
        return JSON.stringify({ error: result.error }, null, opts.prettyPrint ? opts.indentSpaces : 0);
      }
      
      // Create a full response with all data
      const response: Record<string, any> = {
        success: result.success,
        matchCount: result.matchCount,
        statement: result.statement,
        stats: result.stats
      };
      
      // Add query results if present
      if (result.query) {
        response.query = this.formatQueryDataAsJson(result.query, opts);
      }
      
      // Add action results if present 
      if (result.actions) {
        response.actions = {
          affectedNodesCount: result.actions.affectedNodes.length,
          affectedEdgesCount: result.actions.affectedEdges.length
        };
        
        if (opts.includeIds) {
          response.actions.affectedNodes = result.actions.affectedNodes.map(node => node.id);
          response.actions.affectedEdges = result.actions.affectedEdges.map(edge => 
            `${edge.source}-${edge.label}-${edge.target}`
          );
        }
      }
      
      return JSON.stringify(
        response,
        null,
        opts.prettyPrint ? opts.indentSpaces : 0
      );
    }
    
    // Handle legacy QueryResult type
    const queryResult = result as QueryResult<NodeData, EdgeData>;
    if (!queryResult.success) {
      return JSON.stringify({ error: queryResult.error }, null, opts.prettyPrint ? opts.indentSpaces : 0);
    }
    
    // Convert query results to a more JSON-friendly structure
    const formattedData = queryResult.rows.map((row: ReturnedValue<NodeData, EdgeData>[]) => {
      const rowObj: Record<string, any> = {};
      
      for (let i = 0; i < row.length; i++) {
        const columnName = queryResult.columns[i];
        rowObj[columnName] = this.formatValueForJson(row[i], opts);
      }
      
      return rowObj;
    });
    
    return JSON.stringify(
      { 
        matchCount: queryResult.matchCount,
        results: formattedData 
      },
      null,
      opts.prettyPrint ? opts.indentSpaces : 0
    );
  }
  
  /**
   * Formats query data as JSON
   * 
   * @param queryData The query data to format
   * @param options Formatting options
   * @returns A JSON-friendly object
   */
  private formatQueryDataAsJson(
    queryData: QueryResultData<NodeData, EdgeData>,
    options: QueryFormatterOptions
  ): any[] {
    // Convert query results to a more JSON-friendly structure
    return queryData.rows.map((row: ReturnedValue<NodeData, EdgeData>[]) => {
      const rowObj: Record<string, any> = {};
      
      for (let i = 0; i < row.length; i++) {
        const columnName = queryData.columns[i];
        rowObj[columnName] = this.formatValueForJson(row[i], options);
      }
      
      return rowObj;
    });
  }
  
  /**
   * Converts query results to a plain text table
   * 
   * @param result The query result to format
   * @param options Formatting options
   * @returns A plain text table string
   */
  toTextTable(
    result: GraphQueryResult<NodeData, EdgeData> | QueryResult<NodeData, EdgeData>,
    options: QueryFormatterOptions = {}
  ): string {
    // Merge default options with provided options
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Handle new GraphQueryResult type
    if ('query' in result) {
      if (!result.success || !result.query || result.query.rows.length === 0) {
        return 'No results';
      }
      
      return this.formatQueryDataAsTextTable(result.query, opts);
    }
    
    // Handle legacy QueryResult type
    const queryResult = result as QueryResult<NodeData, EdgeData>;
    if (!queryResult.success || queryResult.rows.length === 0) {
      return 'No results';
    }
    
    // Calculate the width of each column
    const columnWidths: number[] = queryResult.columns.map((column: string) => column.length);
    
    // Find the maximum width for each column from the data
    for (const row of queryResult.rows) {
      for (let i = 0; i < row.length; i++) {
        const valueString = this.formatValue(row[i], opts);
        columnWidths[i] = Math.max(columnWidths[i], valueString.length);
      }
    }
    
    // Create the header row
    let table = queryResult.columns.map((column: string, index: number) => 
      column.padEnd(columnWidths[index])
    ).join(' | ') + '\n';
    
    // Create the separator line
    table += columnWidths.map((width: number) => 
      '-'.repeat(width)
    ).join('-+-') + '\n';
    
    // Add data rows
    for (const row of queryResult.rows) {
      table += row.map((item: ReturnedValue<NodeData, EdgeData>, index: number) => 
        this.formatValue(item, opts).padEnd(columnWidths[index])
      ).join(' | ') + '\n';
    }
    
    return table;
  }
  
  /**
   * Formats query data as a text table
   * 
   * @param queryData The query data to format
   * @param options Formatting options
   * @returns A plain text table string
   */
  private formatQueryDataAsTextTable(
    queryData: QueryResultData<NodeData, EdgeData>,
    options: QueryFormatterOptions
  ): string {
    // Calculate the width of each column
    const columnWidths: number[] = queryData.columns.map((column: string) => column.length);
    
    // Find the maximum width for each column from the data
    for (const row of queryData.rows) {
      for (let i = 0; i < row.length; i++) {
        const valueString = this.formatValue(row[i], options);
        columnWidths[i] = Math.max(columnWidths[i], valueString.length);
      }
    }
    
    // Create the header row
    let table = queryData.columns.map((column: string, index: number) => 
      column.padEnd(columnWidths[index])
    ).join(' | ') + '\n';
    
    // Create the separator line
    table += columnWidths.map((width: number) => 
      '-'.repeat(width)
    ).join('-+-') + '\n';
    
    // Add data rows
    for (const row of queryData.rows) {
      table += row.map((item: ReturnedValue<NodeData, EdgeData>, index: number) => 
        this.formatValue(item, options).padEnd(columnWidths[index])
      ).join(' | ') + '\n';
    }
    
    return table;
  }
  
  /**
   * Formats a returned value as a string
   * 
   * @param value The value to format
   * @param options Formatting options
   * @returns A string representation of the value
   */
  private formatValue(
    value: ReturnedValue<NodeData, EdgeData>,
    options: QueryFormatterOptions
  ): string {
    if (value.value === null || value.value === undefined) {
      return options.includeNulls ? 'null' : '';
    }
    
    let valueStr: string;
    
    if (value.type === 'node') {
      const node = value.value;
      // Format nodes as [Label]:id{props} or [Label]{props} based on includeIds option
      const labels = node.data.labels ? `[${node.data.labels.join(':')}]` : '';
      const nodeId = options.includeIds ? `:${node.id}` : '';
      
      // Create a simplified props object without labels
      const props = { ...node.data };
      if (props.labels) {
        delete props.labels;
      }
      
      valueStr = `${labels}${nodeId}{${this.formatProps(props)}}`;
    } 
    else if (value.type === 'edge') {
      const edge = value.value;
      // Format edges as -[TYPE:id{props}]-> or -[TYPE{props}]-> based on includeIds option
      const edgeId = options.includeIds ? `:${edge.id}` : '';
      valueStr = `-[${edge.label}${edgeId}{${this.formatProps(edge.data)}}]->`;
    } 
    else {
      // For primitive property values
      if (typeof value.value === 'string') {
        valueStr = `"${value.value}"`;
      } 
      else if (typeof value.value === 'object') {
        valueStr = JSON.stringify(value.value);
      } 
      else {
        valueStr = String(value.value);
      }
    }
    
    // Truncate if needed
    if (options.maxValueLength && valueStr.length > options.maxValueLength) {
      return valueStr.substring(0, options.maxValueLength) + '...';
    }
    
    return valueStr;
  }
  
  /**
   * Formats a returned value for JSON output
   * 
   * @param value The value to format
   * @param options Formatting options
   * @returns A JSON-friendly representation of the value
   */
  private formatValueForJson(
    value: ReturnedValue<NodeData, EdgeData>,
    options: QueryFormatterOptions
  ): any {
    if (value.value === null || value.value === undefined) {
      return null;
    }
    
    if (value.type === 'node') {
      const node = value.value;
      const result: Record<string, any> = {
        type: 'node',
        data: node.data
      };
      
      if (options.includeIds) {
        result.id = node.id;
      }
      
      return result;
    } 
    else if (value.type === 'edge') {
      const edge = value.value;
      const result: Record<string, any> = {
        type: 'edge',
        label: edge.label,
        data: edge.data
      };
      
      if (options.includeIds) {
        result.id = edge.id;
        result.source = edge.source;
        result.target = edge.target;
      }
      
      return result;
    } 
    
    // For primitive property values, return as is
    return value.value;
  }
  
  /**
   * Formats object properties as a string
   * 
   * @param props The properties object
   * @returns A string representation of the properties
   */
  private formatProps(props: Record<string, any>): string {
    const entries = Object.entries(props)
      .map(([key, value]) => {
        let valueStr: string;
        
        if (value === null || value === undefined) {
          valueStr = 'null';
        } 
        else if (typeof value === 'string') {
          valueStr = `"${value}"`;
        } 
        else if (typeof value === 'object') {
          valueStr = JSON.stringify(value);
        } 
        else {
          valueStr = String(value);
        }
        
        return `${key}: ${valueStr}`;
      });
      
    return entries.join(', ');
  }
}

/**
 * Creates a new query formatter
 * 
 * @returns A new QueryFormatter instance
 */
export function createQueryFormatter<NodeData = any, EdgeData = any>(): QueryFormatter<NodeData, EdgeData> {
  return new QueryFormatter<NodeData, EdgeData>();
}