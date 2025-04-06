import { Graph, Node, Edge, NodeId } from '@/graph'; // <-- Add NodeId
import {
  Rule, parseRuleFromMarkdown, extractRulesFromMarkdown, CypherParser,
  CypherStatement, ReturnClause, ReturnItem, PropertyExpression, VariableExpression
} from '@/lang/rule-parser';
import { Lexer } from '@/lang/lexer';
import { transformToCypherAst } from '@/lang/ast-transformer';
import { PatternMatcherWithConditions } from '@/lang/pattern-matcher-with-conditions';
import { BindingContext } from '@/lang/condition-evaluator';
import {
  ActionFactory, ActionExecutor, RuleAction, ActionExecutionOptions, ActionExecutionResult,
  DeleteAction as IDeleteAction // <-- Import DeleteAction interface
} from './rule-action-index';

/**
 * Options for rule execution
 */
export interface RuleExecutionOptions extends ActionExecutionOptions {
  /**
   * Maximum number of matches to process
   */
  maxMatches?: number;
}

/**
 * Represents a returned value from a query
 */
export interface ReturnedValue<NodeData = any, EdgeData = any> {
  /**
   * The variable or property name
   */
  name: string;

  /**
   * The value from the graph (can be a node, edge, or property value)
   */
  value: Node<NodeData> | Edge<EdgeData> | any;

  /**
   * The type of the value ('node', 'edge', or 'property')
   */
  type: 'node' | 'edge' | 'property';
}

/**
 * Represents the query part of a result
 */
export interface QueryResultData<NodeData = any, EdgeData = any> {
  /**
   * The rows of results, each containing the values for one match
   */
  rows: ReturnedValue<NodeData, EdgeData>[][];

  /**
   * Column names in order
   */
  columns: string[];
}

/**
 * Represents the action part of a result
 */
export interface ActionResultData<NodeData = any, EdgeData = any> {
  /**
   * Results from individual action executions
   */
  actionResults: ActionExecutionResult<NodeData, EdgeData>[];

  /**
   * Nodes affected by all actions (created or modified)
   */
  affectedNodes: Node<NodeData>[];

  /**
   * Edges affected by all actions (created or modified)
   */
  affectedEdges: Edge<EdgeData>[];

  /**
   * IDs of nodes deleted by all actions
   */
  deletedNodeIds?: NodeId[]; // <-- Add deleted node IDs

  /**
   * Keys (source-label-target) of edges deleted by all actions
   */
  deletedEdgeKeys?: string[]; // <-- Add deleted edge keys
}

/**
 * Unified result interface for both queries and rule executions
 */
export interface GraphQueryResult<NodeData = any, EdgeData = any> {
  /**
   * Whether execution was successful
   */
  success: boolean;

  /**
   * Number of pattern matches found
   */
  matchCount: number;

  /**
   * Error message if execution failed
   */
  error?: string;

  /**
   * The original statement that was executed
   */
  statement: string;

  /**
   * Execution statistics
   */
  stats: {
    /**
     * Whether read operations were performed
     */
    readOperations: boolean;

    /**
     * Whether write operations were performed
     */
    writeOperations: boolean;

    /**
     * Execution time in milliseconds
     */
    executionTimeMs: number;
  };

  /**
   * Query results (if the statement contains a RETURN clause)
   */
  query?: QueryResultData<NodeData, EdgeData>;

  /**
   * Action results (if the statement contains CREATE/SET clauses)
   */
  actions?: ActionResultData<NodeData, EdgeData>;
}


/**
 * Result of rule execution
 */
export interface RuleExecutionResult<NodeData = any, EdgeData = any> {
  /**
   * The rule that was executed
   */
  rule: Rule;

  /**
   * Whether execution was successful
   */
  success: boolean;

  /**
   * Results from action execution
   */
  actionResults: ActionExecutionResult<NodeData, EdgeData>[];

  /**
   * Number of pattern matches found
   */
  matchCount: number;

  /**
   * Error message if execution failed
   */
  error?: string;

}

/**
 * Integrated rule engine that handles the complete flow from rule text to execution
 */
