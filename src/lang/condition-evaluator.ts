import { Graph, Node, Edge } from '@/graph';
import {
  Expression, LiteralExpression, VariableExpression, PropertyExpression, ComparisonExpression,
  LogicalExpression, ExistsExpression, ComparisonOperator, LogicalOperator
} from './parser';
import { PatternMatcher } from './pattern-matcher';

/**
 * Options for configuring the condition evaluator
 */
export interface ConditionEvaluatorOptions {
  /**
   * Whether to enable type coercion in comparisons.
   * When enabled, string "42" will match number 42, and so on.
   * 
   * @default false
   * 
   * @example
   * ```typescript
   * const evaluator = createConditionEvaluator({ enableTypeCoercion: true });
   * evaluator.evaluateComparison('42', ComparisonOperator.EQUALS, 42);
   * // Returns true with type coercion enabled
   * ```
   */
  enableTypeCoercion?: boolean;

  /**
   * Whether to allow null values to propagate in comparisons.
   * When disabled (default), comparing with null always returns false.
   * When enabled, null values are treated like regular values in comparisons.
   * 
   * @default false
   * 
   * @example
   * ```typescript
   * const standard = createConditionEvaluator();
   * standard.evaluateComparison(null, ComparisonOperator.EQUALS, 'something');
   * // Returns false (standard SQL-like behavior)
   * 
   * const nullAware = createConditionEvaluator({ nullAwareComparisons: true });
   * nullAware.evaluateComparison(null, ComparisonOperator.EQUALS, 'something');
   * // Can return meaningful comparisons
   * ```
   */
  nullAwareComparisons?: boolean;

  /**
   * Maximum depth for pattern matching in EXISTS checks to prevent
   * excessive computation and stack overflow for complex patterns.
   * 
   * @default 10
   */
  maxExistsDepth?: number;
}

/**
 * Result of an evaluation with additional metadata
 */
export interface EvaluationResult {
  /**
   * The value of the evaluation
   */
  value: any;

  /**
   * Whether the evaluation succeeded or encountered an error
   */
  success: boolean;

  /**
   * Error message if evaluation failed
   */
  error?: string;

  /**
   * Type of the result value
   */
  type: 'boolean' | 'number' | 'string' | 'null' | 'undefined' | 'object' | 'array';
}



/**
 * BindingContext that manages variable bindings
 * 
 * BindingContext maps variable names to graph elements.
 * The binding context is used to store variable values during condition evaluation.
 * It supports parent-child relationships for scoped evaluation contexts.
 * 
 * @template NodeData Type of data associated with nodes
 * @template EdgeData Type of data associated with edges
 */
export class BindingContext<NodeData = any, EdgeData = any> {
  private bindings: Map<string, any>;
  private parent: BindingContext<NodeData, EdgeData> | null;

  /**
   * Creates a new binding context
   * @param parent Optional parent context to inherit bindings from
   */
  constructor(parent: BindingContext<NodeData, EdgeData> | null = null) {
    this.bindings = new Map<string, any>();
    this.parent = parent;
  }

  /**
   * Get a bound value by variable name
   * 
   * @param name The variable name to look up
   * @returns The bound node, edge, or value; undefined if not found
   * 
   * @example
   * ```typescript
   * const node = bindings.get('n');
   * if (node) {
   *   console.log(node.id);
   * }
   * ```
   */
  get(name: string): Node<NodeData> | Edge<EdgeData> | any | undefined {
    if (this.bindings.has(name)) {
      return this.bindings.get(name);
    }

    if (this.parent) {
      return this.parent.get(name);
    }

    return undefined;
  }

  /**
   * Set a bound value by variable name
   * 
   * @param name The variable name to bind
   * @param value The node, edge, or value to bind
   * 
   * @example
   * ```typescript
   * // Bind a node
   * bindings.set('n', graph.getNode('node1'));
   * 
   * // Bind an edge
   * bindings.set('r', graph.getEdge('node1', 'node2', 'KNOWS'));
   * 
   * // Bind a simple value
   * bindings.set('priority', 1);
   * ```
   */
  set(name: string, value: Node<NodeData> | Edge<EdgeData> | any): void {
    this.bindings.set(name, value);
  }

