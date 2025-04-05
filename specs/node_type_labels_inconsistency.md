 Refactoring Plan: Migrate from type to labels Model

  Overview

  This plan details how to refactor the codebase to use a consistent multi-label approach, removing the type property and relying solely on the labels array property
  for node classification.

  1. Core Data Model Changes

  Graph Module

  - Update graph.ts to ensure addNode uses only labels instead of type
  - For backwards compatibility, add a private helper method to migrate any nodes with a type property to a labels array during a transition period
  - Update any methods that directly reference node.data.type

  Pattern Matcher

  - Simplify getNodeLabels in pattern-matcher.ts to only check for labels array
  - Update any methods that use type directly in pattern matching

  2. Node Creation Changes

  CREATE Actions

  - Modify create-node-action.ts to only set labels array, removing the type property
  - Update validation to ensure labels are properly validated

  Testing Framework

  - Update test data initialization to use labels instead of type in all test files
  - Update assertions to check for labels.includes('x') rather than type === 'x'

  3. Query Execution Changes

  Rule Engine

  - Audit rule-engine.ts for any type-based node filtering
  - Update result formatting to handle labels consistently

  Query Formatter

  - Update query-formatter.ts to format node representations using labels array

  4. Files to Modify

  1. Core Graph Implementation:
    - /src/graph/graph.ts
  2. Pattern Matching:
    - /src/lang/pattern-matcher.ts
    - /src/lang/pattern-matcher-with-conditions.ts
  3. Node Creation:
    - /src/rules/create-node-action.ts
  4. Query Execution and Results:
    - /src/rules/rule-engine.ts
    - /src/rules/query-formatter.ts
    - /src/rules/query-utils.ts
  5. Test Files:
    - /Users/thomas/code/research-assistant/cannonball-ts/__test__/end-to-end.test.ts
    - All other test files that initialize nodes with type

  5. Detailed Changes Required

  In graph.ts:

  // Before
  graph.addNode('alice', { type: 'person', name: 'Alice', age: 30 });

  // After
  graph.addNode('alice', { labels: ['person'], name: 'Alice', age: 30 });

  In pattern-matcher.ts:

  // Before
  private getNodeLabels(node: Node<NodeData>): string[] {
    if (node.data && typeof node.data === 'object' && node.data !== null) {
      const data = node.data as Record<string, any>;
      if (data.type) { // Handle single type property
        return Array.isArray(data.type) ? data.type : [data.type];
      }
      if (data.labels && Array.isArray(data.labels)) { // Handle labels array
        return data.labels;
      }
    }
    return [];
  }

  // After
  private getNodeLabels(node: Node<NodeData>): string[] {
    if (node.data && typeof node.data === 'object' && node.data !== null) {
      const data = node.data as Record<string, any>;
      if (data.labels && Array.isArray(data.labels)) {
        return data.labels;
      }
    }
    return [];
  }

  In create-node-action.ts:

  // Before
  const nodeData = {
    ...this.properties,
    labels: this.labels,
    type: this.labels.length > 0 ? this.labels[0] : undefined
  } as NodeData;

  // After
  const nodeData = {
    ...this.properties,
    labels: this.labels
  } as NodeData;

  In test files:

  // Before
  // Add nodes with different types
  graph.addNode('alice', { type: 'person', name: 'Alice', age: 30 });
  // Verify
  const nodes = graph.getAllNodes().filter(n => n.data.type === 'project');

  // After
  // Add nodes with different labels
  graph.addNode('alice', { labels: ['person'], name: 'Alice', age: 30 });
  // Verify
  const nodes = graph.getAllNodes().filter(n => n.data.labels?.includes('project'));

  6. Migration Strategy

  1. Phase 1: Initial Code Audit
    - Scan codebase for all uses of data.type
    - Create a comprehensive list of changes needed
  2. Phase 2: Test Updates
    - Update all test data creation and assertions
    - This will expose areas where type is used in the implementation
  3. Phase 3: Core Implementation Updates
    - Update core graph implementation
    - Update pattern matcher and query logic
    - Update node creation action
  4. Phase 4: Run Tests
    - Run the test suite to identify any remaining issues
    - Fix any failing tests
  5. Phase 5: Transition Code (Optional)
    - If needed, add temporary compatibility code to handle both formats
    - This would help if immediate backward compatibility is needed

  7. Documentation Updates

  - Update documentation to reflect the new multi-label approach
  - Create examples showing how to use multiple labels
  - Document the query patterns for label-based operations

  8. Potential Gotchas

  1. Performance Impacts:
    - Array operations (includes) are slower than direct property access
    - Consider optimizations for frequent label checking
  2. JSON Serialization:
    - Ensure serialization/deserialization properly handles label arrays
  3. Type Inference:
    - TypeScript types may need updating to reflect the new data structure

  By executing this refactoring plan, we'll achieve a more consistent data model that aligns with the Cypher-style query language, allowing for more flexible node
  classification through multiple labels.


  -------------------------------




