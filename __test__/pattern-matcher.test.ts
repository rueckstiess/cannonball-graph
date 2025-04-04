import { GraphImpl } from '../src/graph/graph';
import { Graph, Node, Edge } from '../src/graph/types';
import { NodePattern, RelationshipPattern, PathPattern } from '../src/rules/types';
import { PatternMatcher, PatternMatcherImpl } from '../src/rules/pattern-matcher';
import { CypherLexer } from '../src/rules/lexer';
import { CypherParser } from '../src/rules/rule-parser';

describe('PatternMatcher', () => {
  // Define test data types
  type TestNodeData = {
    type: string;
    name?: string;
    age?: number;
    active?: boolean;
    tags?: string[];
  };

  type TestEdgeData = {
    since?: string;
    weight?: number;
    active?: boolean;
    primary?: boolean;
  };

  let graph: Graph<TestNodeData, TestEdgeData>;
  let matcher: PatternMatcher<TestNodeData, TestEdgeData>;

  beforeEach(() => {
    // Create a new graph for each test
    graph = new GraphImpl<TestNodeData, TestEdgeData>();
    matcher = new PatternMatcherImpl<TestNodeData, TestEdgeData>();

    // People
    graph.addNode('alice', { type: 'person', name: 'Alice', age: 30, active: true });
    graph.addNode('bob', { type: 'person', name: 'Bob', age: 40, active: true });
    graph.addNode('charlie', { type: 'person', name: 'Charlie', age: 25, active: false });

    // Organizations
    graph.addNode('techCorp', { type: 'company', name: 'TechCorp', active: true });
    graph.addNode('eduInst', { type: 'university', name: 'EduInst' });

    // Tasks
    graph.addNode('task1', { type: 'task', name: 'Fix bug', active: true });
    graph.addNode('task2', { type: 'task', name: 'Write docs', active: false });

    // Categories
    graph.addNode('cat1', { type: 'category', name: 'Work', tags: ['important', 'professional'] });

    // Relationships
    // Person -> Person (KNOWS)
    graph.addEdge('alice', 'bob', 'KNOWS', { since: '2020-01-01', weight: 5, active: true });
    graph.addEdge('bob', 'charlie', 'KNOWS', { since: '2021-03-15', weight: 3, active: true });
    graph.addEdge('charlie', 'alice', 'KNOWS', { since: '2022-02-10', weight: 2, active: false });

    // Person -> Task (ASSIGNED)
    graph.addEdge('alice', 'task1', 'ASSIGNED', { since: '2023-01-01' });
    graph.addEdge('bob', 'task2', 'ASSIGNED', { since: '2023-02-15' });

    // Person -> Organization (WORKS_AT/STUDIES_AT)
    graph.addEdge('alice', 'techCorp', 'WORKS_AT', { since: '2018-05-01', active: true });
    graph.addEdge('bob', 'techCorp', 'WORKS_AT', { since: '2019-10-15', active: true });
    graph.addEdge('charlie', 'eduInst', 'STUDIES_AT', { since: '2020-09-01', active: true });

    // Task -> Category (BELONGS_TO)
    graph.addEdge('task1', 'cat1', 'BELONGS_TO', { primary: true });
    graph.addEdge('task2', 'cat1', 'BELONGS_TO', { primary: false });
  });

  describe('Node Pattern Matching', () => {
    describe('getNodesByLabel', () => {
      it('should find nodes by label', () => {
        const personNodes = matcher.getNodesByLabel(graph, 'person');
        expect(personNodes).toHaveLength(3);
        expect(personNodes.map(n => n.id)).toEqual(expect.arrayContaining(['alice', 'bob', 'charlie']));

        const taskNodes = matcher.getNodesByLabel(graph, 'task');
        expect(taskNodes).toHaveLength(2);
        expect(taskNodes.map(n => n.id)).toEqual(expect.arrayContaining(['task1', 'task2']));
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
        const caseSensitiveMatcher = new PatternMatcherImpl<TestNodeData, TestEdgeData>({
          caseSensitiveLabels: true
        });

        const personNodes = caseSensitiveMatcher.getNodesByLabel(graph, 'PERSON');
        expect(personNodes).toHaveLength(0);
      });
    });

    describe('matchesNodePattern', () => {
      it('should match simple label pattern', () => {
        const node = graph.getNode('alice')!;
        const pattern: NodePattern = {
          labels: ['person'],
          properties: {}
        };

        expect(matcher.matchesNodePattern(node, pattern)).toBe(true);
      });

      it('should match label and properties pattern', () => {
        const node = graph.getNode('alice')!;
        const pattern: NodePattern = {
          labels: ['person'],
          properties: { age: 30, active: true }
        };

        expect(matcher.matchesNodePattern(node, pattern)).toBe(true);
      });

      it('should return false if label doesn\'t match', () => {
        const node = graph.getNode('alice')!;
        const pattern: NodePattern = {
          labels: ['task'],
          properties: {}
        };

        expect(matcher.matchesNodePattern(node, pattern)).toBe(false);
      });

      it('should return false if properties don\'t match', () => {
        const node = graph.getNode('alice')!;
        const pattern: NodePattern = {
          labels: ['person'],
          properties: { age: 25 }
        };

        expect(matcher.matchesNodePattern(node, pattern)).toBe(false);
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
        expect(matches.map(n => n.id)).toEqual(expect.arrayContaining(['alice', 'bob', 'charlie']));
      });

      it('should find nodes matching property pattern', () => {
        const pattern: NodePattern = {
          labels: [],
          properties: { active: true }
        };

        const matches = matcher.findMatchingNodes(graph, pattern);
        expect(matches.length).toBeGreaterThan(0);
        matches.forEach(node => {
          expect((node.data as any).active).toBe(true);
        });
      });

      it('should find nodes matching label and property pattern', () => {
        const pattern: NodePattern = {
          labels: ['person'],
          properties: { active: true }
        };

        const matches = matcher.findMatchingNodes(graph, pattern);
        expect(matches).toHaveLength(2);
        expect(matches.map(n => n.id)).toEqual(expect.arrayContaining(['alice', 'bob']));
      });
    });
  });

  describe('Relationship Pattern Matching', () => {
    describe('getRelationshipsByType', () => {
      it('should find relationships by type', () => {
        const knowsEdges = matcher.getRelationshipsByType(graph, 'KNOWS');
        expect(knowsEdges).toHaveLength(3);
        expect(knowsEdges.map(e => e.label)).toEqual(['KNOWS', 'KNOWS', 'KNOWS']);

        const worksAtEdges = matcher.getRelationshipsByType(graph, 'WORKS_AT');
        expect(worksAtEdges).toHaveLength(2);
        expect(worksAtEdges.map(e => e.label)).toEqual(['WORKS_AT', 'WORKS_AT']);
      });

      it('should return empty array for non-existent relationship types', () => {
        const nonExistentEdges = matcher.getRelationshipsByType(graph, 'NONEXISTENT');
        expect(nonExistentEdges).toHaveLength(0);
      });

      it('should be case-insensitive by default', () => {
        const knowsEdges = matcher.getRelationshipsByType(graph, 'knows');
        expect(knowsEdges).toHaveLength(3);
      });

      it('should respect case sensitivity when configured', () => {
        const caseSensitiveMatcher = new PatternMatcherImpl<TestNodeData, TestEdgeData>({
          caseSensitiveLabels: true
        });

        const knowsEdges = caseSensitiveMatcher.getRelationshipsByType(graph, 'knows');
        expect(knowsEdges).toHaveLength(0);
      });
    });

    describe('matchesRelationshipPattern', () => {
      it('should match simple type pattern', () => {
        const edge = graph.getEdge('alice', 'bob', 'KNOWS')!;
        const pattern: RelationshipPattern = {
          type: 'KNOWS',
          properties: {},
          direction: 'outgoing'
        };

        expect(matcher.matchesRelationshipPattern(edge, pattern)).toBe(true);
      });

      it('should match type and properties pattern', () => {
        const edge = graph.getEdge('alice', 'bob', 'KNOWS')!;
        const pattern: RelationshipPattern = {
          type: 'KNOWS',
          properties: { weight: 5, active: true },
          direction: 'outgoing'
        };

        expect(matcher.matchesRelationshipPattern(edge, pattern)).toBe(true);
      });

      it('should respect relationship direction', () => {
        const edge = graph.getEdge('alice', 'bob', 'KNOWS')!;
        const aliceNode = graph.getNode('alice')!;
        const bobNode = graph.getNode('bob')!;

        // Outgoing direction - should match
        const outgoingPattern: RelationshipPattern = {
          type: 'KNOWS',
          properties: {},
          direction: 'outgoing'
        };

        expect(matcher.matchesRelationshipPattern(edge, outgoingPattern, aliceNode, bobNode)).toBe(true);

        // Incoming direction - should not match
        const incomingPattern: RelationshipPattern = {
          type: 'KNOWS',
          properties: {},
          direction: 'incoming'
        };

        expect(matcher.matchesRelationshipPattern(edge, incomingPattern, aliceNode, bobNode)).toBe(false);

        // Both directions - should match
        const bothPattern: RelationshipPattern = {
          type: 'KNOWS',
          properties: {},
          direction: 'both'
        };

        expect(matcher.matchesRelationshipPattern(edge, bothPattern, aliceNode, bobNode)).toBe(true);
      });

      it('should return false if type doesn\'t match', () => {
        const edge = graph.getEdge('alice', 'bob', 'KNOWS')!;
        const pattern: RelationshipPattern = {
          type: 'WORKS_AT',
          properties: {},
          direction: 'outgoing'
        };

        expect(matcher.matchesRelationshipPattern(edge, pattern)).toBe(false);
      });

      it('should return false if properties don\'t match', () => {
        const edge = graph.getEdge('alice', 'bob', 'KNOWS')!;
        const pattern: RelationshipPattern = {
          type: 'KNOWS',
          properties: { weight: 10 }, // Wrong weight
          direction: 'outgoing'
        };

        expect(matcher.matchesRelationshipPattern(edge, pattern)).toBe(false);
      });
    });

    describe('findMatchingRelationships', () => {
      it('should find relationships by type', () => {
        const pattern: RelationshipPattern = {
          type: 'KNOWS',
          properties: {},
          direction: 'both'
        };

        const matchingEdges = matcher.findMatchingRelationships(graph, pattern);
        expect(matchingEdges).toHaveLength(3);
        matchingEdges.forEach(edge => {
          expect(edge.label).toBe('KNOWS');
        });
      });

      it('should find relationships by type and properties', () => {
        const pattern: RelationshipPattern = {
          type: 'KNOWS',
          properties: { active: true },
          direction: 'both'
        };

        const matchingEdges = matcher.findMatchingRelationships(graph, pattern);
        expect(matchingEdges).toHaveLength(2);
        matchingEdges.forEach(edge => {
          expect(edge.label).toBe('KNOWS');
          expect(edge.data.active).toBe(true);
        });
      });

      it('should find relationships by direction from a specific node', () => {
        const outgoingPattern: RelationshipPattern = {
          type: 'KNOWS',
          properties: {},
          direction: 'outgoing'
        };

        const outgoingEdges = matcher.findMatchingRelationships(graph, outgoingPattern, 'alice');
        expect(outgoingEdges).toHaveLength(1);
        expect(outgoingEdges[0].source).toBe('alice');
        expect(outgoingEdges[0].target).toBe('bob');

        const incomingPattern: RelationshipPattern = {
          type: 'KNOWS',
          properties: {},
          direction: 'incoming'
        };

        const incomingEdges = matcher.findMatchingRelationships(graph, incomingPattern, 'alice');
        expect(incomingEdges).toHaveLength(1);
        expect(incomingEdges[0].source).toBe('charlie');
        expect(incomingEdges[0].target).toBe('alice');
      });

      it('should return empty array if no relationships match', () => {
        const pattern: RelationshipPattern = {
          type: 'NONEXISTENT',
          properties: {},
          direction: 'both'
        };

        const matchingEdges = matcher.findMatchingRelationships(graph, pattern);
        expect(matchingEdges).toHaveLength(0);
      });
    });
  });

  describe('Path Pattern Matching', () => {
    it('should find simple paths (node-relationship-node)', () => {
      const pathPattern: PathPattern = {
        start: {
          labels: ['person'],
          properties: { name: 'Alice' }
        },
        segments: [
          {
            relationship: {
              type: 'KNOWS',
              properties: {},
              direction: 'outgoing'
            },
            node: {
              labels: ['person'],
              properties: {}
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);
      expect(paths).toHaveLength(1);

      const path = paths[0];
      expect(path.nodes).toHaveLength(2);
      expect(path.nodes[0].id).toBe('alice');
      expect(path.nodes[1].id).toBe('bob');

      expect(path.edges).toHaveLength(1);
      expect(path.edges[0].label).toBe('KNOWS');
    });

    it('should find multi-segment paths', () => {
      const pathPattern: PathPattern = {
        start: {
          labels: ['person'],
          properties: { name: 'Alice' }
        },
        segments: [
          {
            relationship: {
              type: 'KNOWS',
              properties: {},
              direction: 'outgoing'
            },
            node: {
              labels: ['person'],
              properties: {}
            }
          },
          {
            relationship: {
              type: 'KNOWS',
              properties: {},
              direction: 'outgoing'
            },
            node: {
              labels: ['person'],
              properties: {}
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);
      expect(paths).toHaveLength(1);

      const path = paths[0];
      expect(path.nodes).toHaveLength(3);
      expect(path.nodes[0].id).toBe('alice');
      expect(path.nodes[1].id).toBe('bob');
      expect(path.nodes[2].id).toBe('charlie');

      expect(path.edges).toHaveLength(2);
      expect(path.edges[0].label).toBe('KNOWS');
      expect(path.edges[1].label).toBe('KNOWS');
    });

    it('should find paths with specific property constraints', () => {
      const pathPattern: PathPattern = {
        start: {
          labels: ['person'],
          properties: { name: 'Alice' }
        },
        segments: [
          {
            relationship: {
              type: 'ASSIGNED',
              properties: {},
              direction: 'outgoing'
            },
            node: {
              labels: ['task'],
              properties: { active: true }
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);
      expect(paths).toHaveLength(1);

      const path = paths[0];
      expect(path.nodes).toHaveLength(2);
      expect(path.nodes[0].id).toBe('alice');
      expect(path.nodes[1].id).toBe('task1');
      expect(path.edges[0].label).toBe('ASSIGNED');
    });

    it('should return empty array if no paths match', () => {
      const pathPattern: PathPattern = {
        start: {
          labels: ['person'],
          properties: { name: 'Alice' }
        },
        segments: [
          {
            relationship: {
              type: 'NONEXISTENT',
              properties: {},
              direction: 'outgoing'
            },
            node: {
              labels: ['person'],
              properties: {}
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);
      expect(paths).toHaveLength(0);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache node label lookups', () => {
      // First, clear any existing cache
      matcher.clearCache();

      // Make first call and measure how many nodes we get
      const firstCall = matcher.getNodesByLabel(graph, 'person');
      expect(firstCall).toHaveLength(3);

      // Add a new person node - this should NOT appear in cached results
      graph.addNode('dave', { type: 'person', name: 'Dave', age: 45 });

      // Second call should use the cache and not include the new node
      const secondCall = matcher.getNodesByLabel(graph, 'person');
      expect(secondCall).toHaveLength(3); // Still 3, not 4

      // After clearing cache, we should get the new node too
      matcher.clearCache();
      const thirdCall = matcher.getNodesByLabel(graph, 'person');
      expect(thirdCall).toHaveLength(4); // Now 4, including the new node
    });

    it('should cache relationship type lookups', () => {
      // First call to build cache
      const firstCall = matcher.getRelationshipsByType(graph, 'KNOWS');
      expect(firstCall).toHaveLength(3);

      // Add a new relationship
      graph.addNode('dave', { type: 'person', name: 'Dave', age: 45 });
      graph.addEdge('alice', 'dave', 'KNOWS', { since: '2023-01-01', weight: 1, active: true });

      // Second call should use cache
      const secondCall = matcher.getRelationshipsByType(graph, 'KNOWS');
      expect(secondCall).toHaveLength(3); // Still 3, not 4

      // Clear cache and try again
      matcher.clearCache();
      const thirdCall = matcher.getRelationshipsByType(graph, 'KNOWS');
      expect(thirdCall).toHaveLength(4); // Now 4 with the new relationship
    });

    it('should refresh node and edge data even when using cache', () => {
      // Get initial set of nodes
      const beforeNodes = matcher.getNodesByLabel(graph, 'person');
      expect(beforeNodes).toHaveLength(3);

      // Update a node's data
      graph.updateNode('alice', { type: 'person', name: 'Alice Modified', age: 31, active: true });

      // Get nodes again - we should see the updated data
      const afterNodes = matcher.getNodesByLabel(graph, 'person');
      expect(afterNodes).toHaveLength(3);

      const modifiedNode = afterNodes.find(n => n.id === 'alice');
      expect(modifiedNode?.data.name).toBe('Alice Modified');
      expect(modifiedNode?.data.age).toBe(31);

      // Similarly for edges
      const knowsEdges = matcher.getRelationshipsByType(graph, 'KNOWS');
      const originalEdge = knowsEdges.find(e => e.source === 'alice' && e.target === 'bob');
      expect(originalEdge?.data.weight).toBe(5);

      // Update the relationship data
      graph.updateEdge('alice', 'bob', 'KNOWS', {
        since: '2020-01-01',
        weight: 10, // Changed from 5 to 10
        active: true
      });

      // Second call should use cache but get updated data
      const updatedEdges = matcher.getRelationshipsByType(graph, 'KNOWS');
      const updatedEdge = updatedEdges.find(e => e.source === 'alice' && e.target === 'bob');
      expect(updatedEdge?.data.weight).toBe(10);
    });
  });

  describe('Integration with Cypher AST', () => {
    /**
     * Helper function to extract node patterns from a Cypher MATCH clause
     */
    function extractNodePatternFromCypher(cypherQuery: string): NodePattern {
      const lexer = new CypherLexer();
      const parser = new CypherParser(lexer, cypherQuery);
      const statement = parser.parse();

      if (!statement.match || statement.match.patterns.length === 0) {
        throw new Error('No MATCH patterns found in query');
      }

      return statement.match.patterns[0].start;
    }

    /**
     * Helper function to extract relationship patterns from a Cypher MATCH clause
     */
    function extractRelationshipPatternFromCypher(cypherQuery: string): RelationshipPattern {
      const lexer = new CypherLexer();
      const parser = new CypherParser(lexer, cypherQuery);
      const statement = parser.parse();

      if (!statement.match || statement.match.patterns.length === 0) {
        throw new Error('No MATCH patterns found in query');
      }

      if (statement.match.patterns[0].segments.length === 0) {
        throw new Error('No relationship pattern found in query');
      }

      return statement.match.patterns[0].segments[0].relationship;
    }

    /**
     * Helper function to extract path patterns from a Cypher MATCH clause
     */
    function extractPathPatternFromCypher(cypherQuery: string): PathPattern {
      const lexer = new CypherLexer();
      const parser = new CypherParser(lexer, cypherQuery);
      const statement = parser.parse();

      if (!statement.match || statement.match.patterns.length === 0) {
        throw new Error('No MATCH patterns found in query');
      }

      return statement.match.patterns[0];
    }

    it('should match nodes using pattern from Cypher query', () => {
      const cypher = 'MATCH (p:person {name: "Alice"})';
      const nodePattern = extractNodePatternFromCypher(cypher);

      const matchingNodes = matcher.findMatchingNodes(graph, nodePattern);

      expect(matchingNodes.length).toBe(1);
      expect(matchingNodes[0].id).toBe('alice');
      expect(matchingNodes[0].data.name).toBe('Alice');
    });

    it('should match relationships using pattern from Cypher query', () => {
      const cypher = 'MATCH ()-[r:KNOWS]-()';
      const relationshipPattern = extractRelationshipPatternFromCypher(cypher);

      const matchingRelationships = matcher.findMatchingRelationships(graph, relationshipPattern);

      expect(matchingRelationships.length).toBe(3);
      expect(matchingRelationships.every(r => r.label === 'KNOWS')).toBe(true);
    });

    it('should match complete paths from Cypher query', () => {
      const cypher = 'MATCH (a:person {name: "Alice"})-[r:KNOWS]->(b:person)';
      const pathPattern = extractPathPatternFromCypher(cypher);

      const matchingPaths = matcher.findMatchingPaths(graph, pathPattern);

      expect(matchingPaths.length).toBe(1);
      expect(matchingPaths[0].nodes.length).toBe(2);
      expect(matchingPaths[0].nodes[0].id).toBe('alice');
      expect(matchingPaths[0].nodes[1].id).toBe('bob');
      expect(matchingPaths[0].edges.length).toBe(1);
      expect(matchingPaths[0].edges[0].label).toBe('KNOWS');
    });
  });
});