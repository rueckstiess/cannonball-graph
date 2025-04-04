import { GraphImpl } from '../src/graph/graph';
import { Graph } from '../src/graph/types';
import { NodePattern } from '../src/rules/types';
import { PatternMatcher, PatternMatcherImpl } from '../src/rules/pattern-matcher';

describe('Pattern Matcher', () => {
  // Define type for node data to make tests more explicit
  type TestNodeData = {
    type: string;
    name?: string;
    age?: number;
    active?: boolean;
    tags?: string[];
  };
  
  let graph: Graph<TestNodeData>;
  let matcher: PatternMatcher<TestNodeData>;
  
  beforeEach(() => {
    graph = new GraphImpl<TestNodeData>();
    matcher = new PatternMatcherImpl<TestNodeData>();
    
    // Create a sample graph for testing
    graph.addNode('p1', { type: 'person', name: 'Alice', age: 30, active: true });
    graph.addNode('p2', { type: 'person', name: 'Bob', age: 25, active: false });
    graph.addNode('p3', { type: 'person', name: 'Charlie', age: 35, active: true });
    graph.addNode('t1', { type: 'task', name: 'Buy groceries', active: true });
    graph.addNode('t2', { type: 'task', name: 'Do laundry', active: false });
    graph.addNode('c1', { type: 'category', name: 'Home', tags: ['household', 'personal'] });
    
    // Add some relationships
    graph.addEdge('p1', 't1', 'ASSIGNED', { timestamp: Date.now() });
    graph.addEdge('p2', 't2', 'ASSIGNED', { timestamp: Date.now() });
    graph.addEdge('t1', 'c1', 'BELONGS_TO', { primary: true });
  });
  
  describe('getNodesByLabel', () => {
    it('should find nodes by label', () => {
      const personNodes = matcher.getNodesByLabel(graph, 'person');
      expect(personNodes).toHaveLength(3);
      expect(personNodes.map(n => n.id)).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
      
      const taskNodes = matcher.getNodesByLabel(graph, 'task');
      expect(taskNodes).toHaveLength(2);
      expect(taskNodes.map(n => n.id)).toEqual(expect.arrayContaining(['t1', 't2']));
    });
    
    it('should return empty array for non-existent labels', () => {
      const nonExistentNodes = matcher.getNodesByLabel(graph, 'nonexistent');
      expect(nonExistentNodes).toHaveLength(0);
    });
    
    it('should be case-insensitive by default', () => {
      const personNodes = matcher.getNodesByLabel(graph, 'PERSON');
      expect(personNodes).toHaveLength(3);
    });
    
    it('should respect case sensitivity when configured', () => {
      const caseSensitiveMatcher = new PatternMatcherImpl<TestNodeData>({ 
        caseSensitiveLabels: true 
      });
      
      const personNodes = caseSensitiveMatcher.getNodesByLabel(graph, 'PERSON');
      expect(personNodes).toHaveLength(0);
    });
  });
  
  describe('matchesNodePattern', () => {
    it('should match simple label pattern', () => {
      const node = graph.getNode('p1')!;
      const pattern: NodePattern = {
        labels: ['person'],
        properties: {}
      };
      
      expect(matcher.matchesNodePattern(node, pattern)).toBe(true);
    });
    
    it('should match label and properties pattern', () => {
      const node = graph.getNode('p1')!;
      const pattern: NodePattern = {
        labels: ['person'],
        properties: { age: 30, active: true }
      };
      
      expect(matcher.matchesNodePattern(node, pattern)).toBe(true);
    });
    
    it('should return false if label doesn\'t match', () => {
      const node = graph.getNode('p1')!;
      const pattern: NodePattern = {
        labels: ['task'],
        properties: {}
      };
      
      expect(matcher.matchesNodePattern(node, pattern)).toBe(false);
    });
    
    it('should return false if properties don\'t match', () => {
      const node = graph.getNode('p1')!;
      const pattern: NodePattern = {
        labels: ['person'],
        properties: { age: 25 }
      };
      
      expect(matcher.matchesNodePattern(node, pattern)).toBe(false);
    });
    
    it('should match without type coercion by default', () => {
      // Create a node with string number
      graph.addNode('special', { type: 'test', age: '30' as any });
      const node = graph.getNode('special')!;
      
      const pattern: NodePattern = {
        labels: ['test'],
        properties: { age: 30 }
      };
      
      expect(matcher.matchesNodePattern(node, pattern)).toBe(false);
    });
    
    it('should match with type coercion when configured', () => {
      // Create a node with string number
      graph.addNode('special', { type: 'test', age: '30' as any });
      const node = graph.getNode('special')!;
      
      const pattern: NodePattern = {
        labels: ['test'],
        properties: { age: 30 }
      };
      
      const coercingMatcher = new PatternMatcherImpl<TestNodeData>({ 
        enableTypeCoercion: true 
      });
      
      expect(coercingMatcher.matchesNodePattern(node, pattern)).toBe(true);
    });
  });
  
  describe('findMatchingNodes', () => {
    it('should find nodes matching label pattern', () => {
      const pattern: NodePattern = {
        labels: ['person'],
        properties: {}
      };
      
      const matches = matcher.findMatchingNodes(graph, pattern);
      expect(matches).toHaveLength(3);
      expect(matches.map(n => n.id)).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
    });
    
    it('should find nodes matching property pattern', () => {
      const pattern: NodePattern = {
        labels: [],
        properties: { active: true }
      };
      
      const matches = matcher.findMatchingNodes(graph, pattern);
      expect(matches).toHaveLength(3);
      expect(matches.map(n => n.id)).toEqual(expect.arrayContaining(['p1', 'p3', 't1']));
    });
    
    it('should find nodes matching label and property pattern', () => {
      const pattern: NodePattern = {
        labels: ['person'],
        properties: { active: true }
      };
      
      const matches = matcher.findMatchingNodes(graph, pattern);
      expect(matches).toHaveLength(2);
      expect(matches.map(n => n.id)).toEqual(expect.arrayContaining(['p1', 'p3']));
    });
    
    it('should find nodes matching specific property values', () => {
      const pattern: NodePattern = {
        labels: ['person'],
        properties: { age: 30 }
      };
      
      const matches = matcher.findMatchingNodes(graph, pattern);
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('p1');
    });
    
    it('should find no nodes when pattern does not match', () => {
      const pattern: NodePattern = {
        labels: ['nonexistent'],
        properties: {}
      };
      
      const matches = matcher.findMatchingNodes(graph, pattern);
      expect(matches).toHaveLength(0);
    });
  });
  
  describe('caching behavior', () => {
    it('should cache label lookups', () => {
      // For this test, we'll verify caching by checking the implementation's behavior
      // instead of using jest.spyOn
      
      // First, clear any existing cache
      matcher.clearCache();
      
      // Make first call and measure how many nodes we get
      const firstCall = matcher.getNodesByLabel(graph, 'person');
      expect(firstCall).toHaveLength(3);
      
      // Add a new person node - this should NOT appear in cached results
      graph.addNode('p4', { type: 'person', name: 'Dave', age: 40 });
      
      // Second call should use the cache and not include the new node
      const secondCall = matcher.getNodesByLabel(graph, 'person');
      expect(secondCall).toHaveLength(3); // Still 3, not 4
      
      // After clearing cache, we should get the new node too
      matcher.clearCache();
      const thirdCall = matcher.getNodesByLabel(graph, 'person');
      expect(thirdCall).toHaveLength(4); // Now 4, including the new node
    });
    
    it('should refresh nodes even when using cache', () => {
      // Get initial set of nodes
      const beforeNodes = matcher.getNodesByLabel(graph, 'person');
      expect(beforeNodes).toHaveLength(3);
      
      // Update a node's data
      graph.updateNode('p1', { type: 'person', name: 'Alice Modified', age: 31 });
      
      // Get nodes again - we should see the updated data
      const afterNodes = matcher.getNodesByLabel(graph, 'person');
      expect(afterNodes).toHaveLength(3);
      
      const modifiedNode = afterNodes.find(n => n.id === 'p1');
      expect(modifiedNode?.data.name).toBe('Alice Modified');
      expect(modifiedNode?.data.age).toBe(31);
    });
    
    it('should clear cache when requested', () => {
      // First, clear any existing cache
      matcher.clearCache();
      
      // First call
      matcher.getNodesByLabel(graph, 'person');
      
      // Add a new person node - this should NOT appear in cached results
      graph.addNode('p4', { type: 'person', name: 'Eve', age: 45 });
      
      // This call should use cache (so p4 won't be included)
      const beforeClearNodes = matcher.getNodesByLabel(graph, 'person');
      expect(beforeClearNodes).toHaveLength(3);
      
      // Clear the cache
      matcher.clearCache();
      
      // After clearing cache, p4 should now appear
      const afterClearNodes = matcher.getNodesByLabel(graph, 'person');
      expect(afterClearNodes).toHaveLength(4);
    });
  });
});