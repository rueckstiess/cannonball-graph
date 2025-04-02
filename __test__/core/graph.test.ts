// __test__/core/graph.test.ts
import { CannonballGraph } from '@/core/graph';
import { Node, Edge, NodeType, RelationType } from '@/core/types';

describe('CannonballGraph', () => {
  let graph: CannonballGraph;

  // Sample node and edge data for testing
  const node1: Node = {
    id: 'file1.md#task1',
    type: NodeType.Task,
    content: 'Test task 1',
    metadata: {},
    createdDate: new Date(),
    modifiedDate: new Date(),
  };

  const node2: Node = {
    id: 'file1.md#task2',
    type: NodeType.Task,
    content: 'Test task 2',
    metadata: {},
    createdDate: new Date(),
    modifiedDate: new Date(),
  };

  const node3: Node = {
    id: 'file2.md#project1',
    type: NodeType.Container,
    content: 'Test project',
    metadata: {},
    createdDate: new Date(),
    modifiedDate: new Date(),
  };

  beforeEach(() => {
    graph = new CannonballGraph();
  });

  describe('Node operations', () => {
    it('should add nodes correctly', () => {
      graph.addNode(node1);
      graph.addNode(node2);

      expect(graph.getAllNodes().length).toBe(2);
      expect(graph.getNode(node1.id)).toEqual(node1);
      expect(graph.getNode(node2.id)).toEqual(node2);
    });

    it('should throw when adding a duplicate node', () => {
      graph.addNode(node1);
      expect(() => graph.addNode(node1)).toThrow();
    });

    it('should update nodes correctly', () => {
      graph.addNode(node1);

      const updatedNode: Node = {
        ...node1,
        content: 'Updated content',
      };

      graph.updateNode(updatedNode);
      const retrievedNode = graph.getNode(node1.id);

      expect(retrievedNode).not.toBeUndefined();
      expect(retrievedNode?.content).toBe('Updated content');
    });

    it('should remove nodes correctly', () => {
      graph.addNode(node1);
      expect(graph.getNode(node1.id)).not.toBeUndefined();

      const result = graph.removeNode(node1.id);
      expect(result).toBe(true);
      expect(graph.getNode(node1.id)).toBeUndefined();
      expect(graph.getAllNodes().length).toBe(0);
    });

    it('should return false when removing a non-existent node', () => {
      const result = graph.removeNode('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('Edge operations', () => {
    beforeEach(() => {
      graph.addNode(node1);
      graph.addNode(node2);
      graph.addNode(node3);
    });

    it('should add edges correctly', () => {
      const edge: Edge = {
        source: node1.id,
        target: node2.id,
        relation: RelationType.DependsOn,
        metadata: {},
      };

      graph.addEdge(edge);

      const relatedNodes = graph.getRelatedNodes(node1.id);
      expect(relatedNodes.length).toBe(1);
      expect(relatedNodes[0].id).toBe(node2.id);
    });

    it('should throw when adding an edge with non-existent nodes', () => {
      const edge: Edge = {
        source: 'nonexistent',
        target: node2.id,
        relation: RelationType.DependsOn,
        metadata: {},
      };

      expect(() => graph.addEdge(edge)).toThrow();
    });

    it('should handle bidirectional relations automatically', () => {
      const edge: Edge = {
        source: node1.id,
        target: node2.id,
        relation: RelationType.LinksTo,
        metadata: {},
      };

      graph.addEdge(edge);

      // Check normal direction
      const outgoingNodes = graph.getRelatedNodes(node1.id, RelationType.LinksTo);
      expect(outgoingNodes.length).toBe(1);
      expect(outgoingNodes[0].id).toBe(node2.id);

      // Check reverse direction (should be created automatically)
      const incomingNodes = graph.getRelatedNodes(node2.id, RelationType.LinksFrom);
      expect(incomingNodes.length).toBe(1);
      expect(incomingNodes[0].id).toBe(node1.id);
    });

    it('should remove edges correctly', () => {
      const edge: Edge = {
        source: node1.id,
        target: node2.id,
        relation: RelationType.DependsOn,
        metadata: {},
      };

      graph.addEdge(edge);
      expect(graph.getRelatedNodes(node1.id).length).toBe(1);

      const result = graph.removeEdge(node1.id, node2.id, RelationType.DependsOn);
      expect(result).toBe(true);
      expect(graph.getRelatedNodes(node1.id).length).toBe(0);
    });

    it('should remove bidirectional edges correctly', () => {
      const edge: Edge = {
        source: node1.id,
        target: node2.id,
        relation: RelationType.LinksTo,
        metadata: {},
      };

      graph.addEdge(edge);

      // Both directions should exist
      expect(graph.getRelatedNodes(node1.id, RelationType.LinksTo).length).toBe(1);
      expect(graph.getRelatedNodes(node2.id, RelationType.LinksFrom).length).toBe(1);

      // Remove the forward edge
      const result = graph.removeEdge(node1.id, node2.id, RelationType.LinksTo);
      expect(result).toBe(true);

      // Both directions should be gone
      expect(graph.getRelatedNodes(node1.id, RelationType.LinksTo).length).toBe(0);
      expect(graph.getRelatedNodes(node2.id, RelationType.LinksFrom).length).toBe(0);
    });

    it('should return false when removing a non-existent edge', () => {
      const result = graph.removeEdge(node1.id, node2.id, RelationType.DependsOn);
      expect(result).toBe(false);
    });
  });

  describe('Graph queries', () => {
    beforeEach(() => {
      graph.addNode(node1);
      graph.addNode(node2);
      graph.addNode(node3);

      // Add some edges
      graph.addEdge({
        source: node1.id,
        target: node2.id,
        relation: RelationType.DependsOn,
        metadata: {},
      });

      graph.addEdge({
        source: node3.id,
        target: node1.id,
        relation: RelationType.ContainsChild,
        metadata: {},
      });

      graph.addEdge({
        source: node3.id,
        target: node2.id,
        relation: RelationType.ContainsChild,
        metadata: {},
      });
    });

    it('should find nodes by type', () => {
      const tasks = graph.findNodesByType(NodeType.Task);
      expect(tasks.length).toBe(2);

      const containers = graph.findNodesByType(NodeType.Container);
      expect(containers.length).toBe(1);
      expect(containers[0].id).toBe(node3.id);
    });

    it('should search nodes by content', () => {
      const results = graph.searchNodes('project');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(node3.id);
    });

    it('should get related nodes with specific relation', () => {
      const contained = graph.getRelatedNodes(node3.id, RelationType.ContainsChild);
      expect(contained.length).toBe(2);
      expect(contained.map(n => n.id).sort()).toEqual([node1.id, node2.id].sort());

      const dependsOn = graph.getRelatedNodes(node1.id, RelationType.DependsOn);
      expect(dependsOn.length).toBe(1);
      expect(dependsOn[0].id).toBe(node2.id);
    });

    it('should get nodes that relate to a specific node', () => {
      const containers = graph.getRelatingNodes(node1.id, RelationType.ContainsChild);
      expect(containers.length).toBe(1);
      expect(containers[0].id).toBe(node3.id);
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize correctly', () => {
      // Set up a graph
      graph.addNode(node1);
      graph.addNode(node2);
      graph.addEdge({
        source: node1.id,
        target: node2.id,
        relation: RelationType.DependsOn,
        metadata: {},
      });

      // Serialize
      const serialized = graph.toJSON();

      // Deserialize
      const newGraph = CannonballGraph.fromJSON(serialized);

      // Check if the deserialized graph is equivalent
      expect(newGraph.getAllNodes().length).toBe(2);
      expect(newGraph.getAllEdges().length).toBe(1);
      expect(newGraph.getRelatedNodes(node1.id, RelationType.DependsOn).length).toBe(1);
      expect(newGraph.getRelatedNodes(node1.id, RelationType.DependsOn)[0].id).toBe(node2.id);
    });
  });
});