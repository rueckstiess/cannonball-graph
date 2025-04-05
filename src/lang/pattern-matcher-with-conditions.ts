// This file extends src/rules/pattern-matcher.ts with condition evaluation capabilities

import { Graph, Node, Edge, Path } from '@/graph';
import { Expression, WhereClause } from './rule-parser';
import { NodePattern, RelationshipPattern, PathPattern, PatternMatcherImpl, PatternMatcherOptions } from './pattern-matcher';
import { ConditionEvaluator, BindingContext, ConditionEvaluatorOptions } from './condition-evaluator';
import { ConditionEvaluatorImpl, BindingContextImpl } from './condition-evaluator';

/**
 * Extension of the PatternMatcherImpl to support condition evaluation
 */
export class PatternMatcherWithConditions<NodeData = any, EdgeData = any> extends PatternMatcherImpl<NodeData, EdgeData> {
  private conditionEvaluator: ConditionEvaluator<NodeData, EdgeData>;

  /**
   * Creates a new pattern matcher with condition evaluation support
   * @param options Pattern matcher options
   * @param evaluatorOptions Condition evaluator options
   */
  constructor(
    options: PatternMatcherOptions = {},
    evaluatorOptions: ConditionEvaluatorOptions = {}
  ) {
    super(options);
    this.conditionEvaluator = new ConditionEvaluatorImpl<NodeData, EdgeData>(evaluatorOptions);
    this.conditionEvaluator.setPatternMatcher(this);
  }

  /**
   * Finds nodes that match a pattern and satisfy a condition
   * @param graph The graph to search
   * @param pattern The node pattern to match
   * @param condition Optional condition to filter matches
   * @param bindings Optional binding context for variables
   * @returns Array of matching nodes
   */
  findMatchingNodesWithCondition(
    graph: Graph<NodeData, EdgeData>,
    pattern: NodePattern,
    condition?: Expression,
    bindings: BindingContext<NodeData, EdgeData> = new BindingContextImpl()
  ): Node<NodeData>[] {
    // Find all nodes matching the pattern
    const matchingNodes = super.findMatchingNodes(graph, pattern);

    // If no condition, return all matches
    if (!condition) {
      return matchingNodes;
    }

    // Filter nodes by condition
    return matchingNodes.filter(node => {
      // Create a child binding context for each node
      const nodeBindings = bindings.createChildContext();

      // Bind the node to the pattern's variable if specified
      if (pattern.variable) {
        nodeBindings.set(pattern.variable, node);
      }

      // Evaluate the condition
      return this.conditionEvaluator.evaluateCondition(graph, condition, nodeBindings);
    });
  }

  /**
   * Finds relationships that match a pattern and satisfy a condition
   * @param graph The graph to search
   * @param pattern The relationship pattern to match
   * @param condition Optional condition to filter matches
   * @param sourceId Optional source node ID to filter relationships
   * @param bindings Optional binding context for variables
   * @returns Array of matching relationships
   */
  findMatchingRelationshipsWithCondition(
    graph: Graph<NodeData, EdgeData>,
    pattern: RelationshipPattern,
    condition?: Expression,
    sourceId?: string,
    bindings: BindingContext<NodeData, EdgeData> = new BindingContextImpl()
  ): Edge<EdgeData>[] {
    // Find all relationships matching the pattern
    const matchingRelationships = super.findMatchingRelationships(graph, pattern, sourceId);

    // If no condition, return all matches
    if (!condition) {
      return matchingRelationships;
    }

    // Filter relationships by condition
    return matchingRelationships.filter(edge => {
      // Create a child binding context for each relationship
      const edgeBindings = bindings.createChildContext();

      // Bind the relationship to the pattern's variable if specified
      if (pattern.variable) {
        edgeBindings.set(pattern.variable, edge);
      }

      // Bind source and target nodes if available
      const sourceNode = graph.getNode(edge.source);
      const targetNode = graph.getNode(edge.target);

      if (sourceNode) {
        edgeBindings.set('source', sourceNode);
      }

      if (targetNode) {
        edgeBindings.set('target', targetNode);
      }

      // Evaluate the condition
      return this.conditionEvaluator.evaluateCondition(graph, condition, edgeBindings);
    });
  }

