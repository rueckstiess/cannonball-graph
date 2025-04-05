import { Graph, Node, Edge } from '@/graph';

// Create a new graph
const graph = new Graph();

// Add nodes
graph.addNode('alice', 'Person', { name: 'Alice', age: 30 });
graph.addNode('task1', 'Task', { title: 'Complete report', priority: 'High' });

// Connect nodes with a labeled edge
graph.addEdge('alice', 'task1', 'ASSIGNED_TO', { date: '2023-05-15' });

console.log('Graph Structure as JSON:\n', JSON.stringify(graph, null, 2));

// Query the graph
const person = graph.getNode('alice');
console.log('Found person:', person?.data.name); // 'Alice'

// Find neighbors
const tasks = graph.getNeighbors('alice', 'outgoing');
console.log('Has task assigned:', tasks[0].data.title); // 'Complete report'

// Serialize/deserialize
const serialized = graph.toJSON();
const newGraph = new Graph();

newGraph.fromJSON(serialized);

// add more people
graph.addNode('bob', 'Person', { name: 'Bob', age: 25 });
graph.addNode('charlie', 'Person', { name: 'Charlie', age: 49 });
graph.addNode('diana', 'Person', { name: 'Diana', age: 57 });

// connections between people
graph.addEdge('alice', 'bob', 'FRIENDS_WITH', { since: '2020-01-01' });
graph.addEdge('bob', 'charlie', 'COLLEAGUE_OF', { since: '2021-06-01' });
graph.addEdge('charlie', 'diana', 'COLLEAGUE_OF', { since: '2019-03-15' });
graph.addEdge('diana', 'alice', 'FRIENDS_WITH', { since: '2022-11-20' });
graph.addEdge('diana', 'bob', 'FRIENDS_WITH', { since: '2022-11-20' });
graph.addEdge('bob', 'diana', 'FRIENDS_WITH', { since: '2022-11-20' });
graph.addEdge('alice', 'charlie', 'FRIENDS_WITH', { since: '2022-11-20' });


// Get specific node by ID
const alice = graph.getNode('alice');
const bob = graph.getNode('bob');

// Get a specific edge by nodes and label
const edge = graph.getEdge('alice', 'bob', 'FRIENDS_WITH');
console.log(`${alice?.data.name} is friends with ${bob?.data.name} since ${edge?.data.since}`);

// Check if edge exists
const edgeExists = graph.hasEdge('alice', 'charlie', 'FRIENDS_WITH');
console.log(`Alice and Charlie are friends: ${edgeExists}`);

// Change edge data
graph.updateEdge('charlie', 'diana', 'COLLEAGUE_OF', { since: '2023-01-01' });

// Remove an edge
graph.removeEdge('bob', 'charlie', 'COLLEAGUE_OF');

// Traversing the graph
const visitor = {
  // Called when starting traversal
  start: (startNode: any) => console.log(`Starting from: ${startNode.id}`),

  // Called when discovering a node
  discoverNode: (node: any, depth: number) => {
    console.log(`Discovered: ${node.id} at depth ${depth}`);
    return true; // Continue traversal from this node
  },

  // Called when examining an edge
  examineEdge: (edge: Edge, sourceNode: Node, targetNode: Node, depth: number) => {
    console.log(`Edge: ${sourceNode.id} -[${edge.label}]-> ${targetNode.id}`);
    return true; // Traverse this edge
  }
};

// BFS traversal from a starting node
console.log('\nBFS Traversal:\n');
graph.traverseBFS('alice', visitor, { maxDepth: 3, direction: 'outgoing' });


// Find all paths between two nodes
const paths = graph.findPaths('alice', 'diana', {
  maxDepth: 5,
  relationshipTypes: ['FRIENDS_WITH', 'COLLEAGUE_OF'],
  direction: 'outgoing'
});

// For each path, access the sequence of node IDs
console.log('\nPaths from Alice to Diana:\n');
paths.forEach(path => {
  console.log(path.join(' -> '));
});