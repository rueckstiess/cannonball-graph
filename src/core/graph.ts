import { Node, Edge, RelationType, NodeType, GraphDiff } from './types';

/**
 * Main class representing the Cannonball graph data structure
 * Stores nodes and their relationships and provides methods for manipulation and querying
 */
export class CannonballGraph {
  /** Map of node ID to node object */
  private nodes: Map<string, Node>;
  /** Adjacency list: map of node ID to list of outgoing edges */
  private outgoingEdges: Map<string, Edge[]>;
  /** Adjacency list: map of node ID to list of incoming edges */
  private incomingEdges: Map<string, Edge[]>;

  constructor() {
    this.nodes = new Map<string, Node>();
    this.outgoingEdges = new Map<string, Edge[]>();
    this.incomingEdges = new Map<string, Edge[]>();
  }

  /**
   * Get all nodes in the graph
   * @returns Array of all nodes
   */
  getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges in the graph
   * @returns Array of all edges
   */
  getAllEdges(): Edge[] {
    return Array.from(this.outgoingEdges.values()).flat();
  }

  /**
   * Get a node by its ID
   * @param id - The node ID to look up
   * @returns The node, or undefined if not found
   */
  getNode(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  /**
   * Add a node to the graph
   * @param node - The node to add
   * @throws Error if a node with the same ID already exists
   */
  addNode(node: Node): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node with ID ${node.id} already exists`);
    }
    this.nodes.set(node.id, node);
    this.outgoingEdges.set(node.id, []);
    this.incomingEdges.set(node.id, []);
  }

  /**
   * Update an existing node
   * @param node - The node with updated properties
   * @throws Error if the node doesn't exist
   */
  updateNode(node: Node): void {
    if (!this.nodes.has(node.id)) {
      throw new Error(`Node with ID ${node.id} doesn't exist`);
    }
    this.nodes.set(node.id, {
      ...node,
      modifiedDate: new Date(),
    });
  }

  /**
   * Remove a node and all its associated edges
   * @param id - The ID of the node to remove
   * @returns true if the node was removed, false if it didn't exist
   */
  removeNode(id: string): boolean {
    if (!this.nodes.has(id)) {
      return false;
    }

    // Remove all edges connected to this node
    this.outgoingEdges.get(id)?.forEach(edge => {
      const targetIncoming = this.incomingEdges.get(edge.target) || [];
      const updatedTargetIncoming = targetIncoming.filter(
        e => !(e.source === id && e.target === edge.target && e.relation === edge.relation)
      );
      this.incomingEdges.set(edge.target, updatedTargetIncoming);
    });

    this.incomingEdges.get(id)?.forEach(edge => {
      const sourceOutgoing = this.outgoingEdges.get(edge.source) || [];
      const updatedSourceOutgoing = sourceOutgoing.filter(
        e => !(e.source === edge.source && e.target === id && e.relation === edge.relation)
      );
      this.outgoingEdges.set(edge.source, updatedSourceOutgoing);
    });

    // Remove the node and its edge lists
    this.nodes.delete(id);
    this.outgoingEdges.delete(id);
    this.incomingEdges.delete(id);

    return true;
  }

  /**
   * Add an edge between two nodes
   * @param edge - The edge to add
   * @throws Error if either node doesn't exist or the edge already exists
   */
  addEdge(edge: Edge): void {
    const { source, target, relation } = edge;

    // Ensure both nodes exist
    if (!this.nodes.has(source)) {
      throw new Error(`Source node with ID ${source} doesn't exist`);
    }
    if (!this.nodes.has(target)) {
      throw new Error(`Target node with ID ${target} doesn't exist`);
    }

    // Check if the edge already exists
    const outEdges = this.outgoingEdges.get(source) || [];
    const edgeExists = outEdges.some(
      e => e.source === source && e.target === target && e.relation === relation
    );

    if (edgeExists) {
      throw new Error(`Edge from ${source} to ${target} with relation ${relation} already exists`);
    }

    // Add to outgoing edges
    this.outgoingEdges.set(source, [...outEdges, edge]);

    // Add to incoming edges
    const inEdges = this.incomingEdges.get(target) || [];
    this.incomingEdges.set(target, [...inEdges, edge]);

    // If it's a bidirectional relation, add the reverse edge automatically
    this.addBidirectionalEdgeIfNeeded(edge);
  }

  /**
   * Handle bidirectional edges like links_to <-> links_from
   * @param edge - The edge to potentially create a reverse edge for
   */
  private addBidirectionalEdgeIfNeeded(edge: Edge): void {
    const { source, target, relation, metadata } = edge;

    // Map relation to its reciprocal relation if it exists
    let reciprocalRelation: RelationType | null = null;
    if (relation === RelationType.LinksTo) {
      reciprocalRelation = RelationType.LinksFrom;
    } else if (relation === RelationType.LinksFrom) {
      reciprocalRelation = RelationType.LinksTo;
    } else if (relation === RelationType.DoneBefore) {
      reciprocalRelation = RelationType.DoneAfter;
    } else if (relation === RelationType.DoneAfter) {
      reciprocalRelation = RelationType.DoneBefore;
    }

    if (reciprocalRelation) {
      // Check if reverse edge already exists
      const targetOutEdges = this.outgoingEdges.get(target) || [];
      const reverseEdgeExists = targetOutEdges.some(
        e => e.source === target && e.target === source && e.relation === reciprocalRelation
      );

      if (!reverseEdgeExists) {
        const reverseEdge: Edge = {
          source: target,
          target: source,
          relation: reciprocalRelation,
          metadata: { ...metadata, autoGenerated: true },
        };

        // Add to outgoing edges
        this.outgoingEdges.set(target, [...targetOutEdges, reverseEdge]);

        // Add to incoming edges
        const sourceInEdges = this.incomingEdges.get(source) || [];
        this.incomingEdges.set(source, [...sourceInEdges, reverseEdge]);
      }
    }
  }

  /**
   * Remove an edge from the graph
   * @param source - Source node ID
   * @param target - Target node ID
   * @param relation - Type of relation
   * @returns true if the edge was removed, false if it didn't exist
   */
  removeEdge(source: string, target: string, relation: RelationType): boolean {
    // Remove from outgoing edges
    const outEdges = this.outgoingEdges.get(source) || [];
    const originalOutCount = outEdges.length;
    const filteredOutEdges = outEdges.filter(
      e => !(e.source === source && e.target === target && e.relation === relation)
    );
    this.outgoingEdges.set(source, filteredOutEdges);

    // Remove from incoming edges
    const inEdges = this.incomingEdges.get(target) || [];
    const filteredInEdges = inEdges.filter(
      e => !(e.source === source && e.target === target && e.relation === relation)
    );
    this.incomingEdges.set(target, filteredInEdges);

    // Also remove the bidirectional counterpart if needed
    this.removeBidirectionalEdgeIfNeeded(source, target, relation);

    return filteredOutEdges.length !== originalOutCount;
  }

  /**
   * Handle removing bidirectional edges like links_to <-> links_from
   * @param source - Source node ID
   * @param target - Target node ID
   * @param relation - Type of relation
   */
  private removeBidirectionalEdgeIfNeeded(
    source: string,
    target: string,
    relation: RelationType
  ): void {
    // Map relation to its reciprocal relation if it exists
    let reciprocalRelation: RelationType | null = null;
    if (relation === RelationType.LinksTo) {
      reciprocalRelation = RelationType.LinksFrom;
    } else if (relation === RelationType.LinksFrom) {
      reciprocalRelation = RelationType.LinksTo;
    } else if (relation === RelationType.DoneBefore) {
      reciprocalRelation = RelationType.DoneAfter;
    } else if (relation === RelationType.DoneAfter) {
      reciprocalRelation = RelationType.DoneBefore;
    }

    if (reciprocalRelation) {
      // Check outgoing edges from target
      const targetOutEdges = this.outgoingEdges.get(target) || [];
      const updatedTargetOutEdges = targetOutEdges.filter(
        e => !(e.source === target && e.target === source && e.relation === reciprocalRelation)
      );
      this.outgoingEdges.set(target, updatedTargetOutEdges);

      // Check incoming edges to source
      const sourceInEdges = this.incomingEdges.get(source) || [];
      const updatedSourceInEdges = sourceInEdges.filter(
        e => !(e.source === target && e.target === source && e.relation === reciprocalRelation)
      );
      this.incomingEdges.set(source, updatedSourceInEdges);
    }
  }

  /**
   * Get all nodes related to a given node with a specific relation
   * @param id - The ID of the node
   * @param relation - Optional relation type filter
   * @returns Array of related nodes
   */
  getRelatedNodes(id: string, relation?: RelationType): Node[] {
    if (!this.nodes.has(id)) {
      return [];
    }

    const outEdges = this.outgoingEdges.get(id) || [];
    const filteredEdges = relation
      ? outEdges.filter(edge => edge.relation === relation)
      : outEdges;

    return filteredEdges
      .map(edge => this.nodes.get(edge.target))
      .filter((node): node is Node => node !== undefined);
  }

  /**
   * Get all nodes that relate to a given node with a specific relation
   * @param id - The ID of the node
   * @param relation - Optional relation type filter
   * @returns Array of nodes that relate to the given node
   */
  getRelatingNodes(id: string, relation?: RelationType): Node[] {
    if (!this.nodes.has(id)) {
      return [];
    }

    const inEdges = this.incomingEdges.get(id) || [];
    const filteredEdges = relation
      ? inEdges.filter(edge => edge.relation === relation)
      : inEdges;

    return filteredEdges
      .map(edge => this.nodes.get(edge.source))
      .filter((node): node is Node => node !== undefined);
  }

  /**
   * Get edges between two nodes
   * @param source - Source node ID
   * @param target - Target node ID
   * @returns Array of edges between the nodes
   */
  getEdgesBetween(source: string, target: string): Edge[] {
    const outEdges = this.outgoingEdges.get(source) || [];
    return outEdges.filter(edge => edge.target === target);
  }

  /**
   * Apply a set of changes to the graph
   * @param diff - The changes to apply
   */
  applyDiff(diff: GraphDiff): void {
    // Add new nodes
    diff.addedNodes.forEach(node => {
      if (this.nodes.has(node.id)) {
        this.updateNode(node);
      } else {
        this.addNode(node);
      }
    });

    // Remove nodes
    diff.removedNodeIds.forEach(id => {
      this.removeNode(id);
    });

    // Add new edges
    diff.addedEdges.forEach(edge => {
      try {
        this.addEdge(edge);
      } catch (error) {
        // Skip edges that can't be added (e.g., if nodes don't exist)
        console.warn(`Failed to add edge: ${(error as Error).message}`);
      }
    });

    // Remove edges
    diff.removedEdges.forEach(edge => {
      this.removeEdge(edge.source, edge.target, edge.relation);
    });
  }

  /**
   * Find nodes of a specific type
   * @param type - The node type to find
   * @returns Array of nodes of the specified type
   */
  findNodesByType(type: NodeType): Node[] {
    return Array.from(this.nodes.values()).filter(node => node.type === type);
  }

  /**
   * Search for nodes based on content
   * @param query - The search query
   * @returns Array of nodes that match the query
   */
  searchNodes(query: string): Node[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.nodes.values()).filter(node =>
      node.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get a simple serializable representation of the graph
   * Useful for debugging or storage
   */
  toJSON(): { nodes: Node[]; edges: Edge[] } {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
    };
  }

  /**
   * Create a graph from a serialized representation
   * @param data - The serialized graph data
   * @returns A new CannonballGraph instance
   */
  static fromJSON(data: { nodes: Node[]; edges: Edge[] }): CannonballGraph {
    const graph = new CannonballGraph();

    // Add all nodes first
    data.nodes.forEach(node => {
      graph.addNode(node);
    });

    // Then add all edges
    data.edges.forEach(edge => {
      try {
        graph.addEdge(edge);
      } catch (error) {
        console.warn(`Failed to add edge: ${(error as Error).message}`);
      }
    });

    return graph;
  }
}