  /**
   * Check if a variable name is bound
   * 
   * @param name The variable name to check
   * @returns True if the variable is bound, false otherwise
   * 
   * @example
   * ```typescript
   * if (bindings.has('n')) {
   *   // Variable 'n' is bound
   * }
   * ```
   */
  has(name: string): boolean {
    return this.bindings.has(name) || (this.parent ? this.parent.has(name) : false);
  }

  /**
   * Create a child binding context that inherits from this one.
   * Changes to the child context do not affect the parent.
   * The child can access parent bindings, but the parent cannot access child bindings.
   * 
   * @returns A new binding context with this one as parent
   * 
   * @example
   * ```typescript
   * // Create parent context
   * const parentBindings = createBindingContext();
   * parentBindings.set('global', 'value');
   * 
   * // Create child context
   * const childBindings = parentBindings.createChildContext();
   * childBindings.set('local', 'childValue');
   * 
   * // Child can access parent bindings
   * console.log(childBindings.get('global')); // 'value'
   * 
   * // Parent cannot access child bindings
   * console.log(parentBindings.get('local')); // undefined
   * ```
   */
  createChildContext(): BindingContext<NodeData, EdgeData> {
    return new BindingContext<NodeData, EdgeData>(this);
  }

  /**
   * Get all variable names bound in this context
   * @returns Array of variable names
   */
  getVariableNames(): string[] {
    const ownVariables = Array.from(this.bindings.keys());

    if (!this.parent) {
      return ownVariables;
    }

    const parentVariables = this.parent.getVariableNames();

    // Return unique variables (parent variables that aren't shadowed + own variables)
    return [...new Set([...parentVariables.filter(v => !this.bindings.has(v)), ...ownVariables])];
  }
}

/**
 * ConditionEvaluator for evaluating expressions and conditions in the context of a graph.
 * 
 * The condition evaluator is responsible for evaluating WHERE clauses in graph queries
 * and filtering pattern matches based on conditions.
 * 
 * @template NodeData Type of data associated with nodes
 * @template EdgeData Type of data associated with edges
 */
export class ConditionEvaluator<NodeData = any, EdgeData = any> {
  private options: Required<ConditionEvaluatorOptions>;
  private patternMatcher: PatternMatcher<NodeData, EdgeData>;

  /**
   * Creates a new condition evaluator
   * @param options Options for configuring the evaluator
   */
  constructor(options: ConditionEvaluatorOptions = {}) {
    this.options = {
      enableTypeCoercion: options.enableTypeCoercion ?? false,
      nullAwareComparisons: options.nullAwareComparisons ?? false,
      maxExistsDepth: options.maxExistsDepth ?? 10
    };

    // Initialize with default pattern matcher
    this.patternMatcher = new PatternMatcher<NodeData, EdgeData>();
  }

  /**
   * Set the pattern matcher to use for pattern matching operations.
   * This is required for EXISTS pattern checks to work.
   * 
   * @param patternMatcher The pattern matcher implementation to use
   * 
   * @example
   * ```typescript
   * const patternMatcher = new PatternMatcher();
   * const evaluator = createConditionEvaluator();
   * evaluator.setPatternMatcher(patternMatcher);
   * ```
   */
  setPatternMatcher(patternMatcher: PatternMatcher<NodeData, EdgeData>): void {
    this.patternMatcher = patternMatcher;
  }

