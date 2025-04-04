// __test__/graph-performance.test.ts
import { GraphImpl } from '../src/graph/graph';
import { Graph, Node, Edge } from '../src/graph/types';
import {
  Expression, NodePattern, RelationshipPattern, PathPattern,
  ComparisonOperator, LogicalOperator
} from '../src/rules/types';
import { PatternMatcherImpl } from '../src/rules/pattern-matcher';
import { PatternMatcherWithConditions } from '../src/rules/pattern-matcher-with-conditions';
import { BindingContextImpl } from '../src/rules/condition-evaluator';

/**
 * Performance test suite for graph operations
 * 
 * These tests evaluate the performance of graph operations with large graphs
 * They are not intended to run in normal test runs (they're marked with .skip)
 */

// tag with slow test
describe('Graph Performance', () => {
  // Define types for test data
  type TestNodeData = {
    type: string;
    name?: string;
    content?: string;
    tags?: string[];
    created?: Date;
    modified?: Date;
    priority?: number;
    completed?: boolean;
    links?: number;
  };

  type TestEdgeData = {
    type?: string;
    weight?: number;
    created?: Date;
    bidirectional?: boolean;
  };

  let graph: Graph<TestNodeData, TestEdgeData>;
  let patternMatcher: PatternMatcherImpl<TestNodeData, TestEdgeData>;
  let patternMatcherWithConditions: PatternMatcherWithConditions<TestNodeData, TestEdgeData>;

  // Performance test parameters
  const NODE_COUNT = 2000;        // Number of nodes to create
  const AVG_EDGES_PER_NODE = 10;  // Average number of edges per node
  const TAG_COUNT = 50;           // Number of unique tags
  const CONTENT_LENGTH = 200;     // Average content length in chars

  const NODE_TYPES = ['note', 'task', 'project', 'category', 'reference', 'person'];
  const EDGE_TYPES = ['links_to', 'contains', 'references', 'depends_on', 'assigned_to', 'tagged_with'];

  /**
   * Generate a large random graph for performance testing
   */
  function generateLargeGraph(): Graph<TestNodeData, TestEdgeData> {
    console.log(`Generating test graph with ${NODE_COUNT} nodes and ~${NODE_COUNT * AVG_EDGES_PER_NODE} edges...`);
    const startTime = performance.now();

    const newGraph = new GraphImpl<TestNodeData, TestEdgeData>();

    // Generate random nodes
    for (let i = 0; i < NODE_COUNT; i++) {
      const nodeType = NODE_TYPES[Math.floor(Math.random() * NODE_TYPES.length)];
      const nodeId = `${nodeType}_${i}`;

      // Generate random tags (0-5 tags per node)
      const tagCount = Math.floor(Math.random() * 6);
      const tags: string[] = [];
      for (let j = 0; j < tagCount; j++) {
        const tagId = `tag_${Math.floor(Math.random() * TAG_COUNT)}`;
        if (!tags.includes(tagId)) {
          tags.push(tagId);
        }
      }

      // Generate random content
      const contentLength = Math.floor(Math.random() * CONTENT_LENGTH) + 50;
      let content = '';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,;:!?-_';
      for (let j = 0; j < contentLength; j++) {
        content += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Create the node
      newGraph.addNode(nodeId, {
        type: nodeType,
        name: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} ${i}`,
        content,
        tags,
        created: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)), // Random date in last 30 days
        modified: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)), // Random date in last 7 days
        priority: Math.floor(Math.random() * 5) + 1, // 1-5
        completed: Math.random() > 0.7, // 30% chance of being completed
        links: 0 // Will be updated as we add edges
      });
    }

    // Generate random edges
    const allNodeIds = newGraph.getAllNodes().map(node => node.id);
    let totalEdges = 0;

    for (const sourceId of allNodeIds) {
      // Determine how many edges to create from this node (Poisson-like distribution)
      const edgeCount = Math.floor(Math.random() * AVG_EDGES_PER_NODE * 2);

      // Create unique set of target nodes
      const targetIds = new Set<string>();
      for (let i = 0; i < edgeCount; i++) {
        const targetId = allNodeIds[Math.floor(Math.random() * allNodeIds.length)];
        if (targetId !== sourceId) { // Avoid self-loops
          targetIds.add(targetId);
        }
      }

      // Create edges to target nodes
      for (const targetId of targetIds) {
        const edgeType = EDGE_TYPES[Math.floor(Math.random() * EDGE_TYPES.length)];
        const edgeData = {
          type: edgeType,
          weight: Math.floor(Math.random() * 10) + 1, // 1-10
          created: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)),
          bidirectional: Math.random() > 0.8 // 20% chance of being bidirectional
        };

        // Add the edge
        try {
          newGraph.addEdge(sourceId, targetId, edgeType, edgeData);
          totalEdges++;

          // Update link count on source node
          const sourceNode = newGraph.getNode(sourceId)!;
          newGraph.updateNode(sourceId, {
            ...sourceNode.data,
            links: (sourceNode.data.links || 0) + 1
          });

          // If bidirectional, add the reverse edge as well
          if (edgeData.bidirectional) {
            try {
              newGraph.addEdge(targetId, sourceId, edgeType, {
                ...edgeData,
                bidirectional: true
              });
              totalEdges++;

              // Update link count on target node
              const targetNode = newGraph.getNode(targetId)!;
              newGraph.updateNode(targetId, {
                ...targetNode.data,
                links: (targetNode.data.links || 0) + 1
              });
            } catch (e) {
              // Ignore duplicate edges
            }
          }
        } catch (e) {
          // Ignore duplicate edges
        }
      }
    }

    const endTime = performance.now();
    console.log(`Generated graph with ${newGraph.getAllNodes().length} nodes and ${totalEdges} edges in ${((endTime - startTime) / 1000).toFixed(2)}s`);

    return newGraph;
  }

  /**
   * Measure execution time of a function
   * @param fn Function to measure
   * @param name Name for reporting
   * @returns Result of the function
   */
  async function measureTime<T>(fn: () => T, name: string): Promise<T> {
    const startTime = performance.now();
    const result = fn();

    // Handle promise results
    if (result instanceof Promise) {
      return result.then(res => {
        const endTime = performance.now();
        console.log(`${name} took ${((endTime - startTime) / 1000).toFixed(4)}s`);
        return res;
      });
    }

    const endTime = performance.now();
    console.log(`${name} took ${((endTime - startTime) / 1000).toFixed(4)}s`);
    return result;
  }

  // Set up the test environment once before all tests
  beforeAll(() => {
    // Generate the test graph (or load from cache if available)
    try {
      graph = generateLargeGraph();
      patternMatcher = new PatternMatcherImpl<TestNodeData, TestEdgeData>();
      patternMatcherWithConditions = new PatternMatcherWithConditions<TestNodeData, TestEdgeData>();
    } catch (error) {
      console.error('Error setting up performance tests:', error);
      throw error;
    }
  });

  describe('Basic Graph Operations', () => {
    it('should quickly retrieve nodes by ID', () => {
      // Measure getNode performance
      const nodeIds = graph.getAllNodes().map(node => node.id).slice(0, 100);

      measureTime(() => {
        for (const nodeId of nodeIds) {
          graph.getNode(nodeId);
        }
      }, 'Retrieving 100 nodes by ID');
    });

    it('should efficiently find nodes by predicate', () => {
      // Find all task nodes
      measureTime(() => {
        const taskNodes = graph.findNodes(node => node.data.type === 'task');
        return taskNodes.length;
      }, 'Finding all task nodes');

      // Find completed high-priority tasks
      measureTime(() => {
        const highPriorityTasks = graph.findNodes(node =>
          node.data.type === 'task' &&
          node.data.priority === 1 &&
          node.data.completed === true
        );
        return highPriorityTasks.length;
      }, 'Finding completed high-priority tasks');
    });

    it('should quickly retrieve edges', () => {
      // Get all edges
      measureTime(() => {
        const allEdges = graph.getAllEdges();
        return allEdges.length;
      }, 'Getting all edges');

      // Find edges by type
      measureTime(() => {
        const dependsOnEdges = graph.findEdges(edge => edge.label === 'depends_on');
        return dependsOnEdges.length;
      }, 'Finding edges by type');
    });

    it('should efficiently find neighbors', () => {
      // Get a random node with many connections
      const wellConnectedNodes = graph.findNodes(node => (node.data.links || 0) > 10);
      if (wellConnectedNodes.length === 0) {
        console.log('No well-connected nodes found for neighbor test');
        return;
      }

      const testNode = wellConnectedNodes[0];
      console.log(`Testing neighbors for node ${testNode.id} with ~${testNode.data.links} connections`);

      // Get outgoing neighbors
      measureTime(() => {
        const outgoingNeighbors = graph.getNeighbors(testNode.id, 'outgoing');
        return outgoingNeighbors.length;
      }, 'Getting outgoing neighbors');

      // Get all neighbors (both directions)
      measureTime(() => {
        const allNeighbors = graph.getNeighbors(testNode.id, 'both');
        return allNeighbors.length;
      }, 'Getting all neighbors (both directions)');
    });
  });

  describe('Pattern Matching Performance', () => {
    it('should efficiently match basic node patterns', () => {
      // Match all task nodes
      measureTime(() => {
        const pattern: NodePattern = {
          labels: ['task'],
          properties: {}
        };

        const matches = patternMatcher.findMatchingNodes(graph, pattern);
        return matches.length;
      }, 'Finding all task nodes with pattern matcher');

      // Match tasks with specific properties
      measureTime(() => {
        const pattern: NodePattern = {
          labels: ['task'],
          properties: { priority: 1, completed: true }
        };

        const matches = patternMatcher.findMatchingNodes(graph, pattern);
        return matches.length;
      }, 'Finding high-priority completed tasks with pattern matcher');
    });

    it('should efficiently match relationship patterns', () => {
      // Find 'depends_on' relationships
      measureTime(() => {
        const pattern: RelationshipPattern = {
          type: 'depends_on',
          properties: {},
          direction: 'both'
        };

        const matches = patternMatcher.findMatchingRelationships(graph, pattern);
        return matches.length;
      }, 'Finding depends_on relationships');

      // Find weighted relationships
      measureTime(() => {
        const pattern: RelationshipPattern = {
          properties: { weight: 10 }, // Maximum weight
          direction: 'outgoing'
        };

        const matches = patternMatcher.findMatchingRelationships(graph, pattern);
        return matches.length;
      }, 'Finding maximum weight relationships');
    });

    it('should handle simple path patterns reasonably quickly', () => {
      // Find task -> project paths
      measureTime(() => {
        const pattern: PathPattern = {
          start: {
            labels: ['task'],
            properties: { completed: false }
          },
          segments: [
            {
              relationship: {
                type: 'belongs_to',
                properties: {},
                direction: 'outgoing'
              },
              node: {
                labels: ['project'],
                properties: {}
              }
            }
          ]
        };

        const matches = patternMatcher.findMatchingPaths(graph, pattern);
        return matches.length;
      }, 'Finding incomplete task -> project paths');
    });

    it('should handle multi-hop path patterns', () => {
      // Find note -> note -> note paths (2 hops)
      measureTime(() => {
        const pattern: PathPattern = {
          start: {
            labels: ['note'],
            properties: {}
          },
          segments: [
            {
              relationship: {
                type: 'links_to',
                properties: {},
                direction: 'outgoing'
              },
              node: {
                labels: ['note'],
                properties: {}
              }
            },
            {
              relationship: {
                type: 'links_to',
                properties: {},
                direction: 'outgoing'
              },
              node: {
                labels: ['note'],
                properties: {}
              }
            }
          ]
        };

        const matches = patternMatcher.findMatchingPaths(graph, pattern);
        return matches.length;
      }, 'Finding note -> note -> note paths (2 hops)');
    });
  });

  describe('Condition Evaluation Performance', () => {
    it('should efficiently evaluate simple conditions', () => {
      // Get a sample of nodes for testing
      const sampleNodes = graph.getAllNodes().slice(0, 100);

      // Create a simple condition: node.type = 'task'
      const condition: Expression = {
        type: 'comparison',
        left: {
          type: 'property',
          object: { type: 'variable', name: 'n' },
          property: 'type'
        },
        operator: ComparisonOperator.EQUALS,
        right: {
          type: 'literal',
          value: 'task',
          dataType: 'string'
        }
      };

      measureTime(() => {
        let matchCount = 0;
        for (const node of sampleNodes) {
          const bindings = new BindingContextImpl<TestNodeData, TestEdgeData>();
          bindings.set('n', node);

          if (patternMatcherWithConditions.getConditionEvaluator().evaluateCondition(graph, condition, bindings)) {
            matchCount++;
          }
        }
        return matchCount;
      }, 'Evaluating simple condition on 100 nodes');
    });

    it('should efficiently evaluate complex conditions', () => {
      // Get a sample of nodes for testing
      const sampleNodes = graph.getAllNodes().slice(0, 100);

      // Create a complex condition: node.type = 'task' AND (node.priority <= 3 OR node.completed = true)
      const condition: Expression = {
        type: 'logical',
        operator: LogicalOperator.AND,
        operands: [
          {
            type: 'comparison',
            left: {
              type: 'property',
              object: { type: 'variable', name: 'n' },
              property: 'type'
            },
            operator: ComparisonOperator.EQUALS,
            right: {
              type: 'literal',
              value: 'task',
              dataType: 'string'
            }
          },
          {
            type: 'logical',
            operator: LogicalOperator.OR,
            operands: [
              {
                type: 'comparison',
                left: {
                  type: 'property',
                  object: { type: 'variable', name: 'n' },
                  property: 'priority'
                },
                operator: ComparisonOperator.LESS_THAN_OR_EQUALS,
                right: {
                  type: 'literal',
                  value: 3,
                  dataType: 'number'
                }
              },
              {
                type: 'comparison',
                left: {
                  type: 'property',
                  object: { type: 'variable', name: 'n' },
                  property: 'completed'
                },
                operator: ComparisonOperator.EQUALS,
                right: {
                  type: 'literal',
                  value: true,
                  dataType: 'boolean'
                }
              }
            ]
          }
        ]
      };

      measureTime(() => {
        let matchCount = 0;
        for (const node of sampleNodes) {
          const bindings = new BindingContextImpl<TestNodeData, TestEdgeData>();
          bindings.set('n', node);

          if (patternMatcherWithConditions.getConditionEvaluator().evaluateCondition(graph, condition, bindings)) {
            matchCount++;
          }
        }
        return matchCount;
      }, 'Evaluating complex condition on 100 nodes');
    });

    it('should handle combined pattern matching and condition evaluation', () => {
      // Find tasks and filter with condition
      measureTime(() => {
        // First find matching nodes
        const pattern: NodePattern = {
          labels: ['task'],
          properties: {}
        };

        const matchingNodes = patternMatcher.findMatchingNodes(graph, pattern);

        // Then apply condition
        const condition: Expression = {
          type: 'logical',
          operator: LogicalOperator.OR,
          operands: [
            {
              type: 'comparison',
              left: {
                type: 'property',
                object: { type: 'variable', name: 'n' },
                property: 'priority'
              },
              operator: ComparisonOperator.LESS_THAN_OR_EQUALS,
              right: {
                type: 'literal',
                value: 2,
                dataType: 'number'
              }
            },
            {
              type: 'comparison',
              left: {
                type: 'property',
                object: { type: 'variable', name: 'n' },
                property: 'completed'
              },
              operator: ComparisonOperator.EQUALS,
              right: {
                type: 'literal',
                value: true,
                dataType: 'boolean'
              }
            }
          ]
        };

        let filteredCount = 0;
        for (const node of matchingNodes) {
          const bindings = new BindingContextImpl<TestNodeData, TestEdgeData>();
          bindings.set('n', node);

          if (patternMatcherWithConditions.getConditionEvaluator().evaluateCondition(graph, condition, bindings)) {
            filteredCount++;
          }
        }

        return {
          total: matchingNodes.length,
          filtered: filteredCount
        };
      }, 'Combined pattern matching and condition filtering');

      // Use the combined pattern matcher with conditions
      measureTime(() => {
        const pattern: NodePattern = {
          labels: ['task'],
          properties: {}
        };

        const condition: Expression = {
          type: 'logical',
          operator: LogicalOperator.OR,
          operands: [
            {
              type: 'comparison',
              left: {
                type: 'property',
                object: { type: 'variable', name: 'n' },
                property: 'priority'
              },
              operator: ComparisonOperator.LESS_THAN_OR_EQUALS,
              right: {
                type: 'literal',
                value: 2,
                dataType: 'number'
              }
            },
            {
              type: 'comparison',
              left: {
                type: 'property',
                object: { type: 'variable', name: 'n' },
                property: 'completed'
              },
              operator: ComparisonOperator.EQUALS,
              right: {
                type: 'literal',
                value: true,
                dataType: 'boolean'
              }
            }
          ]
        };

        const matches = patternMatcherWithConditions.findMatchingNodesWithCondition(
          graph,
          pattern,
          condition
        );

        return matches.length;
      }, 'Using combined PatternMatcherWithConditions');
    });

    it('should handle EXISTS expressions', () => {
      // Find nodes with outgoing links
      measureTime(() => {
        // Get a sample of nodes
        const sampleNodes = graph.getAllNodes().slice(0, 50);

        // Create an EXISTS expression
        const existsExpr: Expression = {
          type: 'exists',
          positive: true,
          pattern: {
            start: {
              variable: 'n',
              labels: [],
              properties: {}
            },
            segments: [
              {
                relationship: {
                  type: 'links_to',
                  properties: {},
                  direction: 'outgoing'
                },
                node: {
                  labels: [],
                  properties: {}
                }
              }
            ]
          }
        };

        let matchCount = 0;
        for (const node of sampleNodes) {
          const bindings = new BindingContextImpl<TestNodeData, TestEdgeData>();
          bindings.set('n', node);

          if (patternMatcherWithConditions.getConditionEvaluator().evaluateCondition(graph, existsExpr, bindings)) {
            matchCount++;
          }
        }

        return matchCount;
      }, 'Evaluating EXISTS expression on 50 nodes');
    });
  });

  describe('Memory Usage', () => {
    it('should report memory usage', () => {
      if (global.gc) {
        global.gc(); // Force garbage collection if available
      }

      const formatMemory = (bytes: number) => {
        const mb = bytes / 1024 / 1024;
        return `${mb.toFixed(2)} MB`;
      };

      // Use Node.js process.memoryUsage if available
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memoryUsage = process.memoryUsage();
        console.log('Memory Usage:');
        console.log(`- RSS: ${formatMemory(memoryUsage.rss)}`);
        console.log(`- Heap Total: ${formatMemory(memoryUsage.heapTotal)}`);
        console.log(`- Heap Used: ${formatMemory(memoryUsage.heapUsed)}`);
        console.log(`- External: ${formatMemory(memoryUsage.external)}`);
      } else {
        console.log('Memory usage information not available');
      }

      // Simple size estimate for the graph
      const nodeCount = graph.getAllNodes().length;
      const edgeCount = graph.getAllEdges().length;

      // Very rough estimation
      const estimatedSize = (nodeCount * 500) + (edgeCount * 200); // ~500 bytes per node, ~200 per edge
      console.log(`Estimated graph size: ${formatMemory(estimatedSize)}`);

      expect(true).toBe(true); // Dummy assertion
    });
  });
});

// Run the test directly if not being run as part of Jest
if (typeof jest === 'undefined') {
  describe.skip = describe; // Enable the tests
  beforeAll(() => { });
  it = test;

  // Run the performance tests
  console.log('Running performance tests directly...');
  describe('Graph Performance', () => { });
}