export class RuleEngine<NodeData = any, EdgeData = any> {
  private patternMatcher: PatternMatcherWithConditions<NodeData, EdgeData>;
  private actionFactory: ActionFactory<NodeData, EdgeData>;
  private actionExecutor: ActionExecutor<NodeData, EdgeData>;

  /**
   * Creates a new rule engine
   */
  constructor() {
    this.patternMatcher = new PatternMatcherWithConditions<NodeData, EdgeData>();
    this.actionFactory = new ActionFactory<NodeData, EdgeData>();
    this.actionExecutor = new ActionExecutor<NodeData, EdgeData>();
  }

  /**
   * Executes a graph query or rule on a graph and returns a unified result
   * 
   * Handles both read operations (RETURN) and write operations (CREATE/SET/DELETE),
   * or a combination of both.
   * 
   * @param graph The graph to operate on
   * @param statement The query/rule statement
   * @param options Execution options
   * @returns Unified result containing both query results and action results if applicable
   */
  executeQuery(
    graph: Graph<NodeData, EdgeData>,
    statement: string,
    options?: RuleExecutionOptions
  ): GraphQueryResult<NodeData, EdgeData> {
    const startTime = Date.now();

    try {
      // 1. Parse the statement to a CypherStatement
      const lexer = new Lexer();
      const parser = new CypherParser(lexer, statement);
      const cypherStatement = parser.parse();

      const parseErrors = parser.getErrors();
      if (parseErrors.length > 0) {
        return {
          success: false,
          matchCount: 0,
          statement,
          error: `Parse errors: ${parseErrors.join(', ')}`,
          stats: {
            readOperations: false,
            writeOperations: false,
            executionTimeMs: Date.now() - startTime
          }
        };
      }

      // Determine if we have read and/or write operations
      const hasReadOps = !!cypherStatement.return;
      // Update write ops check to include DELETE
      const hasWriteOps = !!(cypherStatement.create || cypherStatement.set || cypherStatement.delete);

      // 2. Find all matches for the statement using the updated findMatches
      let matches = this.findMatches(graph, cypherStatement, options);

      // Initialize the result
      const result: GraphQueryResult<NodeData, EdgeData> = {
        success: true,
        matchCount: matches.length,
        statement,
        stats: {
          readOperations: hasReadOps,
          writeOperations: hasWriteOps, // Updated
          executionTimeMs: 0 // Will update at the end
        }
      };

      // 3. Execute actions if present (CREATE/SET/DELETE)
      if (hasWriteOps) {
        // Transform to AST for action creation
        const ast = transformToCypherAst(
          cypherStatement,
          'unnamed', // Default name for ad-hoc statements
          '', // Empty description
          0, // Default priority
          false // Not disabled
        );

        // Convert AST CREATE/SET/DELETE clauses to actions
        const actions = this.actionFactory.createActionsFromRuleAst(ast);

        // Group actions by type to process them in the correct order
        // Order: CREATE_NODE -> CREATE_RELATIONSHIP -> SET_PROPERTY -> DELETE
        const createNodeActions: RuleAction<NodeData, EdgeData>[] = [];
        const createRelationshipActions: RuleAction<NodeData, EdgeData>[] = [];
        const setPropertyActions: RuleAction<NodeData, EdgeData>[] = [];
        const deleteActions: RuleAction<NodeData, EdgeData>[] = []; // <-- Add delete actions group

        actions.forEach(action => {
          if (action.type === 'CREATE_NODE') {
            createNodeActions.push(action);
          } else if (action.type === 'CREATE_RELATIONSHIP') {
            createRelationshipActions.push(action);
          } else if (action.type === 'SET_PROPERTY') {
            setPropertyActions.push(action);
          } else if (action.type === 'DELETE') { // <-- Group delete actions
            deleteActions.push(action);
          }
        });

        // Execute actions for each match
        const allActionResults: ActionExecutionResult<NodeData, EdgeData>[] = [];
        const allAffectedNodes: Node<NodeData>[] = [];
        const allAffectedEdges: Edge<EdgeData>[] = [];
        const allDeletedNodeIds: NodeId[] = []; // <-- Track deleted node IDs
        const allDeletedEdgeKeys: string[] = []; // <-- Track deleted edge keys
        const updatedMatches: BindingContext<NodeData, EdgeData>[] = [];
        let allSuccessful = true;

        for (const match of matches) {
          // Create a deep copy of the binding context to track changes
          const bindingContext = new BindingContext<NodeData, EdgeData>();
          // Copy all bindings from the original match
          const variableNames = match.getVariableNames();
          for (const varName of variableNames) {
            bindingContext.set(varName, match.get(varName));
          }

          // --- Execute actions in order ---

          // 1. CREATE NODE
          if (createNodeActions.length > 0) {
            const nodeResult = this.actionExecutor.executeActions(graph, createNodeActions, bindingContext, options);
            allActionResults.push(nodeResult);
            if (nodeResult.affectedNodes) allAffectedNodes.push(...nodeResult.affectedNodes);
            if (!nodeResult.success) {
              allSuccessful = false; result.success = false; result.error = nodeResult.error || 'CREATE NODE failed'; continue;
            }
          }

          // 2. CREATE RELATIONSHIP
          if (createRelationshipActions.length > 0) {
            const relResult = this.actionExecutor.executeActions(graph, createRelationshipActions, bindingContext, options);
            allActionResults.push(relResult);
            if (relResult.affectedEdges) allAffectedEdges.push(...relResult.affectedEdges);
            if (!relResult.success) {
              allSuccessful = false; result.success = false; result.error = relResult.error || 'CREATE RELATIONSHIP failed'; continue;
            }
          }

          // 3. SET PROPERTY
          if (setPropertyActions.length > 0) {
            const setResult = this.actionExecutor.executeActions(graph, setPropertyActions, bindingContext, options);
            allActionResults.push(setResult);
            // SET might affect nodes or edges
            if (setResult.affectedNodes) allAffectedNodes.push(...setResult.affectedNodes);
            if (setResult.affectedEdges) allAffectedEdges.push(...setResult.affectedEdges);
            if (!setResult.success) {
              allSuccessful = false; result.success = false; result.error = setResult.error || 'SET PROPERTY failed'; continue;
            }
          }

          // 4. DELETE
          if (deleteActions.length > 0) {
            const deleteResult = this.actionExecutor.executeActions(graph, deleteActions, bindingContext, options);
            allActionResults.push(deleteResult);
            // DELETE returns the *original* items before deletion in affectedNodes/Edges
            if (deleteResult.affectedNodes) {
              deleteResult.affectedNodes.forEach(n => { if (!allDeletedNodeIds.includes(n.id)) allDeletedNodeIds.push(n.id); });
            }
            if (deleteResult.affectedEdges) {
              deleteResult.affectedEdges.forEach(e => {
                const key = `${e.source}-${e.label}-${e.target}`;
                if (!allDeletedEdgeKeys.includes(key)) allDeletedEdgeKeys.push(key);
              });
            }
            if (!deleteResult.success) {
              allSuccessful = false; result.success = false; result.error = deleteResult.error || 'DELETE failed'; continue;
            }
          }

          // Add the updated binding context to our updated matches
          updatedMatches.push(bindingContext);
        }

        // Always use the updated bindings after action execution
        if (updatedMatches.length > 0) {
          matches = updatedMatches;
          // Update the match count to reflect the number of successful action executions
          result.matchCount = matches.length;
        }

        // Add action results to the unified result
        result.actions = {
          actionResults: allActionResults, // Use the collected results
          affectedNodes: allAffectedNodes,
          affectedEdges: allAffectedEdges,
          deletedNodeIds: allDeletedNodeIds,
          deletedEdgeKeys: allDeletedEdgeKeys
        };
      }

      // 4. Extract query results if RETURN is present
      if (hasReadOps) {
        if (cypherStatement.return) {
          const queryData = this.extractQueryData(matches, cypherStatement.return);
          result.query = queryData;
        }
      }

      // Update execution time
      result.stats.executionTimeMs = Date.now() - startTime;
      return result;
    }
    catch (error: any) {
      return {
        success: false,
        matchCount: 0,
        statement,
        error: error.message || String(error),
        stats: {
          readOperations: false,
          writeOperations: false,
          executionTimeMs: Date.now() - startTime
        }
      };
    }
  }



