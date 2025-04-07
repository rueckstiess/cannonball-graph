# Graph API Guide

The `Graph` class provides a direct, programmatic interface for interacting with the graph database. It allows you to add, retrieve, update, and delete nodes and edges, perform traversals, and manage graph serialization.

Reference: [`src/graph/graph.ts`](../src/graph/graph.ts)

## Initialization

```typescript
// filepath: graph-init.ts
import { Graph } from 'cannonball-graph';

// Create an empty graph
const graph = new Graph<MyNodeData, MyEdgeData>(); // Optionally specify data types

interface MyNodeData {
  name: string;
  createdAt?: Date;
}

interface MyEdgeData {
  weight?: number;
  notes?: string;
}
```

## Node Operations

### Adding Nodes

Nodes require a unique ID, a label (string), and an optional data object.

```typescript
// filepath: graph-add-node.ts
// Assuming 'graph' is an initialized Graph instance

graph.addNode('user1', 'User', { name: 'Alice', registered: true });
graph.addNode('productA', 'Product', { price: 99.99, category: 'Electronics' });

try {
  graph.addNode('user1', 'Customer', { name: 'Alice V2' }); // Throws error: Node ID "user1" already exists
} catch (e) {
  console.error(e.message);
}
```

### Retrieving Nodes

```typescript
// filepath: graph-get-node.ts
const user = graph.getNode('user1');
if (user) {
  console.log(`Node ID: ${user.id}`);       // "user1"
  console.log(`Label: ${user.label}`);     // "User"
  console.log(`Name: ${user.data.name}`); // "Alice"
}

const nonExistent = graph.getNode('invalidId');
console.log(nonExistent); // undefined
```

### Checking Node Existence

```typescript
// filepath: graph-has-node.ts
const exists = graph.hasNode('user1'); // true
const notExists = graph.hasNode('invalidId'); // false
```

### Updating Nodes

You can update a node's data or its label.

```typescript
// filepath: graph-update-node.ts
// Update data
const dataUpdated = graph.updateNodeData('user1', { name: 'Alice Smith', registered: true, lastLogin: new Date() });
console.log(dataUpdated); // true

// Update label
const labelUpdated = graph.updateNodeLabel('user1', 'Admin');
console.log(labelUpdated); // true

const failedUpdate = graph.updateNodeData('invalidId', { name: 'Test' });
console.log(failedUpdate); // false
```

### Removing Nodes

Removing a node also removes all incoming and outgoing edges connected to it.

```typescript
// filepath: graph-remove-node.ts
// Assume user1 is connected to productA via a 'VIEWED' edge
const removed = graph.removeNode('user1');
console.log(removed); // true
console.log(graph.hasNode('user1')); // false
console.log(graph.hasEdge('user1', 'productA', 'VIEWED')); // false (edge is gone)
```

### Finding Nodes

Find nodes based on a custom predicate function.

```typescript
// filepath: graph-find-nodes.ts
const products = graph.findNodes(node => node.label === 'Product');
const expensiveProducts = graph.findNodes(node => node.label === 'Product' && node.data.price > 100);
```

### Getting All Nodes

```typescript
// filepath: graph-get-all-nodes.ts
const allNodes = graph.getAllNodes();
console.log(`Total nodes: ${allNodes.length}`);
```

## Edge Operations

Edges connect two nodes, have a label (type), and optional data.

### Adding Edges

```typescript
// filepath: graph-add-edge.ts
// Assuming nodes 'user1' and 'productA' exist
graph.addEdge('user1', 'productA', 'VIEWED', { timestamp: Date.now() });
graph.addEdge('user1', 'productA', 'PURCHASED', { quantity: 1, price: 99.99 });

try {
  graph.addEdge('user1', 'productA', 'VIEWED', {}); // Throws error: Edge already exists
} catch (e) {
  console.error(e.message);
}

try {
  graph.addEdge('user1', 'invalidNode', 'LIKES', {}); // Throws error: Target node doesn't exist
} catch (e) {
  console.error(e.message);
}
```

### Retrieving Edges

```typescript
// filepath: graph-get-edge.ts
const viewedEdge = graph.getEdge('user1', 'productA', 'VIEWED');
if (viewedEdge) {
  console.log(`Source: ${viewedEdge.source}`);     // "user1"
  console.log(`Target: ${viewedEdge.target}`);     // "productA"
  console.log(`Label: ${viewedEdge.label}`);      // "VIEWED"
  console.log(`Data: ${viewedEdge.data.timestamp}`); // Timestamp value
}

const nonExistentEdge = graph.getEdge('user1', 'productA', 'WISHED_FOR');
console.log(nonExistentEdge); // undefined
```

### Checking Edge Existence

```typescript
// filepath: graph-has-edge.ts
// Check for a specific edge
const specificExists = graph.hasEdge('user1', 'productA', 'VIEWED'); // true

// Check if *any* edge exists between two nodes
const anyExists = graph.hasEdge('user1', 'productA'); // true (because VIEWED and PURCHASED exist)

const notExists = graph.hasEdge('user1', 'productA', 'WISHED_FOR'); // false
const noConnection = graph.hasEdge('user1', 'user2'); // false (assuming no edge exists)
```

### Updating Edges

```typescript
// filepath: graph-update-edge.ts
const updated = graph.updateEdge('user1', 'productA', 'PURCHASED', { quantity: 2, price: 99.99, discounted: true });
console.log(updated); // true

const failedUpdate = graph.updateEdge('user1', 'productA', 'WISHED_FOR', {});
console.log(failedUpdate); // false
```

### Removing Edges

