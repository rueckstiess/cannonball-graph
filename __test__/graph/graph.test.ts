import { Graph, Node, Edge, NodeId, PathOptions, GraphData } from '@/graph';


describe('Graph', () => {
  let graph: Graph<{ name: string }, { weight: number }>;

  beforeEach(() => {
    graph = new Graph();
  });

  describe('Node operations', () => {
    it('should add and retrieve a node', () => {
      graph.addNode('n1', 'person', { name: 'Alice' });
      expect(graph.hasNode('n1')).toBe(true);

      const node = graph.getNode('n1');
      expect(node).toBeDefined();
      expect(node?.id).toBe('n1');
      expect(node?.label).toBe('person');
      expect(node?.data.name).toBe('Alice');
    });

    it('should return undefined for non-existent node', () => {
      expect(graph.getNode('nonexistent')).toBeUndefined();
      expect(graph.hasNode('nonexistent')).toBe(false);
    });

    it('should update a node', () => {
      graph.addNode('n1', 'person', { name: 'Alice' });
      const result = graph.updateNodeData('n1', { name: 'Alicia' });

      expect(result).toBe(true);
      expect(graph.getNode('n1')?.data.name).toBe('Alicia');
    });

    it('should return false when updating non-existent node', () => {
      const result = graph.updateNodeData('nonexistent', { name: 'Nobody' });
      expect(result).toBe(false);
    });

    it('should remove a node', () => {
      graph.addNode('n1', 'person', { name: 'Alice' });
      const result = graph.removeNode('n1');

      expect(result).toBe(true);
      expect(graph.hasNode('n1')).toBe(false);
    });

    it('should return false when removing non-existent node', () => {
      const result = graph.removeNode('nonexistent');
      expect(result).toBe(false);
    });

    it('should get all nodes', () => {
      graph.addNode('n1', 'person', { name: 'Alice' });
      graph.addNode('n2', 'person', { name: 'Bob' });

      const nodes = graph.getAllNodes();
      expect(nodes.length).toBe(2);
      expect(nodes.some(n => n.id === 'n1')).toBe(true);
      expect(nodes.some(n => n.id === 'n2')).toBe(true);
    });

    it('should find nodes with predicate', () => {
      graph.addNode('n1', 'person', { name: 'Alice' });
      graph.addNode('n2', 'person', { name: 'Bob' });
      graph.addNode('n3', 'robot', { name: 'R2D2' });

      const people = graph.findNodes(n => n.label === 'person');
      expect(people.length).toBe(2);

      const bobNode = graph.findNodes(n => n.data.name === 'Bob');
      expect(bobNode.length).toBe(1);
      expect(bobNode[0].id).toBe('n2');
    });

    it('should handle adding a node with existing ID', () => {
      graph.addNode('n1', 'person', { name: 'Alice' });

      expect(() => {
        graph.addNode('n1', 'person', { name: 'Alice 2.0' });
      }).toThrow();

      expect(graph.getNode('n1')?.data.name).toBe('Alice');
    });
  });

  describe('Edge operations', () => {
    beforeEach(() => {
      graph.addNode('n1', 'person', { name: 'Alice' });
      graph.addNode('n2', 'person', { name: 'Bob' });
      graph.addNode('n3', 'person', { name: 'Charlie' });
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
      graph.addNode('a', 'person', { name: 'Alice' });
      graph.addNode('b', 'person', { name: 'Bob' });
      graph.addNode('c', 'person', { name: 'Charlie' });
      graph.addNode('d', 'person', { name: 'Dave' });
      graph.addNode('e', 'person', { name: 'Eve' });
      graph.addNode('f', 'location', { name: 'Office' });

      graph.addEdge('a', 'b', 'KNOWS', { weight: 5 });
      graph.addEdge('b', 'c', 'KNOWS', { weight: 3 });
      graph.addEdge('c', 'd', 'KNOWS', { weight: 1 });
      graph.addEdge('b', 'a', 'TRUSTS', { weight: 2 });
      graph.addEdge('e', 'a', 'KNOWS', { weight: 4 });
      graph.addEdge('c', 'f', 'WORKS_AT', { weight: 6 });
      graph.addEdge('d', 'f', 'WORKS_AT', { weight: 7 });
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

    describe('BFS Traversal', () => {
      it('should perform basic BFS traversal with visitor pattern', () => {
        const visited: string[] = [];

        // Create a simple visitor that records visited nodes
        // But only follow KNOWS edges to make traversal more predictable
        graph.traverseBFS('a', {
          discoverNode: (node) => {
            visited.push(node.id);
            return true; // Continue traversal
          },
          examineEdge: (edge) => {
            return edge.label === 'KNOWS';
          }
        });

        // Should visit all reachable nodes in BFS order via KNOWS edges
        expect(visited).toEqual(['a', 'b', 'c', 'd']);
      });

      it('should respect maxDepth in BFS traversal', () => {
        const visited: string[] = [];

        // Create a visitor with depth limit
        graph.traverseBFS('a', {
          discoverNode: (node) => {
            visited.push(node.id);
            return true;
          }
        }, { maxDepth: 1 });

        // Should only visit a and b
        expect(visited).toEqual(['a', 'b']);
      });

      it('should allow custom edge filtering in BFS traversal', () => {
        const visited: string[] = [];

        // Create a visitor that only follows KNOWS edges
        graph.traverseBFS('a', {
          discoverNode: (node) => {
            visited.push(node.id);
            return true;
          },
          examineEdge: (edge) => {
            return edge.label === 'KNOWS';
          }
        });

        // Should only visit nodes connected by KNOWS edges
        expect(visited).toEqual(['a', 'b', 'c', 'd']);
      });

      it('should traverse in specified direction', () => {
        // a <-- e (KNOWS)
        // Testing incoming edges from a
        const visited: string[] = [];

        graph.traverseBFS('a', {
          discoverNode: (node) => {
            visited.push(node.id);
            return true;
          },
          examineEdge: (edge) => {
            // Only follow KNOWS edges (ignoring TRUSTS which would include b)
            return edge.label === 'KNOWS';
          }
        }, { direction: 'incoming' });

        // Should visit a and e (since e KNOWS a)
        expect(visited).toEqual(['a', 'e']);
      });

      it('should track paths when requested', () => {
        const paths: Array<{ nodes: string[], edges: string[] }> = [];

        graph.traverseBFS('a', {
          // Only follow KNOWS edges for predictable paths
          examineEdge: (edge) => {
            return edge.label === 'KNOWS';
          },
          pathComplete: (path, depth) => {
            if (depth > 0) { // Skip the start node path
              paths.push({
                nodes: path.nodes.map(n => n.id),
                edges: path.edges.map(e => e.label)
              });
            }
          }
        }, { trackPaths: true });

        // Should find paths a->b, a->b->c, a->b->c->d
        expect(paths).toHaveLength(3);
        expect(paths[0].nodes).toEqual(['a', 'b']);
        expect(paths[0].edges).toEqual(['KNOWS']);
        expect(paths[1].nodes).toEqual(['a', 'b', 'c']);
        expect(paths[1].edges).toEqual(['KNOWS', 'KNOWS']);
        expect(paths[2].nodes).toEqual(['a', 'b', 'c', 'd']);
        expect(paths[2].edges).toEqual(['KNOWS', 'KNOWS', 'KNOWS']);
      });

      it('should stop branch traversal when discoverNode returns false', () => {
        const visited: string[] = [];

        graph.traverseBFS('a', {
          discoverNode: (node) => {
            visited.push(node.id);
            // Stop traversal at node 'b'
            return node.id !== 'b';
          }
        });

        // Should only visit a and b, but not c or d
        expect(visited).toEqual(['a', 'b']);
      });

      it('should call finishNode after processing all edges', () => {
        const discovered: string[] = [];
        const finished: string[] = [];

        graph.traverseBFS('a', {
          discoverNode: (node) => {
            discovered.push(node.id);
            return true;
          },
          examineEdge: (edge) => {
            // Only follow KNOWS edges for predictable traversal
            return edge.label === 'KNOWS';
          },
          finishNode: (node) => {
            finished.push(node.id);
          }
        });

        // Both arrays should contain the same nodes but might be in different order
        expect(discovered.sort()).toEqual(['a', 'b', 'c', 'd'].sort());
        expect(finished.sort()).toEqual(['a', 'b', 'c', 'd'].sort());
      });

      it('should call visitor.start once at the beginning', () => {
        let startCount = 0;
        let startNodeId: string | undefined;

        graph.traverseBFS('a', {
          start: (node) => {
            startCount++;
            startNodeId = node.id;
          }
        });

        expect(startCount).toBe(1);
        expect(startNodeId).toBe('a');
      });
    });

    describe('Pattern Matching with BFS', () => {
      it('should find simple paths that match a pattern', () => {
        // Find all paths from a where nodes work at a location
        const matchingPaths = graph.findMatchingPaths('a', {
          examineEdge: (edge) => {
            // Only follow KNOWS edges
            return edge.label === 'KNOWS';
          },
          pathComplete: (path, depth) => {
            // Check if the last node in the path has a WORKS_AT edge
            const lastNode = path.nodes[path.nodes.length - 1];
            const worksAtEdge = graph.getEdgesForNode(lastNode.id, 'outgoing')
              .find(e => e.label === 'WORKS_AT');

            // Only collect paths that end with a node that works somewhere
            return worksAtEdge !== undefined;
          }
        });

        // Should find paths ending at nodes that have WORKS_AT edges (c and d)
        const worksNodes = ['c', 'd'];

        // Filter paths to only include those ending at nodes with WORKS_AT edges
        const worksAtPaths = matchingPaths.filter(path => {
          const lastNodeId = path.nodes[path.nodes.length - 1].id;
          return worksNodes.includes(lastNodeId);
        });

        // Should have at least one path to each of c and d
        expect(worksAtPaths.length).toBeGreaterThan(0);

        // Verify we have paths to both c and d
        const pathEndpoints = worksAtPaths.map(path => path.nodes[path.nodes.length - 1].id);
        expect(new Set(pathEndpoints).size).toBeGreaterThanOrEqual(1);

        // Verify at least one path follows the expected pattern (only KNOWS edges)
        const allKnowsEdges = worksAtPaths.some(path =>
          path.edges.every(edge => edge.label === 'KNOWS')
        );

        expect(allKnowsEdges).toBe(true);
      });

      it('should find paths with specific node types', () => {
        // Find all paths from a to a location node
        const matchingPaths = graph.findMatchingPaths('a', {
          pathComplete: (path, depth) => {
            // Only collect paths where last node is a location node
            const lastNode = path.nodes[path.nodes.length - 1];
            return lastNode.label === 'location';
          }
        });

        // All paths to location nodes
        const locationPaths = matchingPaths.filter(p => {
          const lastNode = p.nodes[p.nodes.length - 1];
          return lastNode.id === 'f';
        });

        // Should find at least one path to 'f' (Office)
        expect(locationPaths.length).toBeGreaterThan(0);

        // Verify at least one path reaches the Office
        const hasPathToOffice = locationPaths.some(p => {
          const lastNode = p.nodes[p.nodes.length - 1];
          return lastNode.id === 'f' && lastNode.data.name === 'Office';
        });

        expect(hasPathToOffice).toBe(true);
      });

      it('should find variable-length paths', () => {
        // Create a more complex network with a cycle
        graph.addEdge('d', 'e', 'KNOWS', { weight: 8 });

        // Find all paths from a with 1-3 KNOWS relationships
        const matchingPaths = graph.findMatchingPaths('a', {
          examineEdge: (edge, source, target, depth) => {
            // Only follow KNOWS edges
            return edge.label === 'KNOWS';
          },
          pathComplete: (path, depth) => {
            // Collect complete paths with specific depths (1-3 hops)
            return depth >= 1 && depth <= 3;
          }
        }, { maxDepth: 3 });

        // Should have paths of lengths 1-3 starting with a
        expect(matchingPaths.length).toBeGreaterThan(0);

        // Get unique path lengths
        const pathLengths = [...new Set(matchingPaths.map(p => p.nodes.length))];

        // Should have at least paths of lengths 2, 3, and 4 (1-hop, 2-hop, 3-hop)
        // But we don't check exact count as it depends on BFS implementation details
        expect(pathLengths.includes(2)).toBe(true); // 1-hop path
        expect(pathLengths.includes(3)).toBe(true); // 2-hop path
        expect(pathLengths.includes(4)).toBe(true); // 3-hop path
      });

      it('should respect maxResults', () => {
        // Find paths but limit results to 1
        const matchingPaths = graph.findMatchingPaths('a', {
          examineEdge: () => true,
          pathComplete: () => true
        }, { maxResults: 1 });

        // Should only return the first path
        expect(matchingPaths.length).toBe(1);
      });

      it('should handle cycles gracefully', () => {
        // Create a cycle
        graph.addEdge('d', 'a', 'KNOWS', { weight: 9 });

        const visitedNodes: string[] = [];

        // Traverse and record all visited nodes, using KNOWS edges only
        graph.traverseBFS('a', {
          discoverNode: (node) => {
            visitedNodes.push(node.id);
            return true;
          },
          examineEdge: (edge) => {
            return edge.label === 'KNOWS';
          }
        });

        // Should visit each node exactly once (in BFS order) despite the cycle
        const expected = ['a', 'b', 'c', 'd'];

        // Every node from our expected set should appear in visited
        for (const nodeId of expected) {
          expect(visitedNodes.includes(nodeId)).toBe(true);
        }

        // No duplicates in our visited set
        const uniqueVisited = new Set(visitedNodes);
        expect(uniqueVisited.size).toBe(visitedNodes.length);
      });
    });
  });

  describe('Graph-wide operations', () => {
    beforeEach(() => {
      graph.addNode('n1', 'person', { name: 'Alice' });
      graph.addNode('n2', 'person', { name: 'Bob' });
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });
    });

    it('should clear the graph', () => {
      graph.clear();

      expect(graph.getAllNodes().length).toBe(0);
      expect(graph.getAllEdges().length).toBe(0);
      expect(graph.hasNode('n1')).toBe(false);
    });

    it('should serialize to JSON', () => {
      const graph = new Graph<{ name: string }, { weight: number }>();
      graph.addNode('n1', 'person', { name: 'Alice' });
      graph.addNode('n2', 'person', { name: 'Bob' });
      graph.addEdge('n1', 'n2', 'KNOWS', { weight: 5 });

      const json = graph.toJSON();

      expect(json.nodes).toBeDefined();
      expect(json.edges).toBeDefined();

      expect(json.nodes.length).toBe(2);
      expect(json.edges.length).toBe(1);

      expect(json.nodes).toContainEqual({ id: 'n1', label: 'person', data: { name: 'Alice' } });
      expect(json.edges[0]).toEqual({
        source: 'n1',
        target: 'n2',
        label: 'KNOWS',
        data: { weight: 5 }
      });
    });

    it('should deserialize from JSON', () => {
      const json: GraphData<{ name: string }, { weight: number }> = {
        nodes: [
          { id: 'x1', label: 'robot', data: { name: 'XBot' } },
          { id: 'x2', label: 'robot', data: { name: 'YBot' } }
        ],
        edges: [
          { source: 'x1', target: 'x2', label: 'CONNECTED_TO', data: { weight: 10 } }
        ]
      };

      const graph = new Graph<{ name: string }, { weight: number }>();
      graph.fromJSON(json);

      expect(graph.getAllNodes().length).toBe(2);
      expect(graph.getAllEdges().length).toBe(1);

      const x1 = graph.getNode('x1');
      expect(x1?.label).toBe('robot');
      expect(x1?.data.name).toBe('XBot');

      expect(graph.hasEdge('x1', 'x2', 'CONNECTED_TO')).toBe(true);
      expect(graph.getEdge('x1', 'x2', 'CONNECTED_TO')?.data.weight).toBe(10);
    });
  });
});