// This file extends src/rules/pattern-matcher.ts with condition evaluation capabilities

import { Graph, Node, Edge, Path, NodeId } from '@/graph';
import { Expression, WhereClause, LogicalOperator, VariableExpression, PropertyExpression } from './rule-parser';
import { NodePattern, RelationshipPattern, PathPattern, PatternMatcher, PatternMatcherOptions } from './pattern-matcher';
import { BindingContext, ConditionEvaluatorOptions, ConditionEvaluator } from './condition-evaluator';

/**
 * Extension of the PatternMatcher to support condition evaluation
 */
export class PatternMatcherWithConditions<NodeData = any, EdgeData = any> extends PatternMatcher<NodeData, EdgeData> {
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
    this.conditionEvaluator = new ConditionEvaluator<NodeData, EdgeData>(evaluatorOptions);
    // Ensure the evaluator has a reference back to a pattern matcher (itself in this case)
    // This is crucial for evaluating EXISTS clauses within WHERE conditions during pushdown.
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
    bindings: BindingContext<NodeData, EdgeData> = new BindingContext()
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
    bindings: BindingContext<NodeData, EdgeData> = new BindingContext()
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
    bindings: BindingContext<NodeData, EdgeData> = new BindingContext()
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
   * Executes a MATCH-WHERE query using predicate pushdown.
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

    let singleVariablePredicates = new Map<string, Expression[]>();
    let multiVariablePredicates: Expression[] = [];

    // Analyze the WHERE clause if it exists
    if (whereClause?.condition) {
      const analysis = this.conditionEvaluator.analyzeWhereClause(whereClause.condition);
      singleVariablePredicates = analysis.singleVariablePredicates;
      multiVariablePredicates = analysis.multiVariablePredicates;
    }

    // Use the new pushdown path finding method
    const matchingPaths = this.findPathsWithPushdown(
      graph,
      pathPattern,
      singleVariablePredicates,
      multiVariablePredicates
    );

    // Convert final paths to binding contexts
    const results: Array<BindingContext<NodeData, EdgeData>> = [];
    for (const path of matchingPaths) {
      const bindings = new BindingContext<NodeData, EdgeData>();
      // Bind nodes and edges from the path
      if (pathPattern.start.variable) {
        bindings.set(pathPattern.start.variable, path.nodes[0]);
      }
      for (let i = 0; i < pathPattern.segments.length; i++) {
        const segment = pathPattern.segments[i];
        if (segment.relationship.variable && path.edges[i]) { // Check edge exists
          bindings.set(segment.relationship.variable, path.edges[i]);
        }
        if (segment.node.variable && path.nodes[i + 1]) { // Check node exists
          bindings.set(segment.node.variable, path.nodes[i + 1]);
        }
      }
      // Note: Multi-variable predicates that couldn't be fully evaluated during pushdown
      // might need a final check here if the analysis/pushdown wasn't exhaustive.
      // For now, assume pushdown handles most cases.
      results.push(bindings);
    }