  /**
   * Evaluate an expression in the context of a graph and binding context.
   * This method can evaluate any expression type: literals, variables,
   * property access, comparisons, logical operations, and exists checks.
   * 
   * @param graph The graph to evaluate against
   * @param expression The expression to evaluate
   * @param bindings Optional binding context for variables
   * @returns The result of the expression evaluation
   * 
   * @example
   * ```typescript
   * // Evaluate a comparison expression
   * const expr = {
   *   type: 'comparison',
   *   left: { type: 'property', object: { type: 'variable', name: 'n' }, property: 'age' },
   *   operator: ComparisonOperator.GREATER_THAN,
   *   right: { type: 'literal', value: 30, dataType: 'number' }
   * };
   * 
   * const bindings = createBindingContext();
   * bindings.set('n', graph.getNode('person1'));
   * 
   * const result = evaluator.evaluateExpression(graph, expr, bindings);
   * // Returns true if person1.age > 30
   * ```
   */
  evaluateExpression(
    graph: Graph<NodeData, EdgeData>,
    expression: Expression,
    bindings: BindingContext<NodeData, EdgeData> = new BindingContext()
  ): any {
    switch (expression.type) {
      case 'literal':
        return this.evaluateLiteralExpression(expression as LiteralExpression);

      case 'variable':
        return this.evaluateVariableExpression(expression as VariableExpression, bindings);

      case 'property':
        return this.evaluatePropertyExpression(expression as PropertyExpression, bindings);

      case 'comparison':
        return this.evaluateComparisonExpression(graph, expression as ComparisonExpression, bindings);

      case 'logical':
        return this.evaluateLogicalExpression(graph, expression as LogicalExpression, bindings);

      case 'exists':
        return this.evaluateExistsExpression(graph, expression as ExistsExpression, bindings);

      default:
        throw new Error(`Unsupported expression type: ${(expression as any).type}`);
    }
  }

  /**
   * Evaluate a complete condition (typically a WHERE clause) in the context of a graph.
   * The condition is evaluated to a boolean result.
   * 
   * @param graph The graph to evaluate against
   * @param condition The condition expression to evaluate
   * @param bindings Optional binding context for variables
   * @returns True if the condition is satisfied, false otherwise
   * 
   * @example
   * ```typescript
   * // Create a condition: n.type = 'person' AND n.age > 30
   * const condition = {
   *   type: 'logical',
   *   operator: LogicalOperator.AND,
   *   operands: [
   *     {
   *       type: 'comparison',
   *       left: { type: 'property', object: { type: 'variable', name: 'n' }, property: 'type' },
   *       operator: ComparisonOperator.EQUALS,
   *       right: { type: 'literal', value: 'person', dataType: 'string' 
   *     },
   *     {
   *       type: 'comparison',
   *       left: { type: 'property', object: { type: 'variable', name: 'n' }, property: 'age' },
   *       operator: ComparisonOperator.GREATER_THAN,
   *       right: { type: 'literal', value: 30, dataType: 'number' }
   *     }
   *   ]
   * };
   * 
   * const bindings = createBindingContext();
   * bindings.set('n', graph.getNode('person1'));
   * 
   * const result = evaluator.evaluateCondition(graph, condition, bindings);
   * // Returns true if person1.type = 'person' AND person1.age > 30
   * ```
   */
  evaluateCondition(
    graph: Graph<NodeData, EdgeData>,
    condition: Expression,
    bindings: BindingContext<NodeData, EdgeData> = new BindingContext()
  ): boolean {
    const result = this.evaluateExpression(graph, condition, bindings);
    return Boolean(result);
  }

  /**
   * Evaluate a literal expression
   * @param expression The literal expression to evaluate
   * @returns The literal value
   */
  private evaluateLiteralExpression(expression: LiteralExpression): any {
    return expression.value;
  }

  /**
   * Evaluate a variable expression
   * @param expression The variable expression to evaluate
   * @param bindings The binding context for variables
   * @returns The bound value, or undefined if not bound
   */
  private evaluateVariableExpression(
    expression: VariableExpression,
    bindings: BindingContext<NodeData, EdgeData>
  ): any {
    return bindings.get(expression.name);
  }

