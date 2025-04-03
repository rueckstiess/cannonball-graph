import { Graph, Node, Edge, NodeId, PathOptions, GraphData } from '@/graph/types';
import { GraphImpl } from '@/graph/graph';

describe('Graph', () => {
  let graph: Graph<{ type: string, name: string }, { weight: number }>;

  beforeEach(() => {
    graph = new GraphImpl();
  });

  describe('Node operations', () => {
    it('should add and retrieve a node', () => {
      graph.addNode('n1', { type: 'person', name: 'Alice' });
      expect(graph.hasNode('n1')).toBe(true);

      const node = graph.getNode('n1');
      expect(node).toBeDefined();
      expect(node?.id).toBe('n1');
      expect(node?.data.name).toBe('Alice');
      expect(node?.data.type).toBe('person');
    });

    it('should return undefined for non-existent node', () => {
      expect(graph.getNode('nonexistent')).toBeUndefined();
      expect(graph.hasNode('nonexistent')).toBe(false);
    });

    it('should update a node', () => {
      graph.addNode('n1', { type: 'person', name: 'Alice' });
      const result = graph.updateNode('n1', { type: 'person', name: 'Alicia' });

      expect(result).toBe(true);
      expect(graph.getNode('n1')?.data.name).toBe('Alicia');
    });

    it('should return false when updating non-existent node', () => {
      const result = graph.updateNode('nonexistent', { type: 'person', name: 'Nobody' });
      expect(result).toBe(false);
    });

    it('should remove a node', () => {
      graph.addNode('n1', { type: 'person', name: 'Alice' });
      const result = graph.removeNode('n1');

      expect(result).toBe(true);
      expect(graph.hasNode('n1')).toBe(false);
    });

    it('should return false when removing non-existent node', () => {
      const result = graph.removeNode('nonexistent');
      expect(result).toBe(false);
    });

    it('should get all nodes', () => {
      graph.addNode('n1', { type: 'person', name: 'Alice' });
      graph.addNode('n2', { type: 'person', name: 'Bob' });

      const nodes = graph.getAllNodes();
      expect(nodes.length).toBe(2);
      expect(nodes.some(n => n.id === 'n1')).toBe(true);
      expect(nodes.some(n => n.id === 'n2')).toBe(true);
    });

    it('should find nodes with predicate', () => {
      graph.addNode('n1', { type: 'person', name: 'Alice' });
      graph.addNode('n2', { type: 'person', name: 'Bob' });
      graph.addNode('n3', { type: 'robot', name: 'R2D2' });

      const people = graph.findNodes(n => n.data.type === 'person');
      expect(people.length).toBe(2);

      const bobNode = graph.findNodes(n => n.data.name === 'Bob');
      expect(bobNode.length).toBe(1);
      expect(bobNode[0].id).toBe('n2');
    });

    it('should handle adding a node with existing ID', () => {
      graph.addNode('n1', { type: 'person', name: 'Alice' });

      // This should either throw or update the existing node
      expect(() => {
        graph.addNode('n1', { type: 'person', name: 'Alice 2.0' });
      }).toThrow();

      // Node should retain original data
      expect(graph.getNode('n1')?.data.name).toBe('Alice');
    });
  });

  describe('Edge operations', () => {
    beforeEach(() => {
      graph.addNode('n1', { type: 'person', name: 'Alice' });
      graph.addNode('n2', { type: 'person', name: 'Bob' });
      graph.addNode('n3', { type: 'person', name: 'Charlie' });
    });

    it('should add and retrieve an edge', () => {
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });

      expect(graph.hasEdge('n1', 'n2', 'KNOWS')).toBe(true);

      const edge = graph.getEdge('n1', 'n2', 'KNOWS');
      expect(edge).toBeDefined();
      expect(edge?.source).toBe('n1');
      expect(edge?.target).toBe('n2');
      expect(edge?.label).toBe('KNOWS');
      expect(edge?.data.weight).toBe(5);
    });

    it('should return undefined for non-existent edge', () => {
      expect(graph.getEdge('n1', 'n2', 'NONEXISTENT')).toBeUndefined();
      expect(graph.hasEdge('n1', 'n2', 'NONEXISTENT')).toBe(false);
    });

    it('should check edge existence with optional label', () => {
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });
      graph.addEdge('n1', 'n2', 'WORKS_WITH', { weight: 3 });

      // Check with specific label
      expect(graph.hasEdge('n1', 'n2', 'KNOWS')).toBe(true);
      expect(graph.hasEdge('n1', 'n2', 'WORKS_WITH')).toBe(true);
      expect(graph.hasEdge('n1', 'n2', 'NONEXISTENT')).toBe(false);

      // Check any edge between nodes
      expect(graph.hasEdge('n1', 'n2')).toBe(true);
      expect(graph.hasEdge('n1', 'n3')).toBe(false);
    });

    it('should update an edge', () => {
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });
      const result = graph.updateEdge('n1', 'n2', 'KNOWS', { weight: 10 });

      expect(result).toBe(true);
      expect(graph.getEdge('n1', 'n2', 'KNOWS')?.data.weight).toBe(10);
    });

    it('should return false when updating non-existent edge', () => {
      const result = graph.updateEdge('n1', 'n2', 'NONEXISTENT', { weight: 10 });
      expect(result).toBe(false);
    });

    it('should remove an edge with specific label', () => {
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });
      graph.addEdge('n1', 'n2', 'WORKS_WITH', { weight: 3 });

      const result = graph.removeEdge('n1', 'n2', 'KNOWS');

      expect(result).toBe(true);
      expect(graph.hasEdge('n1', 'n2', 'KNOWS')).toBe(false);
      expect(graph.hasEdge('n1', 'n2', 'WORKS_WITH')).toBe(true);
    });

    it('should remove all edges between nodes when label is not specified', () => {
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });
      graph.addEdge('n1', 'n2', 'WORKS_WITH', { weight: 3 });

      const result = graph.removeEdge('n1', 'n2');

      expect(result).toBe(true);
      expect(graph.hasEdge('n1', 'n2')).toBe(false);
    });

    it('should return false when removing non-existent edge', () => {
      const result = graph.removeEdge('n1', 'n2', 'NONEXISTENT');
      expect(result).toBe(false);
    });

    it('should get all edges', () => {
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });
      graph.addEdge('n2', 'n3', 'KNOWS', { weight: 3 });

      const edges = graph.getAllEdges();
      expect(edges.length).toBe(2);

      // Check that both edges are present
      const edgeN1N2 = edges.find(e => e.source === 'n1' && e.target === 'n2');
      const edgeN2N3 = edges.find(e => e.source === 'n2' && e.target === 'n3');

      expect(edgeN1N2).toBeDefined();
      expect(edgeN2N3).toBeDefined();
      expect(edgeN1N2?.data.weight).toBe(5);
      expect(edgeN2N3?.data.weight).toBe(3);
    });

    it('should find edges with predicate', () => {
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });
      graph.addEdge('n2', 'n3', 'KNOWS', { weight: 2 });

      const heavyEdges = graph.findEdges(e => e.data.weight > 3);
      expect(heavyEdges.length).toBe(1);
      expect(heavyEdges[0].source).toBe('n1');
      expect(heavyEdges[0].target).toBe('n2');
    });

    it('should handle adding an edge between non-existent nodes', () => {
      expect(() => {
        graph.addEdge('nonexistent1', 'n2', 'KNOWS', { weight: 5 });
      }).toThrow();

      expect(() => {
        graph.addEdge('n1', 'nonexistent2', 'KNOWS', { weight: 5 });
      }).toThrow();
    });

    it('should handle adding duplicate edge', () => {
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });

      // This should either throw or update the existing edge
      expect(() => {
        graph.addEdge('n1', 'n2', 'KNOWS', { weight: 10 });
      }).toThrow();

      // Edge should retain original data
      expect(graph.getEdge('n1', 'n2', 'KNOWS')?.data.weight).toBe(5);
    });

    it('should remove associated edges when a node is removed', () => {
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });
      graph.addEdge('n2', 'n1', 'KNOWS', { weight: 3 });

      graph.removeNode('n1');

      expect(graph.hasEdge('n1', 'n2')).toBe(false);
      expect(graph.hasEdge('n2', 'n1')).toBe(false);

      // n2 should still exist
      expect(graph.hasNode('n2')).toBe(true);
    });
  });

  describe('Traversal operations', () => {
    beforeEach(() => {
      // Set up a small network
      graph.addNode('a', { type: 'person', name: 'Alice' });
      graph.addNode('b', { type: 'person', name: 'Bob' });
      graph.addNode('c', { type: 'person', name: 'Charlie' });
      graph.addNode('d', { type: 'person', name: 'Dave' });

      graph.addEdge('a', 'b', 'KNOWS', { weight: 5 });
      graph.addEdge('b', 'c', 'KNOWS', { weight: 3 });
      graph.addEdge('c', 'd', 'KNOWS', { weight: 1 });
      graph.addEdge('b', 'a', 'TRUSTS', { weight: 2 });
    });

    it('should get outgoing neighbors', () => {
      const neighbors = graph.getNeighbors('b', 'outgoing');
      expect(neighbors.length).toBe(2);
      expect(neighbors[0].id).toBe('c');
      expect(neighbors[1].id).toBe('a');
    });

    it('should get incoming neighbors', () => {
      const neighbors = graph.getNeighbors('b', 'incoming');
      expect(neighbors.length).toBe(1);
      expect(neighbors[0].id).toBe('a');
    });

    it('should get all neighbors (both directions)', () => {
      const neighbors = graph.getNeighbors('b', 'both');
      expect(neighbors.length).toBe(2);
      expect(neighbors.some(n => n.id === 'a')).toBe(true);
      expect(neighbors.some(n => n.id === 'c')).toBe(true);
    });

    it('should get outgoing edges for a node', () => {
      const edges = graph.getEdgesForNode('b', 'outgoing');
      expect(edges.length).toBe(2);
      expect(edges[0].target).toBe('c');
      expect(edges[0].label).toBe('KNOWS');
      expect(edges[1].target).toBe('a');
      expect(edges[1].label).toBe('TRUSTS');
    });

    it('should get incoming edges for a node', () => {
      const edges = graph.getEdgesForNode('b', 'incoming');
      expect(edges.length).toBe(1);
      expect(edges[0].source).toBe('a');
      expect(edges[0].label).toBe('KNOWS');
    });

    it('should get all edges for a node (both directions)', () => {
      const edges = graph.getEdgesForNode('b', 'both');
      // two knows, one trusts
      expect(edges.length).toBe(3);

      // Check that both edges are present
      const incomingKnows = edges.find(e => e.source === 'a' && e.target === 'b');
      const outgoingKnows = edges.find(e => e.source === 'b' && e.target === 'c');
      const outgoingTrusts = edges.find(e => e.source === 'b' && e.target === 'a');

      expect(incomingKnows).toBeDefined();
      expect(outgoingKnows).toBeDefined();
      expect(outgoingTrusts).toBeDefined();
    });

    it('should find paths between nodes', () => {
      const paths = graph.findPaths('a', 'd', {
        relationshipTypes: ['KNOWS'],
        direction: 'outgoing'
      });

      expect(paths.length).toBe(1);
      expect(paths[0]).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should respect maxDepth in path finding', () => {
      // Should find no path with depth limit of 2
      const limitedPaths = graph.findPaths('a', 'd', {
        maxDepth: 2,
        relationshipTypes: ['KNOWS'],
        direction: 'outgoing'
      });

      expect(limitedPaths.length).toBe(0);

      // Should find path with depth limit of 3
      const validPaths = graph.findPaths('a', 'd', {
        maxDepth: 3,
        relationshipTypes: ['KNOWS'],
        direction: 'outgoing'
      });

      expect(validPaths.length).toBe(1);
    });

    it('should respect relationship types in path finding', () => {
      // Add a direct path with different relationship
      graph.addEdge('a', 'd', 'WORKS_WITH', { weight: 1 });

      // Should only find KNOWS path
      const knowsPaths = graph.findPaths('a', 'd', {
        relationshipTypes: ['KNOWS'],
        direction: 'outgoing'
      });

      expect(knowsPaths.length).toBe(1);
      expect(knowsPaths[0].length).toBe(4); // a -> b -> c -> d

      // Should only find WORKS_WITH path
      const worksPaths = graph.findPaths('a', 'd', {
        relationshipTypes: ['WORKS_WITH'],
        direction: 'outgoing'
      });

      expect(worksPaths.length).toBe(1);
      expect(worksPaths[0].length).toBe(2); // a -> d

      // Should find both paths with multiple relationship types
      const allPaths = graph.findPaths('a', 'd', {
        relationshipTypes: ['KNOWS', 'WORKS_WITH'],
        direction: 'outgoing'
      });

      expect(allPaths.length).toBe(2);
    });
  });

  describe('Graph-wide operations', () => {
    beforeEach(() => {
      graph.addNode('n1', { type: 'person', name: 'Alice' });
      graph.addNode('n2', { type: 'person', name: 'Bob' });
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });
    });

    it('should clear the graph', () => {
      graph.clear();

      expect(graph.getAllNodes().length).toBe(0);
      expect(graph.getAllEdges().length).toBe(0);
      expect(graph.hasNode('n1')).toBe(false);
    });

    it('should serialize to JSON', () => {
      const json = graph.toJSON();

      expect(json.nodes).toBeDefined();
      expect(json.edges).toBeDefined();

      expect(Object.keys(json.nodes).length).toBe(2);
      expect(json.edges.length).toBe(1);

      expect(json.nodes['n1']).toEqual({ type: 'person', name: 'Alice' });
      expect(json.edges[0]).toEqual({
        source: 'n1',
        target: 'n2',
        label: 'KNOWS',
        data: { weight: 5 }
      });
    });

    it('should deserialize from JSON', () => {
      const json: GraphData<{ type: string, name: string }, { weight: number }> = {
        nodes: {
          'x1': { type: 'robot', name: 'XBot' },
          'x2': { type: 'robot', name: 'YBot' }
        },
        edges: [
          { source: 'x1', target: 'x2', label: 'CONNECTED_TO', data: { weight: 10 } }
        ]
      };

      graph.clear();
      graph.fromJSON(json);

      expect(graph.getAllNodes().length).toBe(2);
      expect(graph.getAllEdges().length).toBe(1);

      expect(graph.hasNode('x1')).toBe(true);
      expect(graph.getNode('x1')?.data.name).toBe('XBot');

      expect(graph.hasEdge('x1', 'x2', 'CONNECTED_TO')).toBe(true);
      expect(graph.getEdge('x1', 'x2', 'CONNECTED_TO')?.data.weight).toBe(10);
    });
  });
});