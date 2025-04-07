// This file extends src/query/pattern-matcher.ts with condition evaluation capabilities

import { Graph, Node, Path, NodeId } from '@/graph';
import { Expression, WhereClause } from './parser';
import { PathPattern, PatternMatcher, PatternMatcherOptions } from './pattern-matcher';
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
   * Executes a MATCH-WHERE query using predicate pushdown.
   * Handles both single and multiple comma-separated patterns in MATCH.
   * @param graph The graph to query
   * @param pathPatterns Array of path patterns from the MATCH clause
   * @param whereClause Optional WHERE clause to filter matches
   * @returns Array of binding contexts representing matches
   * @throws Error if WHERE clause uses variables not defined in MATCH
   */
  executeMatchQuery(
    graph: Graph<NodeData, EdgeData>,
    pathPatterns: PathPattern[], // Changed to accept array
    whereClause?: WhereClause
  ): Array<BindingContext<NodeData, EdgeData>> {

    if (!pathPatterns || pathPatterns.length === 0) {
      return [];
    }

    let singleVariablePredicates = new Map<string, Expression[]>();
    let multiVariablePredicates: Expression[] = [];

    // Analyze the WHERE clause if it exists
    if (whereClause?.condition) {
      const analysis = this.conditionEvaluator.analyzeWhereClause(whereClause.condition);
      singleVariablePredicates = analysis.singleVariablePredicates;
      multiVariablePredicates = analysis.multiVariablePredicates;

      // --- Start Validation Step ---
      // 1. Collect variables defined in MATCH patterns
      const matchVariables = new Set<string>();
      for (const pattern of pathPatterns) {
        const patternVars = this.getVariablesInPattern(pattern);
        patternVars.forEach(v => matchVariables.add(v));
      }

      // 2. Collect variables used in WHERE clause
      const whereVariables = new Set<string>();
      singleVariablePredicates.forEach((_, varName) => whereVariables.add(varName));
      for (const multiCond of multiVariablePredicates) {
        // Access private method via 'any' cast or make it public/protected if preferred
        const condVars = (this.conditionEvaluator as any).getVariablesInExpression(multiCond) as Set<string>;
        condVars.forEach(v => whereVariables.add(v));
      }

      // 3. Check for unbound variables
      for (const whereVar of whereVariables) {
        if (!matchVariables.has(whereVar)) {
          // Throw an error if a WHERE variable is not bound by MATCH
          throw new Error(`Variable '${whereVar}' used in WHERE clause is not defined in MATCH clause.`);
        }
      }
      // --- End Validation Step ---
    }

    // --- Handle Single Pattern Case (Optimization) ---
    if (pathPatterns.length === 1) {
      const pattern = pathPatterns[0];
      const matchingPaths = this.findPathsWithPushdown(
        graph,
        pattern,
        singleVariablePredicates, // Pass all predicates
        multiVariablePredicates
      );
      return this.convertPathsToBindings(matchingPaths, pattern);
    }

    // --- Handle Multiple Comma-Separated Patterns ---
    const patternResults: Array<BindingContext<NodeData, EdgeData>[]> = [];

    for (const pattern of pathPatterns) {
      // 1. Find variables defined in this specific pattern
      const patternVars = this.getVariablesInPattern(pattern);

      // 2. Extract single-variable predicates relevant ONLY to this pattern
      const relevantSinglePredicates = new Map<string, Expression[]>();
      for (const varName of patternVars) {
        if (singleVariablePredicates.has(varName)) {
          relevantSinglePredicates.set(varName, singleVariablePredicates.get(varName)!);
        }
      }

      // 3. Find paths/bindings for this pattern using only its relevant predicates
      //    Multi-variable predicates are ignored here; they are applied after combining.
      const matchingPaths = this.findPathsWithPushdown(
        graph,
        pattern,
        relevantSinglePredicates,
        [] // Pass empty multi-variable predicates here
      );

      // 4. Convert paths to bindings for this pattern
      const patternBindings = this.convertPathsToBindings(matchingPaths, pattern);
      if (patternBindings.length === 0) {
        // If any pattern yields zero results, the overall result is empty
        return [];
      }
      patternResults.push(patternBindings);
    }

    // 5. Compute Cartesian product (cross product) of the binding lists
    let combinedBindings = this.computeCartesianProduct(patternResults);

    // 6. Apply multi-variable predicates to the combined results
    if (multiVariablePredicates.length > 0) {
      combinedBindings = combinedBindings.filter(combinedBinding => {
        return multiVariablePredicates.every(multiCond =>
          this.conditionEvaluator.evaluateCondition(graph, multiCond, combinedBinding)
        );
      });
    }

    return combinedBindings;
  }

  /*...*/
  /**
   * Helper to convert paths found for a pattern into binding contexts.
   * @private
   */
  private convertPathsToBindings(
    paths: Array<Path<NodeData, EdgeData>>,
    pattern: PathPattern
  ): Array<BindingContext<NodeData, EdgeData>> {
    const results: Array<BindingContext<NodeData, EdgeData>> = [];
    for (const path of paths) {
      const bindings = new BindingContext<NodeData, EdgeData>();

      // Bind start node variable
      if (pattern.start.variable && path.nodes.length > 0) {
        bindings.set(pattern.start.variable, path.nodes[0]);
      }

      let currentPathEdgeIndex = 0;
      let currentPathNodeIndex = 1; // Start node is index 0

      // Iterate through the segments defined in the PATTERN
      for (let segIdx = 0; segIdx < pattern.segments.length; segIdx++) {
        const segment = pattern.segments[segIdx];
        const relPattern = segment.relationship;
        const nodePattern = segment.node;

        // Determine if this segment represents a variable-length path
        const isVariableLength = !((relPattern.minHops ?? 1) === 1 && (relPattern.maxHops ?? 1) === 1);

        if (!isVariableLength) {
          // --- Fixed Length Segment (1 hop) ---
          // Bind relationship variable if defined and path has the edge
          if (relPattern.variable && currentPathEdgeIndex < path.edges.length) {
            bindings.set(relPattern.variable, path.edges[currentPathEdgeIndex]);
          }
          // Bind node variable if defined and path has the node
          if (nodePattern.variable && currentPathNodeIndex < path.nodes.length) {
            bindings.set(nodePattern.variable, path.nodes[currentPathNodeIndex]);
          }
          // Advance path indices for the next segment
          currentPathEdgeIndex++;
          currentPathNodeIndex++;
        } else {
          // --- Variable Length Segment ---
          // This segment consumes the remaining edges/nodes in the path
          const edgesInVarSegment = path.edges.slice(currentPathEdgeIndex);
          const finalNodeInPath = path.nodes[path.nodes.length - 1];

          // Bind relationship variable (as an array) if defined
          if (relPattern.variable && edgesInVarSegment.length > 0) {
            bindings.set(relPattern.variable, edgesInVarSegment);
          }

          // Bind the node variable to the *last* node of the entire path
          if (nodePattern.variable && finalNodeInPath) {
            bindings.set(nodePattern.variable, finalNodeInPath);
          }

          // Since this variable segment consumes the rest, update indices to the end
          currentPathEdgeIndex = path.edges.length;
          currentPathNodeIndex = path.nodes.length;

          // Only one variable-length segment is supported per pattern for simplicity.
          // If multiple were allowed, more complex index tracking would be needed.
          break; // Stop processing pattern segments after the variable one
        }
      }
      results.push(bindings);
    }
    return results;
  }


  /**
   * Helper to get all variable names defined within a path pattern.
   * @private
   */
  private getVariablesInPattern(pattern: PathPattern): Set<string> {
    const variables = new Set<string>();
    if (pattern.start.variable) {
      variables.add(pattern.start.variable);
    }
    for (const segment of pattern.segments) {
      if (segment.relationship.variable) {
        variables.add(segment.relationship.variable);
      }
      if (segment.node.variable) {
        variables.add(segment.node.variable);
      }
    }
    return variables;
  }

  /**
   * Helper to compute the Cartesian product of multiple binding context lists.
   * @private
   */
  private computeCartesianProduct(
    bindingsLists: Array<BindingContext<NodeData, EdgeData>[]>
  ): Array<BindingContext<NodeData, EdgeData>> {
    if (!bindingsLists || bindingsLists.length === 0) {
      return [];
    }

    return bindingsLists.reduce(
      (accumulator, currentList) => {
        const newAccumulator: Array<BindingContext<NodeData, EdgeData>> = [];
        for (const accBinding of accumulator) {
          for (const currentBinding of currentList) {
            // Combine bindings: Create a new context and merge properties
            const combined = new BindingContext<NodeData, EdgeData>();
            // Copy from accumulator binding
            for (const varName of accBinding.getVariableNames()) {
              combined.set(varName, accBinding.get(varName));
            }
            // Copy from current binding (potentially overwriting is okay if vars are unique per pattern)
            for (const varName of currentBinding.getVariableNames()) {
              combined.set(varName, currentBinding.get(varName));
            }
            newAccumulator.push(combined);
          }
        }
        return newAccumulator;
      },
      [new BindingContext<NodeData, EdgeData>()] // Start with one empty binding context
    );
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

          // --- Check for Cycle ---
          if (visitedInPath.has(neighborNode.id)) {
            // don't allow reusing the node in the same path
            continue;
          }

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