  /**
   * Finds pattern matches for a Cypher statement using the updated PatternMatcherWithConditions.
   * 
   * @param graph The graph to search
   * @param cypherStatement The Cypher statement to match
   * @param options Execution options
   * @returns Array of binding contexts for each match
   */
  private findMatches(
    graph: Graph<NodeData, EdgeData>,
    cypherStatement: CypherStatement,
    options?: RuleExecutionOptions
  ): BindingContext<NodeData, EdgeData>[] {
    let matches: BindingContext<NodeData, EdgeData>[] = [];

    if (cypherStatement.match) {
      // Directly use executeMatchQuery which handles single/multiple patterns and WHERE clause
      matches = this.patternMatcher.executeMatchQuery(
        graph,
        cypherStatement.match.patterns, // Pass the array of patterns
        cypherStatement.where // Pass the WHERE clause
      );

      // Limit final matches if maxMatches is specified
      if (options?.maxMatches && matches.length > options.maxMatches) {
        matches = matches.slice(0, options.maxMatches);
      }
    } else {
      // If no MATCH clause, create a single empty binding context
      // This allows WHERE clauses without MATCH (e.g., WHERE 1=1) or CREATE without MATCH
      matches.push(new BindingContext<NodeData, EdgeData>());
      // Apply WHERE clause if it exists, even without MATCH
      if (cypherStatement.where?.condition) {
        matches = matches.filter(binding =>
          this.patternMatcher.getConditionEvaluator().evaluateCondition(graph, cypherStatement.where!.condition, binding)
        );
      }
    }

    return matches;
  }

