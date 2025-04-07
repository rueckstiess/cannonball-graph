import { Graph, Node, Edge, Path } from '@/graph';

import {
  NodePattern, RelationshipPattern, PathPattern,
  PatternMatcher, Lexer, Parser
} from '@/lang';

describe('PatternMatcher', () => {
  // Define test data types
  type TestNodeData = {
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

    /*
                    techCorp
                       ↑
                       W
        alice ──K──▶  bob ──K──▶ charlie ──K──▶ alice (inactive)
          │            │            │
          A            A            S
          ▼            ▼            ▼
        task1        task2      eduInst
          │          
          B            B
          ▼            ▼
        cat1        cat1 (secondary)
    */


    graph = new Graph<TestNodeData, TestEdgeData>();
    matcher = new PatternMatcher<TestNodeData, TestEdgeData>();

    // People
    graph.addNode('alice', 'person', { name: 'Alice', age: 30, active: true });
    graph.addNode('bob', 'person', { name: 'Bob', age: 40, active: true });
    graph.addNode('charlie', 'person', { name: 'Charlie', age: 25, active: false });

    // Organizations
    graph.addNode('techCorp', 'company', { name: 'TechCorp', active: true });
    graph.addNode('eduInst', 'university', { name: 'EduInst' });

    // Tasks
    graph.addNode('task1', 'task', { name: 'Fix bug', active: true });
    graph.addNode('task2', 'task', { name: 'Write docs', active: false });

    // Categories
    graph.addNode('cat1', 'category', { name: 'Work', tags: ['important', 'professional'] });

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
        const caseSensitiveMatcher = new PatternMatcher<TestNodeData, TestEdgeData>({
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
        const caseSensitiveMatcher = new PatternMatcher<TestNodeData, TestEdgeData>({
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
              properties: { name: 'Bob' }
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
              properties: { name: "Charlie" }
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
      graph.addNode('dave', 'person', { name: 'Dave', age: 45 });

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
      graph.addNode('dave', 'person', { name: 'Dave', age: 45 });
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
      graph.updateNodeData('alice', { name: 'Alice Modified', age: 31, active: true });

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
      const lexer = new Lexer();
      const parser = new Parser(lexer, cypherQuery);
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
      const lexer = new Lexer();
      const parser = new Parser(lexer, cypherQuery);
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
      const lexer = new Lexer();
      const parser = new Parser(lexer, cypherQuery);
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
      const cypher = 'MATCH (a:person {name: "Alice"})-[r:KNOWS]->(b:person {name: "Bob"})';
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


describe('Path Pattern Matching', () => {
  // Define test data types
  type TestNodeData = {
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
    role?: string;
    program?: string;
  };

  let graph: Graph<TestNodeData, TestEdgeData>;
  let matcher: PatternMatcher<TestNodeData, TestEdgeData>;

  beforeEach(() => {
    // Create a new graph for each test
    graph = new Graph<TestNodeData, TestEdgeData>();
    matcher = new PatternMatcher<TestNodeData, TestEdgeData>();

    // People
    graph.addNode('alice', 'person', { name: 'Alice', age: 30, active: true });
    graph.addNode('bob', 'person', { name: 'Bob', age: 40, active: true });
    graph.addNode('charlie', 'person', { name: 'Charlie', age: 25, active: false });
    graph.addNode('dave', 'person', { name: 'Dave', age: 35, active: true });
    graph.addNode('eve', 'person', { name: 'Eve', age: 28, active: true });

    // Organizations
    graph.addNode('techCorp', 'company', { name: 'TechCorp', active: true });
    graph.addNode('eduInst', 'university', { name: 'EduInst' });

    // Tasks
    graph.addNode('task1', 'task', { name: 'Fix bug', active: true });
    graph.addNode('task2', 'task', { name: 'Write docs', active: false });
    graph.addNode('task3', 'task', { name: 'Deploy app', active: true });

    // Categories
    graph.addNode('cat1', 'category', { name: 'Work', tags: ['important', 'professional'] });
    graph.addNode('cat2', 'category', { name: 'Personal', tags: ['leisure', 'health'] });

    // Create a social network with KNOWS relationships (for path testing)
    // Alice knows Bob, Charlie, and Eve
    graph.addEdge('alice', 'bob', 'KNOWS', { since: '2020-01-01', weight: 5 });
    graph.addEdge('alice', 'charlie', 'KNOWS', { since: '2021-02-15', weight: 3 });
    graph.addEdge('alice', 'eve', 'KNOWS', { since: '2019-06-10', weight: 4 });

    // Bob knows Charlie and Dave
    graph.addEdge('bob', 'charlie', 'KNOWS', { since: '2018-12-05', weight: 2 });
    graph.addEdge('bob', 'dave', 'KNOWS', { since: '2022-03-20', weight: 3 });

    // Charlie knows Eve
    graph.addEdge('charlie', 'eve', 'KNOWS', { since: '2020-07-18', weight: 4 });

    // Dave knows Eve
    graph.addEdge('dave', 'eve', 'KNOWS', { since: '2021-11-03', weight: 1 });

    // Eve knows Alice
    graph.addEdge('eve', 'alice', 'KNOWS', { since: '2022-01-25', weight: 5 });

    // Additional relationship types for testing
    // WORKS_AT relationships
    graph.addEdge('alice', 'techCorp', 'WORKS_AT', { since: '2018-05-01', role: 'Engineer' });
    graph.addEdge('bob', 'techCorp', 'WORKS_AT', { since: '2019-10-15', role: 'Manager' });
    graph.addEdge('charlie', 'eduInst', 'STUDIES_AT', { since: '2020-09-01', program: 'Computer Science' });

    // ASSIGNED relationships
    graph.addEdge('alice', 'task1', 'ASSIGNED', { since: '2023-01-01' });
    graph.addEdge('bob', 'task2', 'ASSIGNED', { since: '2023-02-15' });
    graph.addEdge('charlie', 'task3', 'ASSIGNED', { since: '2023-03-10' });

    // BELONGS_TO relationships
    graph.addEdge('task1', 'cat1', 'BELONGS_TO', { primary: true });
    graph.addEdge('task2', 'cat1', 'BELONGS_TO', { primary: true });
    graph.addEdge('task3', 'cat2', 'BELONGS_TO', { primary: true });
  });

  describe('Basic Path Matching', () => {
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
              properties: { name: 'Bob' }
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
              properties: { name: 'Bob' }
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
              properties: { name: 'Dave' }
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
      expect(path.nodes[2].id).toBe('dave');

      expect(path.edges).toHaveLength(2);
      expect(path.edges[0].label).toBe('KNOWS');
      expect(path.edges[1].label).toBe('KNOWS');
    });
  });

  describe('Variable-Length Path Matching', () => {
    it('should match variable-length paths with wildcards (*)', () => {
      // Match any path from Alice to Eve
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
              direction: 'outgoing',
              minHops: undefined, // Any number of hops
              maxHops: undefined
            },
            node: {
              labels: ['person'],
              properties: { name: 'Eve' }
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should find at least 3 paths:
      // 1. Alice -> Eve (direct)
      // 2. Alice -> Charlie -> Eve
      // 3. Alice -> Bob -> Dave -> Eve
      expect(paths.length).toBeGreaterThanOrEqual(3);

      paths.forEach(path => {
        // Every path should start with Alice
        expect(path.nodes[0].id).toBe('alice');
        // Every path should end with Eve
        expect(path.nodes[path.nodes.length - 1].id).toBe('eve');
        // All relationships should be KNOWS
        path.edges.forEach(edge => {
          expect(edge.label).toBe('KNOWS');
        });
      });
    });

    it('should match paths with minimum hop constraints (*2..)', () => {
      // Match paths from Alice to Eve with at least 2 hops
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
              direction: 'outgoing',
              minHops: 2, // At least 2 hops
              maxHops: undefined
            },
            node: {
              labels: ['person'],
              properties: { name: 'Eve' }
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should find paths with at least 2 hops:
      // 1. Alice -> Charlie -> Eve
      // 2. Alice -> Bob -> Dave -> Eve
      expect(paths.length).toBeGreaterThanOrEqual(2);

      paths.forEach(path => {
        // Every path should start with Alice
        expect(path.nodes[0].id).toBe('alice');
        // Every path should end with Eve
        expect(path.nodes[path.nodes.length - 1].id).toBe('eve');
        // Should have at least 2 hops (3 nodes)
        expect(path.nodes.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should match paths with maximum hop constraints (*..2)', () => {
      // Match paths from Alice to Eve with maximum 2 hops
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
              direction: 'outgoing',
              minHops: undefined,
              maxHops: 2 // Maximum 2 hops
            },
            node: {
              labels: ['person'],
              properties: { name: 'Eve' }
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should find paths with maximum 2 hops:
      // 1. Alice -> Eve (direct)
      // 2. Alice -> Charlie -> Eve
      expect(paths.length).toBeGreaterThanOrEqual(2);

      paths.forEach(path => {
        // Every path should start with Alice
        expect(path.nodes[0].id).toBe('alice');
        // Every path should end with Eve
        expect(path.nodes[path.nodes.length - 1].id).toBe('eve');
        // Should have at most 2 hops (3 nodes)
        expect(path.nodes.length).toBeLessThanOrEqual(3);
      });
    });

    it('should match paths with exact hop range (*1..2)', () => {
      // Match paths from Alice to Eve with 1 to 2 hops
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
              direction: 'outgoing',
              minHops: 1, // Minimum 1 hop
              maxHops: 2  // Maximum 2 hops
            },
            node: {
              labels: ['person'],
              properties: { name: 'Eve' }
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should find paths with 1-2 hops:
      // 1. Alice -> Eve (direct, 1 hop)
      // 2. Alice -> Charlie -> Eve (2 hops)
      expect(paths.length).toBeGreaterThanOrEqual(2);

      paths.forEach(path => {
        // Every path should start with Alice
        expect(path.nodes[0].id).toBe('alice');
        // Every path should end with Eve
        expect(path.nodes[path.nodes.length - 1].id).toBe('eve');
        // Should have 1-2 hops (2-3 nodes)
        expect(path.nodes.length).toBeGreaterThanOrEqual(2);
        expect(path.nodes.length).toBeLessThanOrEqual(3);
      });
    });

    it('should handle cycles in variable-length paths', () => {
      // Match paths from Alice to Alice (cycles), following KNOWS relationships
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
              direction: 'outgoing',
              minHops: 2, // At least 2 hops to avoid trivial cycles
              maxHops: undefined
            },
            node: {
              labels: ['person'],
              properties: { name: 'Alice' }
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should find cyclic paths:
      // e.g., Alice -> Eve -> Alice
      expect(paths.length).toBeGreaterThan(0);

      paths.forEach(path => {
        // Every path should start with Alice
        expect(path.nodes[0].id).toBe('alice');
        // Every path should end with Alice
        expect(path.nodes[path.nodes.length - 1].id).toBe('alice');
        // Should have at least 2 hops (3 nodes including repeated Alice)
        expect(path.nodes.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should limit maximum path length to avoid excessive computation', () => {
      // Use a high max hops value
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
              direction: 'outgoing',
              minHops: undefined,
              maxHops: 10 // High value, should be capped internally
            },
            node: {
              labels: ['person'],
              properties: {}
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should return paths but not hang or run into excessive computations
      expect(paths.length).toBeGreaterThan(0);
      // We can't precisely test the limit, but we can verify execution completes
    });
  });

  describe('Backtracking and Alternative Paths', () => {
    it('should find all possible paths between nodes', () => {
      // Find all paths from Alice to Dave
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
              direction: 'outgoing',
              minHops: undefined,
              maxHops: undefined
            },
            node: {
              labels: ['person'],
              properties: { name: 'Dave' }
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Multiple paths exist:
      // 1. Alice -> Bob -> Dave
      // 2. Alice -> Eve -> Dave (if such path exists)
      // 3. Other possibilities depending on the graph
      expect(paths.length).toBeGreaterThan(0);

      paths.forEach(path => {
        // Every path should start with Alice
        expect(path.nodes[0].id).toBe('alice');
        // Every path should end with Dave
        expect(path.nodes[path.nodes.length - 1].id).toBe('dave');
      });

      // Check if we found the Alice -> Bob -> Dave path
      const directPath = paths.find(path =>
        path.nodes.length === 3 &&
        path.nodes[0].id === 'alice' &&
        path.nodes[1].id === 'bob' &&
        path.nodes[2].id === 'dave'
      );
      expect(directPath).toBeDefined();
    });

    it('should backtrack when constraints are not met', () => {
      // Find paths from Alice to Dave where intermediate nodes have age > 30
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
              properties: { age: 40 } // Only Bob has age 40
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
              properties: { name: 'Dave' }
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should find exactly one path: Alice -> Bob -> Dave
      expect(paths.length).toBe(1);
      expect(paths[0].nodes.length).toBe(3);
      expect(paths[0].nodes[0].id).toBe('alice');
      expect(paths[0].nodes[1].id).toBe('bob');
      expect(paths[0].nodes[2].id).toBe('dave');
    });
  });

  describe('Complex Path Patterns', () => {
    it('should match multi-segment paths with different relationship types', () => {
      // Find paths: Person -> ASSIGNED -> Task -> BELONGS_TO -> Category
      const pathPattern: PathPattern = {
        start: {
          labels: ['person'],
          properties: {}
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
              properties: {}
            }
          },
          {
            relationship: {
              type: 'BELONGS_TO',
              properties: {},
              direction: 'outgoing'
            },
            node: {
              labels: ['category'],
              properties: {}
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should find paths for each person-task-category chain
      expect(paths.length).toBeGreaterThan(0);

      paths.forEach(path => {
        // Verify node types
        expect(path.nodes[0].label).toBe('person');
        expect(path.nodes[1].label).toBe('task');
        expect(path.nodes[2].label).toBe('category');

        // Verify relationship types
        expect(path.edges[0].label).toBe('ASSIGNED');
        expect(path.edges[1].label).toBe('BELONGS_TO');
      });
    });

    it('should match paths with property constraints at each step', () => {
      // Find paths: Active Person -> ASSIGNED -> Active Task -> BELONGS_TO -> Category with 'important' tag
      const pathPattern: PathPattern = {
        start: {
          labels: ['person'],
          properties: { active: true }
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
          },
          {
            relationship: {
              type: 'BELONGS_TO',
              properties: { primary: true },
              direction: 'outgoing'
            },
            node: {
              labels: ['category'],
              properties: {} // We'll check for the tag in the test
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should find matching paths
      expect(paths.length).toBeGreaterThan(0);

      paths.forEach(path => {
        // Verify node constraints
        expect(path.nodes[0].data.active).toBe(true);
        expect(path.nodes[1].data.active).toBe(true);

        // Verify relationship constraints
        expect(path.edges[1].data.primary).toBe(true);

        // Verify category has tags array
        const category = path.nodes[2];
        expect(Array.isArray(category.data.tags)).toBe(true);
      });
    });

    it('should handle complex path with both fixed and variable-length segments', () => {
      // Find paths: Alice -> KNOWS* -> any person -> WORKS_AT -> TechCorp
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
              direction: 'outgoing',
              minHops: undefined,
              maxHops: undefined
            },
            node: {
              labels: ['person'],
              properties: {}
            }
          },
          {
            relationship: {
              type: 'WORKS_AT',
              properties: {},
              direction: 'outgoing'
            },
            node: {
              labels: ['company'],
              properties: { name: 'TechCorp' }
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should find paths like:
      // 1. Alice -> WORKS_AT -> TechCorp
      // 2. Alice -> KNOWS -> Bob -> WORKS_AT -> TechCorp
      expect(paths.length).toBeGreaterThan(0);

      paths.forEach(path => {
        // First node should be Alice
        expect(path.nodes[0].id).toBe('alice');

        // Last node should be TechCorp
        expect(path.nodes[path.nodes.length - 1].id).toBe('techCorp');

        // Last relationship should be WORKS_AT
        expect(path.edges[path.edges.length - 1].label).toBe('WORKS_AT');
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty paths gracefully', () => {
      // Try to find a path that doesn't exist
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

    it('should avoid revisiting nodes in variable-length paths', () => {
      // Without cycle detection, this could create an infinite loop
      // A -> B -> C -> A -> B -> C -> ...
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
              direction: 'outgoing',
              minHops: 1,
              maxHops: 5
            },
            node: {
              labels: ['person'],
              properties: { name: 'Dave' }
            }
          }
        ]
      };

      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Should find paths without getting stuck in infinite loops
      expect(paths.length).toBeGreaterThan(0);

      // Check for duplicate nodes in each path (except for the target node if it matches criteria)
      paths.forEach(path => {
        const nodeIds = path.nodes.map(n => n.id);
        const uniqueNodeIds = new Set(nodeIds);

        // The number of unique nodes should be the same as the path length
        // Unless the target node appears elsewhere in the path
        expect(uniqueNodeIds.size).toBeGreaterThanOrEqual(nodeIds.length - 1);
      });
    });

    // Inside describe('Path Pattern Matching', () => { ... });
    // Or potentially a new describe block for complex cases

    it('should match paths with specific hop range (*2..2)', () => {
      // Find people exactly 2 KNOWS hops away from Alice
      const pathPattern: PathPattern = {
        start: { labels: ['person'], properties: { name: 'Alice' } },
        segments: [{
          relationship: { type: 'KNOWS', properties: {}, direction: 'outgoing', minHops: 2, maxHops: 2 },
          node: { labels: ['person'], properties: {} }
        }]
      };
      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Expected:
      // Alice -> Bob -> Charlie (2 hops)
      // Alice -> Bob -> Dave (2 hops)
      // Alice -> Charlie -> Eve (2 hops)
      // Alice -> Eve -> Alice (2 hops - cycle allowed at end)
      expect(paths.length).toBeGreaterThanOrEqual(4); // Could be more depending on traversal order if limits hit

      const twoHopNodes = paths.map(p => p.nodes[2].id);
      expect(twoHopNodes).toEqual(expect.arrayContaining(['charlie', 'dave', 'eve', 'alice']));
      paths.forEach(p => expect(p.nodes.length).toBe(3)); // Exactly 3 nodes for 2 hops
    });

    it('should match mixed fixed and variable paths', () => {
      // Find paths: Alice -> KNOWS (fixed) -> Person -> KNOWS*1..2 -> Eve
      const pathPattern: PathPattern = {
        start: { labels: ['person'], properties: { name: 'Alice' } },
        segments: [
          { // Segment 1: Fixed hop
            relationship: { type: 'KNOWS', properties: {}, direction: 'outgoing' /* min/max default to 1 */ },
            node: { labels: ['person'], properties: {} } // Intermediate person
          },
          { // Segment 2: Variable hop
            relationship: { type: 'KNOWS', properties: {}, direction: 'outgoing', minHops: 1, maxHops: 2 },
            node: { labels: ['person'], properties: { name: 'Eve' } } // Target Eve
          }
        ]
      };
      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Expected unique paths based on trace and stricter cycle check:
      const expectedPathsSet = new Set([
        'alice->charlie->eve',       // Seg2 = 1 hop, Total = 2 hops
        'alice->bob->charlie->eve', // Seg2 = 2 hops, Total = 3 hops
        'alice->bob->dave->eve',     // Seg2 = 2 hops, Total = 3 hops
      ]);

      // Check the length AFTER potential deduplication inside the function
      expect(paths).toHaveLength(expectedPathsSet.size); // Expect 3 unique paths

      const pathToString = (p: Path<any, any>) => p.nodes.map(n => n.id).join('->');
      const uniquePathStrings = new Set(paths.map(pathToString));

      expect(uniquePathStrings.size).toBe(expectedPathsSet.size); // Double check size
      expectedPathsSet.forEach(expectedStr => {
        expect(uniquePathStrings).toContain(expectedStr);
      });
    });

    it('should handle relationship type changes mid-path', () => {
      // Find paths: Person -> WORKS_AT -> Company <- WORKS_AT <- Person (Colleagues)
      const pathPattern: PathPattern = {
        start: { labels: ['person'], properties: { name: 'Alice' } },
        segments: [
          { // Alice works at TechCorp
            relationship: { type: 'WORKS_AT', properties: {}, direction: 'outgoing', maxHops: 1 },
            node: { labels: ['company'], properties: { name: 'TechCorp' } }
          },
          { // Someone else works at TechCorp
            relationship: { type: 'WORKS_AT', properties: {}, direction: 'incoming', maxHops: 1 }, // Note the direction change
            node: { labels: ['person'], properties: {} } // The colleague
          }
        ]
      };
      const paths = matcher.findMatchingPaths(graph, pathPattern);

      // Note that nothing prevents Alice from being her own colleague in this query
      // This could be solved with a WHERE clause if needed
      // Expected: 
      // - Alice -> TechCorp <- Alice
      // - Alice -> TechCorp <- Bob
      expect(paths).toHaveLength(2);
      expect(paths[0].edges[0].label).toBe('WORKS_AT');
      expect(paths[0].edges[1].label).toBe('WORKS_AT');
      expect(paths[0].nodes[0].id).toBe('alice');
      expect(paths[0].nodes[1].id).toBe('techCorp');
      expect(paths[0].nodes[2].id).toBe('alice');
      expect(paths[1].nodes[0].id).toBe('alice');
      expect(paths[1].nodes[1].id).toBe('techCorp');
      expect(paths[1].nodes[2].id).toBe('bob');
    });

    it('should return empty array when start node pattern doesnt match', () => {
      const pathPattern: PathPattern = {
        start: { labels: ['person'], properties: { name: 'NoSuchPerson' } }, // No node matches this
        segments: [{
          relationship: { type: 'KNOWS', properties: {}, direction: 'outgoing' },
          node: { labels: ['person'], properties: {} }
        }]
      };
      const paths = matcher.findMatchingPaths(graph, pathPattern);
      expect(paths).toHaveLength(0);
    });
  });
});