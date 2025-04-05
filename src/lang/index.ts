export * from './lexer';
export * from './rule-parser'
export * from './pattern-matcher';
export * from './pattern-matcher-with-conditions';
export * from './condition-evaluator';
export * from './ast-transformer';


import { PatternMatcherOptions } from '@/lang/pattern-matcher';
import { PatternMatcherWithConditions } from '@/lang/pattern-matcher-with-conditions';
import { ConditionEvaluator, ConditionEvaluatorOptions } from '@/lang/condition-evaluator';
import { BindingContext } from '@/lang/condition-evaluator';

/**
 * Creates a new pattern matcher with condition evaluation support.
 * This is the recommended way to create a pattern matcher for most use cases.
 * 
 * @param options Options for pattern matching behavior
 * @param evaluatorOptions Options for condition evaluation behavior
 * @returns A pattern matcher with condition evaluation support
 * 
 * @example
 * ```typescript
 * import { createPatternMatcher } from '@/lang';
 * 
 * const matcher = createPatternMatcher({
 *   caseSensitiveLabels: false
 * }, {
 *   enableTypeCoercion: true
 * });
 * 
 * const matches = matcher.findMatchingNodesWithCondition(
 *   graph,
 *   { labels: ['task'], properties: {} },
 *   { type: 'comparison', ... } // Condition
 * );
 * ```
 */
export function createPatternMatcher<NodeData = any, EdgeData = any>(
  options?: PatternMatcherOptions,
  evaluatorOptions?: ConditionEvaluatorOptions
): PatternMatcherWithConditions<NodeData, EdgeData> {
  return new PatternMatcherWithConditions<NodeData, EdgeData>(options, evaluatorOptions);
}

/**
 * Creates a binding context for variable bindings in condition evaluation.
 * 
 * @returns A new empty binding context
 * 
 * @example
 * ```typescript
 * import { createBindingContext } from '@/lang';
 * 
 * const bindings = createBindingContext();
 * bindings.set('node', myNode);
 * 
 * const result = evaluator.evaluateCondition(graph, condition, bindings);
 * ```
 */
export function createBindingContext<NodeData = any, EdgeData = any>(): BindingContext<NodeData, EdgeData> {
  return new BindingContext<NodeData, EdgeData>();
}

/**
 * Creates a condition evaluator for evaluating expressions.
 * 
 * @param options Options for condition evaluation behavior
 * @returns A new condition evaluator
 * 
 * @example
 * ```typescript
 * import { createConditionEvaluator } from '@/lang';
 * 
 * const evaluator = createConditionEvaluator({
 *   enableTypeCoercion: true
 * });
 * 
 * const result = evaluator.evaluateCondition(graph, condition, bindings);
 * ```
 */
export function createConditionEvaluator<NodeData = any, EdgeData = any>(
  options?: ConditionEvaluatorOptions
): ConditionEvaluator<NodeData, EdgeData> {
  return new ConditionEvaluator<NodeData, EdgeData>(options);
}
