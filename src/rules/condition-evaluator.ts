import { Graph, Node, Edge, Path } from '../graph/types';
import {
  Expression, LiteralExpression, VariableExpression, PropertyExpression,
  ComparisonExpression, LogicalExpression, ExistsExpression,
  ComparisonOperator, LogicalOperator, PathPattern
} from './types';
import { PatternMatcher, PatternMatcherImpl } from './pattern-matcher';

/**
 * Interface for a binding context that maps variable names to graph elements
 */
export interface BindingContext<NodeData = any, EdgeData = any> {
  /**
   * Get a bound value by variable name
   * @param name The variable name
   * @returns The bound node, edge, or value
   */
  get(name: string): Node<NodeData> | Edge<EdgeData> | any | undefined;

  /**
   * Set a bound value by variable name
   * @param name The variable name
   * @param value The node, edge, or value to bind
   */
  set(name: string, value: Node<NodeData> | Edge<EdgeData> | any): void;

  /**
   * Check if a variable name is bound
   * @param name The variable name
   * @returns True if the variable is bound
   */
  has(name: string): boolean;

  /**
   * Create a child binding context that inherits from this one
   * @returns A new binding context with this one as parent
   */
  createChildContext(): BindingContext<NodeData, EdgeData>;
}

/**
 * Interface for evaluating expressions in the context of a graph
 */
export interface ConditionEvaluator<NodeData = any, EdgeData = any> {
  /**
   * Evaluate an expression in the context of a graph and binding context
   * @param graph The graph to evaluate against
   * @param expression The expression to evaluate
   * @param bindings Optional binding context for variables
   * @returns The result of the expression evaluation
   */
  evaluateExpression(
    graph: Graph<NodeData, EdgeData>,
    expression: Expression,
    bindings?: BindingContext<NodeData, EdgeData>
  ): any;

  /**
   * Evaluate a complete condition (typically a WHERE clause) in the context of a graph
   * @param graph The graph to evaluate against
   * @param condition The condition expression to evaluate
   * @param bindings Optional binding context for variables
   * @returns True if the condition is satisfied, false otherwise
   */
  evaluateCondition(
    graph: Graph<NodeData, EdgeData>,
    condition: Expression,
    bindings?: BindingContext<NodeData, EdgeData>
  ): boolean;

  /**
   * Evaluate a property access expression
   * @param expression The property expression to evaluate
   * @param bindings The binding context for variables
   * @returns The value of the property, or undefined if not found
   */
  evaluatePropertyExpression(
    expression: PropertyExpression,
    bindings: BindingContext<NodeData, EdgeData>
  ): any;

  /**
   * Evaluate a comparison expression
   * @param left The left side value
   * @param operator The comparison operator
   * @param right The right side value
   * @param options Optional comparison options
   * @returns The result of the comparison
   */
  evaluateComparison(
    left: any,
    operator: ComparisonOperator,
    right: any,
    options?: { enableTypeCoercion?: boolean }
  ): boolean;

  /**
   * Check if a pattern exists in the graph
   * @param graph The graph to check
   * @param expression The existence expression to evaluate
   * @param bindings The binding context for variables
   * @returns True if the pattern exists (or doesn't exist for negative checks)
   */
  evaluateExistsExpression(
    graph: Graph<NodeData, EdgeData>,
    expression: ExistsExpression,
    bindings: BindingContext<NodeData, EdgeData>
  ): boolean;

  /**
   * Set the pattern matcher to use for pattern matching operations
   * @param patternMatcher The pattern matcher implementation to use
   */
  setPatternMatcher(patternMatcher: PatternMatcher<NodeData, EdgeData>): void;
}

/**
 * Options for configuring the condition evaluator
 */
export interface ConditionEvaluatorOptions {
  /**
   * Whether to enable type coercion in comparisons (e.g., string "42" matches number 42)
   * @default false
   */
  enableTypeCoercion?: boolean;