Refactoring Plan: Migrate from labels to Single type Model

  Overview

  This plan details how to refactor the codebase to use a consistent single-type approach, removing the labels array property and relying solely on a single type
  property for node classification.

  1. Core Data Model Changes

  Graph Module

  - Ensure graph.ts methods uniformly use type for node classification
  - Remove any code handling labels arrays and simplify to use type string property
  - Add validation to ensure only a single type is assigned to each node

  Pattern Matcher

  - Simplify getNodeLabels in pattern-matcher.ts to extract the single type property
  - Rename getNodeLabels to getNodeType for clarity (or create a new method)
  - Update Cypher parsing to map the first label in query syntax to a type property

  2. Node Creation Changes

  CREATE Actions

  - Modify create-node-action.ts to only set the type property, using the first label from the query
  - Update validation to check that exactly one label is provided, or provide reasonable warnings/errors

  Testing Framework

  - Update test data initialization to use only type instead of labels in all test files
  - Update assertions to check for type === 'x' rather than label inclusion tests

  3. Query Execution Changes

  Rule Engine

  - Update Cypher query parsing to treat labels in queries as type constraints
  - Modify matcher to handle multiple labels in query syntax but map to single type

  Query Formatter

  - Update query-formatter.ts to format node representations using the single type

  4. Files to Modify

  1. Core Graph Implementation:
    - /src/graph/graph.ts
  2. Parsing and Pattern Matching:
    - /src/lang/rule-parser.ts - Update to extract first label as type
    - /src/lang/pattern-matcher.ts - Simplify type extraction
    - /src/lang/pattern-matcher-with-conditions.ts
  3. Node Creation:
    - /src/rules/create-node-action.ts - Set only type property
  4. Query Execution and Results:
    - /src/rules/rule-engine.ts
    - /src/rules/query-formatter.ts
    - /src/rules/query-utils.ts
  5. Test Files:
    - /Users/thomas/code/research-assistant/cannonball-ts/__test__/end-to-end.test.ts
    - All other test files that initialize nodes with labels

  5. Detailed Changes Required

  In graph.ts:

  // Before
  graph.addNode('alice', { labels: ['person'], name: 'Alice', age: 30 });

  // After
  graph.addNode('alice', { type: 'person', name: 'Alice', age: 30 });

  In pattern-matcher.ts:

  // Before
  private getNodeLabels(node: Node<NodeData>): string[] {
    if (node.data && typeof node.data === 'object' && node.data !== null) {
      const data = node.data as Record<string, any>;
      if (data.type) {
        return Array.isArray(data.type) ? data.type : [data.type];
      }
      if (data.labels && Array.isArray(data.labels)) {
        return data.labels;
      }
    }
    return [];
  }

  // After
  private getNodeType(node: Node<NodeData>): string | undefined {
    if (node.data && typeof node.data === 'object' && node.data !== null) {
      const data = node.data as Record<string, any>;
      return data.type as string | undefined;
    }
    return undefined;
  }

  // Keep getNodeLabels for compatibility but have it return a single-element array
  private getNodeLabels(node: Node<NodeData>): string[] {
    const type = this.getNodeType(node);
    return type ? [type] : [];
  }

  private labelMatches(nodeTypes: string[], requiredLabel: string): boolean {
    // Simplified to just check if the node type matches the required label
    return nodeTypes.includes(requiredLabel);
  }

  In rule-parser.ts (for parsing Cypher queries):

  // Before - storing all labels
  const node: NodePattern = {
    variable: variableName,
    labels: labels,
    properties: properties
  };

  // After - storing only the first label as type
  const node: NodePattern = {
    variable: variableName,
    labels: labels.length > 0 ? [labels[0]] : [], // Keep labels array with 0-1 elements
    properties: properties
  };

  In create-node-action.ts:

  // Before
  const nodeData = {
    ...this.properties,
    labels: this.labels
  } as NodeData;

  // After
  const nodeData = {
    ...this.properties,
    type: this.labels.length > 0 ? this.labels[0] : undefined
  } as NodeData;

  In test files:

  // Before
  graph.addNode('alice', { labels: ['person'], name: 'Alice', age: 30 });
  const nodes = graph.getAllNodes().filter(n => n.data.labels?.includes('project'));

  // After
  graph.addNode('alice', { type: 'person', name: 'Alice', age: 30 });
  const nodes = graph.getAllNodes().filter(n => n.data.type === 'project');

  6. Handling Multiple Labels in Cypher Syntax

  Since Cypher syntax allows for multiple labels like (n:Person:Employee), we need to decide how to handle this:

  1. Option 1: First Label Only
    - Use only the first label as the node type
    - Warn or error when multiple labels are provided in query
  2. Option 2: Compound Type Name
    - Join multiple labels with a delimiter to form a single type
    - Example: (n:Person:Employee) → type: 'Person_Employee'
  3. Option 3: Validation Rules
    - Enforce that only a single label can be used in queries
    - Provide clear error messages for multi-label queries

  7. Migration Strategy

  1. Phase 1: Initial Code Audit
    - Scan codebase for all uses of labels arrays
    - Create a comprehensive list of changes needed
  2. Phase 2: Update NodePattern Interface
    - Consider whether to keep the labels array in interfaces for compatibility
    - If keeping, ensure it always has 0-1 elements
  3. Phase 3: Core Implementation Updates
    - Update core graph implementation
    - Update pattern matcher to extract and use single type
    - Update node creation action
  4. Phase 4: Query Parsing
    - Update parser to handle the selected multiple-label strategy
    - Add appropriate warnings or errors for multi-label queries
  5. Phase 5: Test Updates
    - Update all test data creation and assertions
    - Run the test suite to identify any remaining issues

  8. Documentation Updates

  - Update documentation to reflect the single-type model
  - Clearly document how multi-label queries are handled
  - Provide migration examples for users of the library

  9. Potential Gotchas

  1. Cypher Compatibility:
    - Divergence from standard Cypher, which supports multiple labels
    - May confuse users familiar with Neo4j and similar graph databases
  2. Query Flexibility:
    - Loss of ability to categorize nodes in multiple ways simultaneously
    - May require more complex query patterns for some use cases
  3. Implicit Schema Enforcement:
    - Single-type model enforces a more strict schema
    - May require additional properties for complex categorization

  By executing this refactoring plan, we'll achieve a more classical object-oriented data model with clear node types, which may be simpler for certain applications
  but less flexible than the multi-label approach.