  /**
   * Evaluate a property access expression to extract a property value 
   * from a node, edge, or object.
   * 
   * @param expression The property expression to evaluate
   * @param bindings The binding context for variables
   * @returns The value of the property, or undefined if not found
   * 
   * @example
   * ```typescript
   * const expr = {
   *   type: 'property',
   *   object: { type: 'variable', name: 'n' },
   *   property: 'name'
   * };
   * 
   * const bindings = createBindingContext();
   * bindings.set('n', graph.getNode('person1'));
   * 
   * const name = evaluator.evaluatePropertyExpression(expr, bindings);
   * // Returns the value of person1.name
   * ```
   */
  evaluatePropertyExpression(
    expression: PropertyExpression,
    bindings: BindingContext<NodeData, EdgeData>
  ): any {
    const object = this.evaluateExpression(null as any, expression.object, bindings);

    if (!object || typeof object !== 'object') {
      return undefined;
    }

    // Handle both Node and Edge objects, as well as regular objects
    if ('data' in object) {
      const data = object.data as Record<string, any>;
      return data[expression.property];
    }

    // Direct access for regular objects
    return (object as Record<string, any>)[expression.property];
  }

  /**
   * Evaluate a comparison expression
   * @param graph The graph to evaluate against
   * @param expression The comparison expression to evaluate
   * @param bindings The binding context for variables
   * @returns The result of the comparison
   */
  private evaluateComparisonExpression(
    graph: Graph<NodeData, EdgeData>,
    expression: ComparisonExpression,
    bindings: BindingContext<NodeData, EdgeData>
  ): boolean {
    const leftValue = this.evaluateExpression(graph, expression.left, bindings);
    const rightValue = this.evaluateExpression(graph, expression.right, bindings);

    return this.evaluateComparison(leftValue, expression.operator, rightValue);
  }

  /**
   * Evaluate a comparison expression between two values.
   * Supports standard comparisons (=, <>, <, <=, >, >=) as well as
   * string operations (CONTAINS, STARTS WITH, ENDS WITH) and
   * null checks (IS NULL, IS NOT NULL).
   * 
   * @param left The left side value
   * @param operator The comparison operator
   * @param right The right side value
   * @param options Optional comparison options
   * @returns The result of the comparison (true or false)
   * 
   * @example
   * ```typescript
   * // String equality
   * evaluator.evaluateComparison('Alice', ComparisonOperator.EQUALS, 'Alice');
   * // Returns true
   * 
   * // Numeric comparison
   * evaluator.evaluateComparison(30, ComparisonOperator.GREATER_THAN, 25);
   * // Returns true
   * 
   * // String contains
   * evaluator.evaluateComparison('Hello World', ComparisonOperator.CONTAINS, 'World');
   * // Returns true
   * 
   * // Type coercion example
   * evaluator.evaluateComparison('42', ComparisonOperator.EQUALS, 42, { enableTypeCoercion: true });
   * // Returns true when type coercion is enabled
   * ```
   */
  evaluateComparison(
    left: any,
    operator: ComparisonOperator,
    right: any,
    options: { enableTypeCoercion?: boolean } = {}
  ): boolean {
    // Handle null or undefined values


    // Special case: null == null should be true
    if ((left === null || left === undefined) && (right === null || right === undefined)) {
      if (operator === ComparisonOperator.EQUALS) {
        return true;
      }
      if (operator === ComparisonOperator.NOT_EQUALS) {
        return false;
      }
    }

    if (left === null || left === undefined || right === null || right === undefined) {
      // For IS NULL and IS NOT NULL operators, we need special handling
      if (operator === ComparisonOperator.IS_NULL) {
        return left === null || left === undefined;
      } else if (operator === ComparisonOperator.IS_NOT_NULL) {
        return left !== null && left !== undefined;
      }

      // If not specifically checking for null/undefined, return false for other comparisons
      if (!this.options.nullAwareComparisons) {
        return false;
      }
    }

    // Enable type coercion if specified in the options or the evaluator
    const useTypeCoercion = options.enableTypeCoercion ?? this.options.enableTypeCoercion;

    switch (operator) {
      case ComparisonOperator.EQUALS:
        if (useTypeCoercion) {
          return this.coercedEquals(left, right);
        }
        return left === right;

      case ComparisonOperator.NOT_EQUALS:
        if (useTypeCoercion) {
          return !this.coercedEquals(left, right);
        }
        return left !== right;

      case ComparisonOperator.LESS_THAN:
        return this.compareValues(left, right, useTypeCoercion) < 0;

      case ComparisonOperator.LESS_THAN_OR_EQUALS:
        return this.compareValues(left, right, useTypeCoercion) <= 0;

      case ComparisonOperator.GREATER_THAN:
        return this.compareValues(left, right, useTypeCoercion) > 0;

      case ComparisonOperator.GREATER_THAN_OR_EQUALS:
        return this.compareValues(left, right, useTypeCoercion) >= 0;

      case ComparisonOperator.IN:
        return this.evaluateInOperator(left, right, useTypeCoercion);

      case ComparisonOperator.CONTAINS:
        return this.evaluateContainsOperator(left, right, useTypeCoercion);

      case ComparisonOperator.STARTS_WITH:
        if (typeof left !== 'string') {
          return false;
        }
        if (typeof right !== 'string') {
          return false;
        }
        return left.startsWith(right);

      case ComparisonOperator.ENDS_WITH:
        if (typeof left !== 'string') {
          return false;
        }
        if (typeof right !== 'string') {
          return false;
        }
        return left.endsWith(right);

      case ComparisonOperator.IS_NULL:
        return left === null || left === undefined;

      case ComparisonOperator.IS_NOT_NULL:
        return left !== null && left !== undefined;

      default:
        throw new Error(`Unsupported comparison operator: ${operator}`);
    }
  }