```typescript
// filepath: graph-remove-edge.ts
// Remove a specific edge
const removedSpecific = graph.removeEdge('user1', 'productA', 'VIEWED');
console.log(removedSpecific); // true

// Remove all edges between two nodes (if any remain)
const removedAll = graph.removeEdge('user1', 'productA');
console.log(removedAll); // true (because PURCHASED was still there)

const failedRemove = graph.removeEdge('user1', 'user2', 'FRIENDS');
console.log(failedRemove); // false
```

### Finding Edges

Find edges based on a custom predicate function.

```typescript
// filepath: graph-find-edges.ts
const purchaseEdges = graph.findEdges(edge => edge.label === 'PURCHASED');
const recentViewEdges = graph.findEdges(edge => edge.label === 'VIEWED' && edge.data.timestamp > (Date.now() - 3600000)); // Viewed in last hour
```

### Getting All Edges

```typescript
// filepath: graph-get-all-edges.ts
const allEdges = graph.getAllEdges();
console.log(`Total edges: ${allEdges.length}`);
```

## Traversal Operations

### Getting Neighbors

Retrieve nodes directly connected to a given node.

```typescript
// filepath: graph-get-neighbors.ts
// Assuming user1 -> productA, user2 -> user1
const outgoingNeighbors = graph.getNeighbors('user1', 'outgoing'); // [Node(productA)]
const incomingNeighbors = graph.getNeighbors('user1', 'incoming'); // [Node(user2)]
const allNeighbors = graph.getNeighbors('user1', 'both');      // [Node(productA), Node(user2)] (order not guaranteed)
```

### Getting Edges for a Node

Retrieve edges connected to a given node.

```typescript
// filepath: graph-get-edges-for-node.ts
const outgoingEdges = graph.getEdgesForNode('user1', 'outgoing'); // [Edge(user1-VIEWED->productA), Edge(user1-PURCHASED->productA)]
const incomingEdges = graph.getEdgesForNode('user1', 'incoming'); // [Edge(user2-FRIENDS->user1)] (assuming FRIENDS edge exists)
const allEdges = graph.getEdgesForNode('user1', 'both');      // Combined outgoing and incoming edges
```

### Finding Paths

Find simple paths (sequences of node IDs) between two nodes.

```typescript
// filepath: graph-find-paths.ts
// Setup: a -> b -> c, a -> d -> c
graph.addNode('a', 'Node', {}); graph.addNode('b', 'Node', {}); graph.addNode('c', 'Node', {}); graph.addNode('d', 'Node', {});
graph.addEdge('a', 'b', 'REL', {}); graph.addEdge('b', 'c', 'REL', {});
graph.addEdge('a', 'd', 'REL', {}); graph.addEdge('d', 'c', 'REL', {});

const paths = graph.findPaths('a', 'c', { maxDepth: 3, direction: 'outgoing' });
console.log(paths); // [['a', 'b', 'c'], ['a', 'd', 'c']]

const pathsWithTypes = graph.findPaths('a', 'c', { relationshipTypes: ['REL'] });
console.log(pathsWithTypes); // [['a', 'b', 'c'], ['a', 'd', 'c']]

const noPaths = graph.findPaths('a', 'c', { relationshipTypes: ['OTHER_REL'] });
console.log(noPaths); // []
```

### Breadth-First Search (BFS) Traversal

Perform a BFS traversal using a visitor pattern for custom logic at different stages.

```typescript
// filepath: graph-traverse-bfs.ts
import { BFSVisitor, Path, Node, Edge } from 'cannonball-graph';

class MyVisitor implements BFSVisitor {
  discoverNode(node: Node, depth: number, path?: Path): boolean {
    console.log(`Discovered ${node.label} node ${node.id} at depth ${depth}`);
    // Only continue traversal from 'User' nodes
    return node.label === 'User';
  }

  examineEdge(edge: Edge, sourceNode: Node, targetNode: Node, depth: number): boolean {
    console.log(`Examining edge ${edge.label} from ${sourceNode.id} to ${targetNode.id}`);
    // Only traverse 'FRIENDS_WITH' edges
    return edge.label === 'FRIENDS_WITH';
  }

  finishNode(node: Node, depth: number): void {
    console.log(`Finished exploring node ${node.id}`);
  }
}

// Assuming graph has User nodes connected by FRIENDS_WITH
graph.traverseBFS('startUserId', new MyVisitor(), { maxDepth: 5, direction: 'outgoing' });
```

## Serialization

Save and load the graph state.

### Saving to JSON

```typescript
// filepath: graph-to-json.ts
const graphData = graph.toJSON();
const jsonString = JSON.stringify(graphData, null, 2); // Pretty print
console.log(jsonString);
/* Example Output:
{
  "nodes": [
    { "id": "user1", "label": "User", "data": { ... } },
    { "id": "productA", "label": "Product", "data": { ... } }
  ],
  "edges": [
    { "source": "user1", "target": "productA", "label": "VIEWED", "data": { ... } },
    { "source": "user1", "target": "productA", "label": "PURCHASED", "data": { ... } }
  ]
}
*/
```

### Loading from JSON

```typescript
// filepath: graph-from-json.ts
const newGraph = new Graph();
const graphDataString = '...'; // Load JSON string from file or source
const graphData = JSON.parse(graphDataString);
newGraph.fromJSON(graphData);

console.log(newGraph.hasNode('user1')); // true
```

## Clearing the Graph

Remove all nodes and edges.

```typescript
// filepath: graph-clear.ts
graph.clear();
console.log(graph.getAllNodes().length); // 0
console.log(graph.getAllEdges().length); // 0
```