  /**
   * Extracts query data from binding contexts and a RETURN clause
   * 
   * @param matches The binding contexts from pattern matches
   * @param returnClause The RETURN clause specifying what to return
   * @returns The query data
   */
  private extractQueryData(
    matches: BindingContext<NodeData, EdgeData>[],
    returnClause: ReturnClause
  ): QueryResultData<NodeData, EdgeData> {
    const columns: string[] = [];
    const rows: ReturnedValue<NodeData, EdgeData>[][] = [];

    // Extract column names from the return items
    for (const item of returnClause.items) {
      // For variables, use the variable name
      if (item.expression.type === 'variable') {
        columns.push(item.expression.name);
      }
      // For property expressions, use variable.property
      else if (item.expression.type === 'property') {
        columns.push(`${item.expression.object.name}.${item.expression.property}`);
      }
    }

    // For each match, extract the values for each return item
    for (const match of matches) {
      const row: ReturnedValue<NodeData, EdgeData>[] = [];

      for (const item of returnClause.items) {
        if (item.expression.type === 'variable') {
          const varExpr = item.expression as VariableExpression;
          const value = match.get(varExpr.name);

          if (value !== undefined) {
            const type = this.isNode(value) ? 'node' : 'edge';
            row.push({
              name: varExpr.name,
              value,
              type
            });
          } else {
            // Variable not found, push null
            row.push({
              name: varExpr.name,
              value: null,
              type: 'property'
            });
          }
        }
        else if (item.expression.type === 'property') {
          const propExpr = item.expression as PropertyExpression;
          const object = match.get(propExpr.object.name);

          if (object !== undefined) {
            // Extract property value from the object
            let propertyValue: any = null;

            // For graph nodes and edges, property is in data
            if (this.isNode(object) || this.isEdge(object)) {
              propertyValue = object.data[propExpr.property as keyof typeof object.data];
            }
            // For other objects, property is direct
            else if (typeof object === 'object' && object !== null) {
              propertyValue = (object as any)[propExpr.property];
            }

            row.push({
              name: `${propExpr.object.name}.${propExpr.property}`,
              value: propertyValue,
              type: 'property'
            });
          } else {
            // Object not found, push null
            row.push({
              name: `${propExpr.object.name}.${propExpr.property}`,
              value: null,
              type: 'property'
            });
          }
        }
      }

      rows.push(row);
    }

    return {
      rows,
      columns
    };
  }