    return results;
  }


  /**
   * Finds paths matching a pattern, applying predicates during traversal (pushdown).
   * @private
   */
  private findPathsWithPushdown(
    graph: Graph<NodeData, EdgeData>,
    pattern: PathPattern,
    singleVariablePredicates: Map<string, Expression[]>,
    multiVariablePredicates: Expression[]
  ): Array<Path<NodeData, EdgeData>> {

    const results: Array<Path<NodeData, EdgeData>> = [];
    if (!pattern || !pattern.start) return results;
    const segments = pattern.segments || [];

    // --- Initial Node Filtering ---
    const initialNodesRaw = super.findMatchingNodes(graph, pattern.start);
    const startVar = pattern.start.variable;
    const startPredicates = startVar ? singleVariablePredicates.get(startVar) : undefined;

    const initialNodesFiltered = initialNodesRaw.filter(node => {
      if (!startPredicates || startPredicates.length === 0) return true;
      const initialBindings = new BindingContext<NodeData, EdgeData>();
      if (startVar) initialBindings.set(startVar, node);
      return startPredicates.every(cond =>
        this.conditionEvaluator.evaluateCondition(graph, cond, initialBindings)
      );
    });

    if (segments.length === 0) {
      // If only a start node pattern, return filtered nodes as paths
      return initialNodesFiltered.map(node => ({ nodes: [node], edges: [] }));
    }

    // --- BFS Setup ---
    interface QueueState {
      currentNode: Node<NodeData>;
      currentPath: Path<NodeData, EdgeData>;
      currentBindings: BindingContext<NodeData, EdgeData>; // Include bindings
      segmentIdx: number;
      varHopCount: number;
      visitedInPath: Set<NodeId>;
    }

    const maxPathDepth = (this as any).options.maxPathDepth; // Access protected options
    const maxPathResults = (this as any).options.maxPathResults;

    for (const startNode of initialNodesFiltered) {
      // Initialize bindings for the start node
      const startBindings = new BindingContext<NodeData, EdgeData>();
      if (startVar) {
        startBindings.set(startVar, startNode);
      }

      const queue: QueueState[] = [{
        currentNode: startNode,
        currentPath: { nodes: [startNode], edges: [] },
        currentBindings: startBindings, // Start with initial bindings
        segmentIdx: 0,
        varHopCount: 0,
        visitedInPath: new Set([startNode.id]),
      }];
      let bfsIterations = 0;

      while (queue.length > 0 && results.length < maxPathResults) {
        if (++bfsIterations > 100000) break; // Safety break

        const currentState = queue.shift()!;
        const { currentNode, currentPath, currentBindings, segmentIdx, varHopCount, visitedInPath } = currentState;

        if (segmentIdx >= segments.length) continue;

        const currentSegment = segments[segmentIdx];
        const currentRelPattern = currentSegment.relationship;
        const targetNodePattern = currentSegment.node;

        const minHops = currentRelPattern.minHops ?? 1;
        const maxHopsSpecified = currentRelPattern.maxHops;
        const isVariable = !(minHops === 1 && maxHopsSpecified === 1);
        const maxHopsTraversal = maxHopsSpecified !== undefined
          ? Math.min(maxHopsSpecified, maxPathDepth)
          : maxPathDepth;

        if (currentPath.edges.length >= maxPathDepth) continue;

        const isFinalSegment = segmentIdx + 1 >= segments.length;

        const candidateEdges = (this as any).getCandidateEdges(graph, currentNode.id, currentRelPattern.direction); // Access private helper

        for (const edge of candidateEdges) {
          const neighborNode = (this as any).getNeighborNode(graph, currentNode.id, edge, currentRelPattern.direction); // Access private helper
          if (!neighborNode) continue;

          // --- Intrinsic Relationship Match ---
          if (!super.matchesRelationshipPattern(edge, currentRelPattern, currentNode, neighborNode)) {
            continue;
          }

          // --- Prepare Bindings for Evaluation ---
          const childBindings = currentBindings.createChildContext();
          const relVar = currentRelPattern.variable;
          const targetVar = targetNodePattern.variable;
          if (relVar) childBindings.set(relVar, edge);
          if (targetVar) childBindings.set(targetVar, neighborNode);

          // --- Relationship Predicate Check ---
          const relPredicates = relVar ? singleVariablePredicates.get(relVar) : undefined;
          if (relPredicates && !relPredicates.every(cond => this.conditionEvaluator.evaluateCondition(graph, cond, childBindings))) {
            continue; // Failed relationship predicate
          }

          // --- Intrinsic Node Match ---
          if (!super.matchesNodePattern(neighborNode, targetNodePattern)) {
            continue;
          }

          // --- Node Predicate Check ---
          const nodePredicates = targetVar ? singleVariablePredicates.get(targetVar) : undefined;
          if (nodePredicates && !nodePredicates.every(cond => this.conditionEvaluator.evaluateCondition(graph, cond, childBindings))) {
            continue; // Failed node predicate
          }

          // --- Multi-Variable Predicate Check ---
          let multiVarCheckPassed = true;
          for (const multiCond of multiVariablePredicates) {
            // Need getVariablesInExpression here or access it from evaluator
            const requiredVars = (this.conditionEvaluator as any).getVariablesInExpression(multiCond) as Set<string>;
            const canEvaluate = Array.from(requiredVars).every(v => childBindings.has(v));

            if (canEvaluate) {
              if (!this.conditionEvaluator.evaluateCondition(graph, multiCond, childBindings)) {
                multiVarCheckPassed = false;
                break; // Failed a multi-variable predicate
              }
            }
          }
          if (!multiVarCheckPassed) {
            continue;
          }

          // --- All intrinsic and predicate checks passed for this step ---
          const newHopCount = varHopCount + 1;
          const newPath: Path<NodeData, EdgeData> = {
            nodes: [...currentPath.nodes, neighborNode],
            edges: [...currentPath.edges, edge],
          };
          const newVisited = new Set(visitedInPath).add(neighborNode.id);
          const wouldCycle = visitedInPath.has(neighborNode.id);

          // --- Check 1: Complete Pattern ---
          if (isFinalSegment && newHopCount >= minHops) {
            if (results.length < maxPathResults) {
              results.push(newPath);
            }
            if (results.length >= maxPathResults) break;
            if (!isVariable) continue; // Fixed path ends here
          }

          // --- Check 2: Continue Variable Segment ---
          if (isVariable && newHopCount < maxHopsTraversal && !wouldCycle) {
            queue.push({
              currentNode: neighborNode,
              currentPath: newPath,
              currentBindings: childBindings, // Pass updated bindings
              segmentIdx: segmentIdx,
              varHopCount: newHopCount,
              visitedInPath: newVisited,
            });
          }

          // --- Check 3: Transition to Next Segment ---
          if (newHopCount >= minHops && !isFinalSegment && !wouldCycle) {
            queue.push({
              currentNode: neighborNode,
              currentPath: newPath,
              currentBindings: childBindings, // Pass updated bindings
              segmentIdx: segmentIdx + 1,
              varHopCount: 0,
              visitedInPath: newVisited,
            });
          }

          if (results.length >= maxPathResults) break; // Break edge loop
        } // End edge loop
        if (results.length >= maxPathResults) break; // Break BFS main loop
      } // End BFS while loop
    } // End initialNodes loop

    // Deduplication might still be useful depending on variable path complexity
    const uniquePathsMap = new Map<string, Path<NodeData, EdgeData>>();
    const pathToString = (p: Path<NodeData, EdgeData>) => {
      const nodeIds = p.nodes.map(n => n.id).join(',');
      const edgeIds = p.edges.map(e => `${e.source}-${e.label}-${e.target}`).join(',');
      return `${nodeIds}|${edgeIds}`;
    };
    for (const path of results) {
      const pathStr = pathToString(path);
      if (!uniquePathsMap.has(pathStr)) {
        uniquePathsMap.set(pathStr, path);
      }
    }
    return Array.from(uniquePathsMap.values());
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