  /**
   * Finds paths that match a pattern and satisfy a condition
   * @param graph The graph to search
   * @param pattern The path pattern to match
   * @param condition Optional condition to filter matches
   * @param bindings Optional binding context for variables
   * @returns Array of matching paths
   */
  findMatchingPathsWithCondition(
    graph: Graph<NodeData, EdgeData>,
    pattern: PathPattern,
    condition?: Expression,
    bindings: BindingContext<NodeData, EdgeData> = new BindingContextImpl()
  ): Array<Path<NodeData, EdgeData>> {
    // Find all paths matching the pattern
    const matchingPaths = super.findMatchingPaths(graph, pattern);

    // If no condition, return all matches
    if (!condition) {
      return matchingPaths;
    }

    // Filter paths by condition
    return matchingPaths.filter(path => {
      // Create a child binding context for each path
      const pathBindings = bindings.createChildContext();

      // Bind all nodes and relationships in the path
      if (pattern.start.variable) {
        pathBindings.set(pattern.start.variable, path.nodes[0]);
      }

      for (let i = 0; i < pattern.segments.length; i++) {
        const segment = pattern.segments[i];

        if (segment.relationship.variable) {
          pathBindings.set(segment.relationship.variable, path.edges[i]);
        }

        if (segment.node.variable) {
          pathBindings.set(segment.node.variable, path.nodes[i + 1]);
        }
      }

      // Evaluate the condition
      return this.conditionEvaluator.evaluateCondition(graph, condition, pathBindings);
    });
  }

  /**
   * Executes a MATCH-WHERE query
   * @param graph The graph to query
   * @param pathPattern The path pattern to match
   * @param whereClause Optional WHERE clause to filter matches
   * @returns Array of binding contexts representing matches
   */
  executeMatchQuery(
    graph: Graph<NodeData, EdgeData>,
    pathPattern: PathPattern,
    whereClause?: WhereClause
  ): Array<BindingContext<NodeData, EdgeData>> {
    // Find matching paths
    const matchingPaths = super.findMatchingPaths(graph, pathPattern);

    // Convert paths to binding contexts
    const results: Array<BindingContext<NodeData, EdgeData>> = [];

    for (const path of matchingPaths) {
      // Create a binding context for this match
      const bindings = new BindingContextImpl<NodeData, EdgeData>();

      // Bind all nodes and relationships in the path
      if (pathPattern.start.variable) {
        bindings.set(pathPattern.start.variable, path.nodes[0]);
      }

      for (let i = 0; i < pathPattern.segments.length; i++) {
        const segment = pathPattern.segments[i];

        if (segment.relationship.variable) {
          bindings.set(segment.relationship.variable, path.edges[i]);
        }

        if (segment.node.variable) {
          bindings.set(segment.node.variable, path.nodes[i + 1]);
        }
      }

      // If there's a WHERE clause, evaluate it
      if (whereClause) {
        if (this.conditionEvaluator.evaluateCondition(graph, whereClause.condition, bindings)) {
          results.push(bindings);
        }
      } else {
        results.push(bindings);
      }
    }

    return results;
  }

  /**
   * Access the condition evaluator
   * @returns The condition evaluator instance
   */
  getConditionEvaluator(): ConditionEvaluator<NodeData, EdgeData> {
    return this.conditionEvaluator;
  }

  /**
   * Set a custom condition evaluator
   * @param evaluator The condition evaluator to use
   */
  setConditionEvaluator(evaluator: ConditionEvaluator<NodeData, EdgeData>): void {
    this.conditionEvaluator = evaluator;
    this.conditionEvaluator.setPatternMatcher(this);
  }
}