  /**
   * Type guard to check if a value is a graph node
   * 
   * @param value The value to check
   * @returns True if the value is a graph node
   */
  private isNode(value: any): value is Node<NodeData> {
    return (
      value !== null &&
      typeof value === 'object' &&
      'id' in value &&
      'label' in value &&
      'data' in value &&
      !('source' in value) &&
      !('target' in value)
    );
  }

  /**
   * Type guard to check if a value is a graph edge
   * 
   * @param value The value to check
   * @returns True if the value is a graph edge
   */
  private isEdge(value: any): value is Edge<EdgeData> {
    return (
      value !== null &&
      typeof value === 'object' &&
      'source' in value &&
      'target' in value &&
      'label' in value &&
      'data' in value
    );
  }

  /**
   * Executes multiple graph queries on a graph in priority order (highest first)
   * 
   * @param graph The graph to execute the queries on
   * @param rules The rules to execute
   * @param options Execution options
   * @returns Array of unified query results
   */
  executeQueries(
    graph: Graph<NodeData, EdgeData>,
    rules: Rule[],
    options?: RuleExecutionOptions
  ): GraphQueryResult<NodeData, EdgeData>[] {
    // Sort rules by priority (highest first)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    // Execute each rule
    const results: GraphQueryResult<NodeData, EdgeData>[] = [];

    for (const rule of sortedRules) {
      // Skip disabled rules
      if (rule.disabled) {
        continue;
      }

      const result = this.executeQuery(graph, rule.ruleText, options);
      results.push(result);

      // Log execution for monitoring
      console.log(`Executed rule '${rule.name}': ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`  - Matches: ${result.matchCount}`);

      if (result.actions) {
        console.log(`  - Actions executed: ${result.actions.actionResults.reduce(
          (sum, r) => sum + r.actionResults.length, 0
        )}`);
      }

      if (result.error) {
        console.error(`  - Error: ${result.error}`);
      }
    }

    return results;
  }


  /**
   * Parse and execute graph queries from markdown
   * 
   * @param graph The graph to execute the queries on
   * @param markdown The markdown containing the rules/queries
   * @param options Execution options
   * @returns Array of unified query results
   */
  executeQueriesFromMarkdown(
    graph: Graph<NodeData, EdgeData>,
    markdown: string,
    options?: RuleExecutionOptions
  ): GraphQueryResult<NodeData, EdgeData>[] {
    const rules = extractRulesFromMarkdown(markdown);
    return this.executeQueries(graph, rules, options);
  }


  /**
   * Execute a graph query from a markdown code block
   * 
   * @param graph The graph to query
   * @param markdown The markdown containing the query in a code block
   * @param codeBlockType The type of code block to look for (default: "graphquery")
   * @param options Execution options
   * @returns Unified result containing both query results and action results if applicable
   */
  executeQueryFromMarkdown(
    graph: Graph<NodeData, EdgeData>,
    markdown: string,
    codeBlockType: string = "graphquery",
    options?: RuleExecutionOptions
  ): GraphQueryResult<NodeData, EdgeData> {
    try {
      // Extract the query from the markdown code block
      const regex = new RegExp(`\`\`\`${codeBlockType}([\\s\\S]*?)\`\`\``);
      const match = regex.exec(markdown);

      if (!match) {
        return {
          success: false,
          matchCount: 0,
          statement: '',
          error: `No ${codeBlockType} code block found in the provided markdown`,
          stats: {
            readOperations: false,
            writeOperations: false,
            executionTimeMs: 0
          }
        };
      }

      const statement = match[1].trim();

      // Execute the query
      return this.executeQuery(graph, statement, options);
    } catch (error: any) {
      return {
        success: false,
        matchCount: 0,
        statement: '',
        error: error.message || String(error),
        stats: {
          readOperations: false,
          writeOperations: false,
          executionTimeMs: 0
        }
      };
    }
  }
}

/**
 * Creates a new rule engine
 * @returns A new RuleEngine instance
 */
export function createRuleEngine<NodeData = any, EdgeData = any>(): RuleEngine<NodeData, EdgeData> {
  return new RuleEngine<NodeData, EdgeData>();
}