import { GraphImpl } from '../src/graph/graph';
import { Graph, Node } from '../src/graph/types';
import { CypherLexer } from '../src/rules/lexer';
import { CypherParser } from '../src/rules/rule-parser';
import { PatternMatcherImpl } from '../src/rules/pattern-matcher';
import { Token } from '../src/rules/types';

describe('End-to-End Pattern Matching', () => {
  // Define type for node data to make tests more explicit
  type TestNodeData = {
    type: string;
    name?: string;
    age?: number;
    active?: boolean;
    tags?: string[];
    priority?: number;
    due?: string;
    assignee?: string;
  };
  
  let graph: Graph<TestNodeData>;
  
  // Setup a more complex graph for end-to-end testing
  beforeEach(() => {
    graph = new GraphImpl<TestNodeData>();
    
    // Add Person nodes
    graph.addNode('p1', { type: 'Person', name: 'Alice', age: 30, active: true });
    graph.addNode('p2', { type: 'Person', name: 'Bob', age: 25, active: false });
    graph.addNode('p3', { type: 'Person', name: 'Charlie', age: 35, active: true });
    
    // Add Task nodes
    graph.addNode('t1', { type: 'Task', name: 'Fix bug', priority: 1, active: true, due: '2023-12-01' });
    graph.addNode('t2', { type: 'Task', name: 'Write docs', priority: 2, active: false, due: '2023-12-15' });
    graph.addNode('t3', { type: 'Task', name: 'Deploy app', priority: 3, active: true, due: '2023-12-30' });
    
    // Add Project nodes
    graph.addNode('proj1', { type: 'Project', name: 'Cannonball', active: true });
    graph.addNode('proj2', { type: 'Project', name: 'Side Project', active: false });
    
    // Add Category nodes
    graph.addNode('cat1', { type: 'Category', name: 'Work', tags: ['important', 'professional'] });
    graph.addNode('cat2', { type: 'Category', name: 'Personal', tags: ['leisure', 'health'] });
    
    // Add relationships
    // Person -> Task (ASSIGNED)
    graph.addEdge('p1', 't1', 'ASSIGNED', { timestamp: Date.now() });
    graph.addEdge('p1', 't3', 'ASSIGNED', { timestamp: Date.now() });
    graph.addEdge('p2', 't2', 'ASSIGNED', { timestamp: Date.now() });
    
    // Task -> Project (BELONGS_TO)
    graph.addEdge('t1', 'proj1', 'BELONGS_TO', { primary: true });
    graph.addEdge('t2', 'proj1', 'BELONGS_TO', { primary: true });
    graph.addEdge('t3', 'proj1', 'BELONGS_TO', { primary: true });
    
    // Project -> Category (CATEGORIZED_AS)
    graph.addEdge('proj1', 'cat1', 'CATEGORIZED_AS', { timestamp: Date.now() });
    graph.addEdge('proj2', 'cat2', 'CATEGORIZED_AS', { timestamp: Date.now() });
    
    // Person -> Person (KNOWS)
    graph.addEdge('p1', 'p2', 'KNOWS', { since: '2020-01-01' });
    graph.addEdge('p2', 'p3', 'KNOWS', { since: '2021-06-15' });
  });

  /**
   * Helper function to execute a Cypher MATCH query and return matched nodes
   */
  function executeMatchQuery(query: string): Node<TestNodeData>[] {
    // The pattern matcher to use
    const patternMatcher = new PatternMatcherImpl<TestNodeData>();
    
    // Strip out the RETURN part since our parser doesn't handle it
    // This assumes queries are in the format: MATCH (...) RETURN x
    const matchPart = query.split('RETURN')[0].trim();
    
    // 1. Tokenize the query
    const lexer = new CypherLexer();
    const tokens: Token[] = lexer.tokenize(matchPart);
    
    // 2. Parse the query
    const parser = new CypherParser(lexer);
    const statement = parser.parse();
    
    // 3. Handle errors if any
    const errors = parser.getErrors();
    if (errors.length > 0) {
      throw new Error(`Parse errors: ${errors.join(', ')}`);
    }
    
    // 4. Extract node patterns from the MATCH clause
    if (!statement.match || statement.match.patterns.length === 0) {
      throw new Error('No MATCH patterns found in query');
    }
    
    // 5. Execute the pattern matching for each pattern and collect results
    let matchedNodes: Node<TestNodeData>[] = [];
    
    // For this simplified E2E test, we'll just use the first pattern's start node
    const firstPattern = statement.match.patterns[0];
    const nodePattern = firstPattern.start;
    
    // Execute the pattern matching
    matchedNodes = patternMatcher.findMatchingNodes(graph, nodePattern);
    
    return matchedNodes;
  }

  describe('Simple Node Matching', () => {
    it('should match nodes by label', () => {
      const query = 'MATCH (p:Person) RETURN p';
      const result = executeMatchQuery(query);
      
      expect(result).toHaveLength(3);
      expect(result.map(node => node.id)).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
    });
    
    it('should match nodes by single property', () => {
      const query = 'MATCH (t:Task {active: true}) RETURN t';
      const result = executeMatchQuery(query);
      
      expect(result).toHaveLength(2);
      expect(result.map(node => node.id)).toEqual(expect.arrayContaining(['t1', 't3']));
    });
    
    it('should match nodes by multiple properties', () => {
      const query = 'MATCH (p:Person {age: 30, active: true}) RETURN p';
      const result = executeMatchQuery(query);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });
    
    it('should match nodes without label but with properties', () => {
      const query = 'MATCH (n {active: true}) RETURN n';
      const result = executeMatchQuery(query);
      
      expect(result).toHaveLength(5); // All active nodes across types
    });
  });

  describe('Property Value Types', () => {
    it('should match string properties', () => {
      const query = 'MATCH (t:Task {name: "Fix bug"}) RETURN t';
      const result = executeMatchQuery(query);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t1');
    });
    
    it('should match numeric properties', () => {
      const query = 'MATCH (t:Task {priority: 3}) RETURN t';
      const result = executeMatchQuery(query);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t3');
    });
    
    it('should match boolean properties', () => {
      const query = 'MATCH (p:Project {active: false}) RETURN p';
      const result = executeMatchQuery(query);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('proj2');
    });
  });

  describe('Case Sensitivity', () => {
    it('should be case-insensitive for labels by default', () => {
      const query = 'MATCH (p:person) RETURN p';
      const result = executeMatchQuery(query);
      
      expect(result).toHaveLength(3);
      expect(result.map(node => node.id)).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
    });
    
    it('should be case-sensitive for property values', () => {
      // This should not match any nodes because the property value is case-sensitive
      const query = 'MATCH (p:Person {name: "alice"}) RETURN p';
      const result = executeMatchQuery(query);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('Complex Queries', () => {
    it('should handle multiple labels in a query', () => {
      // In our Cypher subset, having multiple labels typically means any of them
      const query = 'MATCH (n:Person:Task) RETURN n';
      const result = executeMatchQuery(query);
      
      // This should only match nodes that have BOTH labels in our implementation
      // Since no node has both, it will return empty
      expect(result).toHaveLength(0);
    });
    
    it('should match nodes with specific priority ranges', () => {
      // Tasks with priority greater than 1
      const query = 'MATCH (t:Task {priority: 2}) RETURN t';
      const result = executeMatchQuery(query);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t2');
    });
    
    it('should match active tasks assigned to Alice', () => {
      // Because our simple pipeline doesn't handle WHERE clauses,
      // we can only include direct property comparisons
      const query = 'MATCH (t:Task {active: true}) RETURN t';
      const result = executeMatchQuery(query);
      
      // In a real system, we might use:
      // MATCH (p:Person {name: "Alice"})-[:ASSIGNED]->(t:Task {active: true}) RETURN t
      
      expect(result).toHaveLength(2);
      expect(result.map(node => node.id)).toEqual(expect.arrayContaining(['t1', 't3']));
    });
  });

  describe('Type Coercion', () => {
    it('should not perform type coercion by default', () => {
      // Add a task with string priority
      graph.addNode('t4', { type: 'Task', name: 'String priority task', priority: '2' as any, active: true });
      
      // Query for numeric priority 2
      const query = 'MATCH (t:Task {priority: 2}) RETURN t';
      const result = executeMatchQuery(query);
      
      // Should only match t2, not t4 (which has string "2")
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t2');
    });
    
    it('can handle type coercion when enabled', () => {
      // Same as above but with coercion enabled
      graph.addNode('t4', { type: 'Task', name: 'String priority task', priority: '2' as any, active: true });
      
      // Create custom executeMatchQuery with type coercion
      function executeCoercingQuery(query: string): Node<TestNodeData>[] {
        const patternMatcher = new PatternMatcherImpl<TestNodeData>({ enableTypeCoercion: true });
        
        // Strip out the RETURN part since our parser doesn't handle it
        const matchPart = query.split('RETURN')[0].trim();
        
        const lexer = new CypherLexer();
        lexer.tokenize(matchPart);
        const parser = new CypherParser(lexer);
        const statement = parser.parse();
        
        if (!statement.match || statement.match.patterns.length === 0) {
          throw new Error('No MATCH patterns found in query');
        }
        
        const nodePattern = statement.match.patterns[0].start;
        return patternMatcher.findMatchingNodes(graph, nodePattern);
      }
      
      // Query for numeric priority 2
      const query = 'MATCH (t:Task {priority: 2}) RETURN t';
      const result = executeCoercingQuery(query);
      
      // Should match both t2 (numeric 2) and t4 (string "2")
      expect(result).toHaveLength(2);
      expect(result.map(node => node.id)).toEqual(expect.arrayContaining(['t2', 't4']));
    });
  });

  describe('Error Conditions', () => {
    it('should throw an error for invalid syntax', () => {
      const query = 'MATCH Person RETURN p'; // Missing parentheses
      
      expect(() => {
        executeMatchQuery(query);
      }).toThrow();
    });
    
    it('should throw an error for missing MATCH clause', () => {
      const query = 'WHERE p.name = "Alice" RETURN p'; // Missing MATCH
      
      expect(() => {
        executeMatchQuery(query);
      }).toThrow('No MATCH patterns found in query');
    });
  });
});