  /**
   * Whether to allow null values to propagate in comparisons (instead of converting to false)
   * @default false
   */
  nullAwareComparisons?: boolean;

  /**
   * Maximum depth for pattern matching in EXISTS checks
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
 * Implementation of the BindingContext interface that manages variable bindings
 */
export class BindingContextImpl<NodeData = any, EdgeData = any> implements BindingContext<NodeData, EdgeData> {
  private bindings: Map<string, any>;
  private parent: BindingContextImpl<NodeData, EdgeData> | null;

  /**
   * Creates a new binding context
   * @param parent Optional parent context to inherit bindings from
   */
  constructor(parent: BindingContextImpl<NodeData, EdgeData> | null = null) {
    this.bindings = new Map<string, any>();
    this.parent = parent;
  }

  /**
   * Get a bound value by variable name
   * @param name The variable name
   * @returns The bound node, edge, or value
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
   * @param name The variable name
   * @param value The node, edge, or value to bind
   */
  set(name: string, value: Node<NodeData> | Edge<EdgeData> | any): void {
    this.bindings.set(name, value);
  }

  /**
   * Check if a variable name is bound
   * @param name The variable name
   * @returns True if the variable is bound
   */
  has(name: string): boolean {
    return this.bindings.has(name) || (this.parent ? this.parent.has(name) : false);
  }

  /**
   * Create a child binding context that inherits from this one
   * @returns A new binding context with this one as parent
   */
  createChildContext(): BindingContext<NodeData, EdgeData> {
    return new BindingContextImpl<NodeData, EdgeData>(this);
  }
}

/**
 * Implementation of the ConditionEvaluator interface
 */
export class ConditionEvaluatorImpl<NodeData = any, EdgeData = any> implements ConditionEvaluator<NodeData, EdgeData> {
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
    this.patternMatcher = new PatternMatcherImpl<NodeData, EdgeData>();
  }

  /**
   * Set the pattern matcher to use for pattern matching operations
   * @param patternMatcher The pattern matcher implementation to use
   */
  setPatternMatcher(patternMatcher: PatternMatcher<NodeData, EdgeData>): void {
    this.patternMatcher = patternMatcher;
  }

  /**
   * Evaluate an expression in the context of a graph and binding context
   * @param graph The graph to evaluate against
   * @param expression The expression to evaluate
   * @param bindings Optional binding context for variables
   * @returns The result of the expression evaluation
   */
  evaluateExpression(
    graph: Graph<NodeData, EdgeData>,
    expression: Expression,
    bindings: BindingContext<NodeData, EdgeData> = new BindingContextImpl()
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
   * Evaluate a complete condition in the context of a graph
   * @param graph The graph to evaluate against
   * @param condition The condition expression to evaluate
   * @param bindings Optional binding context for variables
   * @returns True if the condition is satisfied, false otherwise
   */
  evaluateCondition(
    graph: Graph<NodeData, EdgeData>,
    condition: Expression,
    bindings: BindingContext<NodeData, EdgeData> = new BindingContextImpl()
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
   * Evaluate a property access expression
   * @param expression The property expression to evaluate
   * @param bindings The binding context for variables
   * @returns The value of the property, or undefined if not found
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
   * Evaluate a comparison between two values
   * @param left The left side value
   * @param operator The comparison operator
   * @param right The right side value
   * @returns The result of the comparison
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
   * Evaluate an EXISTS expression
   * @param graph The graph to evaluate against
   * @param expression The EXISTS expression to evaluate
   * @param bindings The binding context for variables
   * @returns True if the pattern exists (or doesn't exist for negative checks)
   */
  evaluateExistsExpression(
    graph: Graph<NodeData, EdgeData>,
    expression: ExistsExpression,
    bindings: BindingContext<NodeData, EdgeData>
  ): boolean {
    // Find matching paths using the pattern matcher
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
}