  /**
   * Evaluate a logical expression
   * @param graph The graph to evaluate against
   * @param expression The logical expression to evaluate
   * @param bindings The binding context for variables
   * @returns The result of the logical operation
   */
  private evaluateLogicalExpression(
    graph: Graph<NodeData, EdgeData>,
    expression: LogicalExpression,
    bindings: BindingContext<NodeData, EdgeData>
  ): boolean {
    switch (expression.operator) {
      case LogicalOperator.AND:
        // Short-circuit AND
        for (const operand of expression.operands) {
          if (!this.evaluateExpression(graph, operand, bindings)) {
            return false;
          }
        }
        return true;

      case LogicalOperator.OR:
        // Short-circuit OR
        for (const operand of expression.operands) {
          if (this.evaluateExpression(graph, operand, bindings)) {
            return true;
          }
        }
        return false;

      case LogicalOperator.NOT:
        // NOT only has one operand
        return !this.evaluateExpression(graph, expression.operands[0], bindings);

      case LogicalOperator.XOR:
        // XOR - count true values
        let trueCount = 0;
        for (const operand of expression.operands) {
          if (this.evaluateExpression(graph, operand, bindings)) {
            trueCount++;
          }
        }
        return trueCount === 1;

      default:
        throw new Error(`Unsupported logical operator: ${expression.operator}`);
    }
  }

  /**
   * Check if a pattern exists in the graph using the EXISTS operator.
   * This is used to implement EXISTS and NOT EXISTS expressions.
   * 
   * @param graph The graph to check
   * @param expression The existence expression to evaluate
   * @param bindings The binding context for variables
   * @returns True if the pattern exists (or doesn't exist for negative checks)
   * 
   * @example
   * ```typescript
   * // Check if a person has any tasks
   * const existsExpr = {
   *   type: 'exists',
   *   positive: true,
   *   pattern: {
   *     start: { variable: 'p', labels: [], properties: {} },
   *     segments: [{
   *       relationship: { type: 'ASSIGNED', properties: {}, direction: 'outgoing' },
   *       node: { labels: ['task'], properties: {} }
   *     }]
   *   }
   * };
   * 
   * const bindings = createBindingContext();
   * bindings.set('p', graph.getNode('person1'));
   * 
   * const hasTask = evaluator.evaluateExistsExpression(graph, existsExpr, bindings);
   * // Returns true if person1 has an outgoing ASSIGNED relationship to any task
   * ```
   */
  evaluateExistsExpression(
    graph: Graph<NodeData, EdgeData>,
    expression: ExistsExpression,
    bindings: BindingContext<NodeData, EdgeData>
  ): boolean {
    // Get the starting node variable from the pattern
    const startVariable = expression.pattern.start.variable;

    // If the start variable is bound in the current context, we need to 
    // constrain the pattern to match only paths starting from that specific node
    if (startVariable && bindings.has(startVariable)) {
      const startNode = bindings.get(startVariable) as Node<NodeData>;
      if (startNode) {
        // Find paths that start with the given node
        const paths = this.patternMatcher.findMatchingPaths(
          graph,
          expression.pattern,
          [startNode.id] // Constrain to specific starting node ID
        );
        return expression.positive ? paths.length > 0 : paths.length === 0;
      }
    }

    // If no binding constraints, just find all matching paths
    const paths = this.patternMatcher.findMatchingPaths(graph, expression.pattern);

    // For EXISTS, check if any paths match
    // For NOT EXISTS, check if no paths match
    return expression.positive ? paths.length > 0 : paths.length === 0;
  }

