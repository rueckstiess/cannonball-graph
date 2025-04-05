# Graph API Documentation

The Graph module provides a flexible, directed labeled graph data structure that serves as the foundation for the Cannonball system. This document covers the public API and usage patterns.

## Overview

The Graph is a directed, labeled graph where:
- Each node has a unique identifier and associated data
- Edges connect nodes with a specific relationship type (label)
- Both nodes and edges can store arbitrary data


## Basic Usage

```typescript
import { Graph } from '@/graph';

// Create a new graph
const graph = new Graph();

// Add nodes
graph.addNode('person1', { name: 'Alice', age: 30 });
graph.addNode('task1', { title: 'Complete report', priority: 'High' });

// Connect nodes with a labeled edge
graph.addEdge('person1', 'task1', 'ASSIGNED_TO', { date: '2023-05-15' });

// Query the graph
const person = graph.getNode('person1');
console.log(person?.data.name); // 'Alice'

// Find neighbors
const tasks = graph.getNeighbors('person1', 'outgoing');
console.log(tasks[0].data.title); // 'Complete report'

// Serialize/deserialize
const serialized = graph.toJSON();
const newGraph = new Graph();
newGraph.fromJSON(serialized);
```

## Core Interfaces

### Node

```typescript
interface Node<T = any> {
  id: string;  // Unique identifier
  data: T;     // Associated data
}
```

### Edge

```typescript
interface Edge<T = any> {
  source: string;  // ID of source node
  target: string;  // ID of target node
  label: string;   // Relationship type
  data: T;         // Associated data
}
```

### Path

```typescript
interface Path<NodeData = any, EdgeData = any> {
  nodes: Node<NodeData>[];  // Nodes in traversal order
  edges: Edge<EdgeData>[];  // Edges in traversal order
}
```

## API Reference

### Node Operations

| Method | Description |
|--------|-------------|
| `addNode(id: string, data: any)` | Add a node to the graph |
| `getNode(id: string)` | Get a node by ID |
| `hasNode(id: string)` | Check if a node exists |
| `updateNode(id: string, data: any)` | Update a node's data |
| `removeNode(id: string)` | Remove a node and all its edges |
| `getAllNodes()` | Get all nodes in the graph |
| `findNodes(predicate: Function)` | Find nodes matching a predicate |

### Edge Operations

| Method | Description |
|--------|-------------|
| `addEdge(source: string, target: string, label: string, data: any)` | Add an edge between nodes |
| `getEdge(source: string, target: string, label: string)` | Get a specific edge |
| `hasEdge(source: string, target: string, label?: string)` | Check if an edge exists |
| `updateEdge(source: string, target: string, label: string, data: any)` | Update an edge's data |
| `removeEdge(source: string, target: string, label?: string)` | Remove an edge |
| `getAllEdges()` | Get all edges in the graph |
| `findEdges(predicate: Function)` | Find edges matching a predicate |

### Traversal Operations

| Method | Description |
|--------|-------------|
| `getNeighbors(id: string, direction?: string)` | Get neighboring nodes |
| `getEdgesForNode(id: string, direction?: string)` | Get edges connected to a node |
| `findPaths(start: string, end: string, options?: PathOptions)` | Find paths between nodes |
| `traverseBFS(startNodeId: string, visitor: BFSVisitor, options?: BFSOptions)` | Breadth-first traversal |
| `findMatchingPaths(startNodeId: string, visitor: BFSVisitor, options?: BFSOptions)` | Find paths matching a pattern |

### Graph-wide Operations

| Method | Description |
|--------|-------------|
| `clear()` | Clear all nodes and edges |
| `toJSON()` | Serialize the graph |
| `fromJSON(data: GraphData)` | Load from serialized data |

## Advanced Traversal

The Graph provides powerful traversal capabilities using the visitor pattern:

```typescript
const visitor = {
  // Called when starting traversal
  start: (startNode) => console.log(`Starting from: ${startNode.id}`),
  
  // Called when discovering a node
  discoverNode: (node, depth) => {
    console.log(`Discovered: ${node.id} at depth ${depth}`);
    return true; // Continue traversal from this node
  },
  
  // Called when examining an edge
  examineEdge: (edge, sourceNode, targetNode, depth) => {
    console.log(`Edge: ${sourceNode.id} -[${edge.label}]-> ${targetNode.id}`);
    return true; // Traverse this edge
  }
};

// BFS traversal from a starting node
graph.traverseBFS('person1', visitor, { maxDepth: 3, direction: 'outgoing' });
```

## Path Finding

```typescript
// Find all paths between two nodes
const paths = graph.findPaths('person1', 'task2', {
  maxDepth: 5,
  relationshipTypes: ['ASSIGNED_TO', 'DEPENDS_ON'],
  direction: 'outgoing'
});

// For each path, access the sequence of node IDs
paths.forEach(path => {
  console.log('Path:', path.join(' -> '));
});
```

## Working with Data

The Graph is generic and can store any data types:

```typescript
interface PersonData {
  name: string;
  age: number;
  labels: string[];
}

interface TaskData {
  title: string;
  priority: string;
  labels: string[];
}

const graph = new Graph<PersonData | TaskData>();

// Now the graph is typed
graph.addNode('person1', { name: 'Bob', age: 25, labels: ['Person'] });
```
