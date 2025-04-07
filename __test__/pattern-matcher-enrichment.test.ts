import { Graph } from '@/graph';
import { PatternMatcher } from '@/lang/pattern-matcher';
import { BindingContext } from '@/lang/condition-evaluator';
import { PathPattern } from '@/lang/pattern-matcher';

describe('PatternMatcher - enrichPatternWithBindings', () => {
  let graph: Graph;
  let patternMatcher: PatternMatcher;
  
  beforeEach(() => {
    graph = new Graph();
    patternMatcher = new PatternMatcher();
    
    // Setup a simple graph
    graph.addNode('alice', 'Person', { name: 'Alice', age: 30 });
    graph.addNode('bob', 'Person', { name: 'Bob', age: 40 });
    graph.addNode('charlie', 'Person', { name: 'Charlie', age: 25 });
    
    graph.addNode('prod1', 'Product', { category: 'Books', price: 20 });
    graph.addNode('prod2', 'Product', { category: 'Electronics', price: 150 });
    graph.addNode('prod3', 'Product', { category: 'Books' });
    
    graph.addNode('review1', 'Review', { rating: 5 });
    
    graph.addEdge('alice', 'bob', 'KNOWS', { since: 2020 });
    graph.addEdge('bob', 'charlie', 'KNOWS', { since: 2021 });
    graph.addEdge('review1', 'prod1', 'REVIEWS', {});
  });
  
  test('enriches start node pattern with bound variable', () => {
    // Create a pattern with a variable in the start node
    const pattern: PathPattern = {
      start: { variable: 'p', labels: ['Person'], properties: {} },
      segments: []
    };
    
    // Create bindings with 'p' bound to 'alice'
    const bindings = new BindingContext();
    bindings.set('p', graph.getNode('alice'));
    
    // Enrich the pattern
    const enrichedPattern = patternMatcher.enrichPatternWithBindings(pattern, bindings);
    
    // Verify the pattern now has the ID constraint for alice
    expect(enrichedPattern.start.properties).toHaveProperty('id', 'alice');
    
    // Verify pattern matching works as expected
    const paths = patternMatcher.findMatchingPaths(graph, enrichedPattern);
    expect(paths).toHaveLength(1);
    expect(paths[0].nodes[0].id).toBe('alice');
  });
  
  test('enriches segment node pattern with bound variable', () => {
    // Create a pattern with a variable in a segment node
    const pattern: PathPattern = {
      start: { labels: ['Person'], properties: {} },
      segments: [
        {
          relationship: { type: 'KNOWS', properties: {}, direction: 'outgoing' },
          node: { variable: 'friend', labels: ['Person'], properties: {} }
        }
      ]
    };
    
    // Create bindings with 'friend' bound to 'bob'
    const bindings = new BindingContext();
    bindings.set('friend', graph.getNode('bob'));
    
    // Enrich the pattern
    const enrichedPattern = patternMatcher.enrichPatternWithBindings(pattern, bindings);
    
    // Verify the pattern now has the ID constraint for bob
    expect(enrichedPattern.segments[0].node.properties).toHaveProperty('id', 'bob');
    
    // Verify pattern matching works as expected
    const paths = patternMatcher.findMatchingPaths(graph, enrichedPattern);
    expect(paths).toHaveLength(1);
    expect(paths[0].nodes[0].id).toBe('alice'); // Start node should be alice
    expect(paths[0].nodes[1].id).toBe('bob');   // End node should be bob
  });
  
  test('handles multiple bound variables in a pattern', () => {
    // Create a pattern with variables in both start and end
    const pattern: PathPattern = {
      start: { variable: 'p1', labels: ['Person'], properties: {} },
      segments: [
        {
          relationship: { type: 'KNOWS', properties: {}, direction: 'outgoing' },
          node: { variable: 'p2', labels: ['Person'], properties: {} }
        }
      ]
    };
    
    // Create bindings with both variables bound
    const bindings = new BindingContext();
    bindings.set('p1', graph.getNode('alice'));
    bindings.set('p2', graph.getNode('bob'));
    
    // Enrich the pattern
    const enrichedPattern = patternMatcher.enrichPatternWithBindings(pattern, bindings);
    
    // Verify both constraints are applied
    expect(enrichedPattern.start.properties).toHaveProperty('id', 'alice');
    expect(enrichedPattern.segments[0].node.properties).toHaveProperty('id', 'bob');
    
    // Verify pattern matching works as expected
    const paths = patternMatcher.findMatchingPaths(graph, enrichedPattern);
    expect(paths).toHaveLength(1);
    expect(paths[0].nodes[0].id).toBe('alice');
    expect(paths[0].nodes[1].id).toBe('bob');
  });
  
  test('handles bound variables with no matching path', () => {
    // Create a pattern that can't be matched (alice directly knows charlie)
    const pattern: PathPattern = {
      start: { variable: 'p1', labels: ['Person'], properties: {} },
      segments: [
        {
          relationship: { type: 'KNOWS', properties: {}, direction: 'outgoing' },
          node: { variable: 'p2', labels: ['Person'], properties: {} }
        }
      ]
    };
    
    // Create bindings with invalid connection
    const bindings = new BindingContext();
    bindings.set('p1', graph.getNode('alice'));
    bindings.set('p2', graph.getNode('charlie')); // Alice doesn't directly know Charlie
    
    // Enrich the pattern
    const enrichedPattern = patternMatcher.enrichPatternWithBindings(pattern, bindings);
    
    // Verify constraints are applied
    expect(enrichedPattern.start.properties).toHaveProperty('id', 'alice');
    expect(enrichedPattern.segments[0].node.properties).toHaveProperty('id', 'charlie');
    
    // Verify pattern matching returns no paths
    const paths = patternMatcher.findMatchingPaths(graph, enrichedPattern);
    expect(paths).toHaveLength(0);
  });
  
  test('reproduces NOT EXISTS issue with Review pattern', () => {
    // This test reproduces the specific issue with the NOT EXISTS pattern from the failing test
    
    // Create a pattern for (:Review)-[:REVIEWS]->(p) where p is bound
    const pattern: PathPattern = {
      start: { labels: ['Review'], properties: {} },
      segments: [
        {
          relationship: { type: 'REVIEWS', properties: {}, direction: 'outgoing' },
          node: { variable: 'p', labels: [], properties: {} }
        }
      ]
    };
    
    // Test with prod1 (has reviews)
    const bindings1 = new BindingContext();
    bindings1.set('p', graph.getNode('prod1'));
    
    const enrichedPattern1 = patternMatcher.enrichPatternWithBindings(pattern, bindings1);
    const paths1 = patternMatcher.findMatchingPaths(graph, enrichedPattern1);
    
    // Should find a path since review1 REVIEWS prod1
    expect(paths1).toHaveLength(1);
    expect(paths1[0].nodes[0].id).toBe('review1');
    expect(paths1[0].nodes[1].id).toBe('prod1');
    
    // Test with prod2 (no reviews)
    const bindings2 = new BindingContext();
    bindings2.set('p', graph.getNode('prod2'));
    
    const enrichedPattern2 = patternMatcher.enrichPatternWithBindings(pattern, bindings2);
    const paths2 = patternMatcher.findMatchingPaths(graph, enrichedPattern2);
    
    // Should find no paths since no reviews for prod2
    expect(paths2).toHaveLength(0);
  });
});