  /**
   * Compare two values with possible type coercion
   * @param a First value
   * @param b Second value
   * @param coerce Whether to apply type coercion
   * @returns -1 if a < b, 0 if a == b, 1 if a > b
   */
  private compareValues(a: any, b: any, coerce: boolean): number {
    if (a === b) return 0;

    if (coerce) {
      // Apply type coercion if needed
      if (typeof a === 'string' && typeof b === 'number') {
        const aNum = parseFloat(a);
        if (!isNaN(aNum)) {
          return aNum < b ? -1 : aNum > b ? 1 : 0;
        }
      } else if (typeof a === 'number' && typeof b === 'string') {
        const bNum = parseFloat(b);
        if (!isNaN(bNum)) {
          return a < bNum ? -1 : a > bNum ? 1 : 0;
        }
      }
    }

    // Standard comparison for same types
    if (typeof a === 'string' && typeof b === 'string') {
      return a < b ? -1 : a > b ? 1 : 0;
    }

    if (typeof a === 'number' && typeof b === 'number') {
      return a < b ? -1 : a > b ? 1 : 0;
    }

    if (typeof a === 'boolean' && typeof b === 'boolean') {
      return a === b ? 0 : a ? 1 : -1;
    }

    // Different incompatible types
    return NaN;
  }

  /**
   * Check if two values are equal with type coercion
   * @param a First value
   * @param b Second value
   * @returns True if the values are equal after possible coercion
   */
  private coercedEquals(a: any, b: any): boolean {
    if (a === b) return true;

    // Null and undefined are considered equal in coerced comparisons
    if ((a === null || a === undefined) && (b === null || b === undefined)) {
      return true;
    }

    // String to number conversion
    if (typeof a === 'string' && typeof b === 'number') {
      const aNum = parseFloat(a);
      return !isNaN(aNum) && aNum === b;
    }

    if (typeof a === 'number' && typeof b === 'string') {
      const bNum = parseFloat(b);
      return !isNaN(bNum) && a === bNum;
    }

    // Boolean coercion
    if (typeof a === 'boolean') {
      if (typeof b === 'number') {
        return a === (b !== 0);
      }
      if (typeof b === 'string') {
        return a === (b.toLowerCase() === 'true');
      }
    }

    if (typeof b === 'boolean') {
      if (typeof a === 'number') {
        return (a !== 0) === b;
      }
      if (typeof a === 'string') {
        return (a.toLowerCase() === 'true') === b;
      }
    }

    return false;
  }

  /**
   * Evaluate the IN operator
   * @param left Left value to check if it's in right
   * @param right Right value (should be array)
   * @param coerce Whether to apply type coercion
   * @returns True if left is in right
   */
  private evaluateInOperator(left: any, right: any, coerce: boolean): boolean {
    if (!right) return false;

    // If right is an array, check if left is in it
    if (Array.isArray(right)) {
      return right.some(item =>
        coerce ? this.coercedEquals(left, item) : left === item
      );
    }

    // If right is a string and left is a string, check if left is a substring
    if (typeof right === 'string' && typeof left === 'string') {
      return right.includes(left);
    }

    return false;
  }

  /**
   * Evaluate the CONTAINS operator
   * @param left Left value (string or array)
   * @param right Right value to check for
   * @param coerce Whether to apply type coercion
   * @returns True if left contains right
   */
  private evaluateContainsOperator(left: any, right: any, coerce: boolean): boolean {
    if (!left) return false;

    // If left is an array, check if right is in it
    if (Array.isArray(left)) {
      return left.some(item =>
        coerce ? this.coercedEquals(item, right) : item === right
      );
    }

    // If left is a string and right is a string, check if right is a substring
    if (typeof left === 'string' && typeof right === 'string') {
      return left.includes(right);
    }

    return false;
  }

  // --- New Helper Methods for Predicate Pushdown ---

  /**
   * Analyzes a WHERE clause condition to categorize predicates.
   * @param condition The root expression of the WHERE clause.
   * @returns An object containing categorized predicates.
   */
  public analyzeWhereClause(condition: Expression): {
    singleVariablePredicates: Map<string, Expression[]>,
    multiVariablePredicates: Expression[]
  } {
    const singleVariablePredicates = new Map<string, Expression[]>();
    const multiVariablePredicates: Expression[] = [];

    const processExpression = (expr: Expression) => {
      // If it's an AND at the top level or nested within another AND, process its operands individually
      if (expr.type === 'logical' && (expr as LogicalExpression).operator === LogicalOperator.AND) {
        (expr as LogicalExpression).operands.forEach(processExpression);
      } else {
        // For other expressions (comparisons, OR, NOT, EXISTS, etc.), determine variables
        const vars = this.getVariablesInExpression(expr);
        if (vars.size === 1) {
          const varName = Array.from(vars)[0];
          if (!singleVariablePredicates.has(varName)) {
            singleVariablePredicates.set(varName, []);
          }
          singleVariablePredicates.get(varName)!.push(expr);
        } else if (vars.size > 1) {
          multiVariablePredicates.push(expr);
        }
        // Ignore expressions with zero variables (e.g., literal comparisons like 1 = 1)
      }
    };

    processExpression(condition);

    return { singleVariablePredicates, multiVariablePredicates };
  }


  /**
   * Recursively finds all unique variable names used within an expression.
   * @param expression The expression to analyze.
   * @returns A set of variable names.
   */
  private getVariablesInExpression(expression: Expression): Set<string> {
    const variables = new Set<string>();
    const stack: Expression[] = [expression]; // Use a stack for iterative traversal

    while (stack.length > 0) {
      const current = stack.pop()!; // Non-null assertion as stack is checked

      switch (current.type) {
        case 'variable':
          variables.add((current as VariableExpression).name);
          break;
        case 'property':
          // Only add the base variable of the property access
          // Recursively check the object part in case it's nested (though unlikely for simple cases)
          if ((current as PropertyExpression).object.type === 'variable') {
            variables.add(((current as PropertyExpression).object as VariableExpression).name);
          } else {
            // If the object is another expression, push it to the stack
            // This handles cases like `(a.prop).subprop` if that were valid syntax
            stack.push((current as PropertyExpression).object);
          }
          break;
        case 'comparison':
          // Push both sides onto the stack
          stack.push((current as ComparisonExpression).left);
          stack.push((current as ComparisonExpression).right);
          break;
        case 'logical':
          // Push all operands onto the stack
          (current as LogicalExpression).operands.forEach(op => stack.push(op));
          break;
        case 'exists':
          // Recursively find variables within the EXISTS pattern itself
          const pattern = (current as ExistsExpression).pattern;
          if (pattern.start.variable) {
            variables.add(pattern.start.variable);
          }
          pattern.segments.forEach(seg => {
            if (seg.relationship.variable) {
              variables.add(seg.relationship.variable);
            }
            if (seg.node.variable) {
              variables.add(seg.node.variable);
            }
          });
          break;
        case 'literal':
          // Literals don't contain variables, so do nothing
          break;
        default:
          // Should not happen if all expression types are handled
          console.warn(`Unhandled expression type in getVariablesInExpression: ${(current as any).type}`);
          break;
      }
    }

    return variables;
  }



}