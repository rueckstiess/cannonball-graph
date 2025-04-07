# Cannonball Graph

Cannonball Graph is an in-memory graph database for JavaScript/TypeScript that supports a subset of the Cypher query language. It provides both direct graph manipulation and a declarative query interface.

## 🚧 Project Status

This project was primarily vibe-coded and written by [Claude](https://claude.ai/), Anthropic's AI assistant. While functional, it is not production-ready and likely contains bugs. **Use at your own risk.**

## 📋 Features

- In-memory labeled property graph database
- Full graph traversal and path finding
- Cypher-inspired query language for declarative operations
- Pattern matching with variable-length paths and conditions
- Graph modification via CREATE, SET, and DELETE operations
- Serialization and deserialization support
- Query result formatting as text tables, markdown, or JSON

## 🔧 Installation

```bash
npm install cannonball-graph
```

## 💻 Usage

### Basic Graph Operations

#### Creating a Graph

Start by creating a graph instance and adding nodes with labels and properties:

```javascript
import { Graph } from 'cannonball-graph';

// Create a new graph
const graph = new Graph();

// Add nodes with IDs, labels, and properties
graph.addNode('alice', 'Person', { name: 'Alice', age: 30 });
graph.addNode('bob', 'Person', { name: 'Bob', age: 25 });
graph.addNode('task1', 'Task', { title: 'Complete report', priority: 'High' });
```

#### Connecting Nodes with Edges

Connect nodes using labeled edges that can also have their own properties:

```javascript
// Create relationships between nodes
graph.addEdge('alice', 'bob', 'FRIENDS_WITH', { since: '2020-01-01' });
graph.addEdge('alice', 'task1', 'ASSIGNED_TO', { date: '2023-05-15' });
```

#### Querying Nodes and Edges

Retrieve specific nodes and check their properties:

```javascript
// Get a node by ID
const person = graph.getNode('alice');
console.log(person.data.name); // 'Alice'

// Check if an edge exists
const areConnected = graph.hasEdge('alice', 'bob', 'FRIENDS_WITH');
console.log(areConnected); // true

// Get a specific edge
const friendship = graph.getEdge('alice', 'bob', 'FRIENDS_WITH');
console.log(friendship.data.since); // '2020-01-01'
```

#### Finding Neighbors

Explore node connections in any direction:

```javascript
// Find all outgoing neighbors from a node
const outgoingNeighbors = graph.getNeighbors('alice', 'outgoing');
console.log(outgoingNeighbors.length); // 2

// Find neighbors with a specific label
const taskNeighbors = outgoingNeighbors.filter(n => n.label === 'Task');
console.log(taskNeighbors[0].data.title); // 'Complete report'

// Get incoming neighbors
const incomingNeighbors = graph.getNeighbors('bob', 'incoming');
```

#### Path Finding

Find paths between nodes with flexible options:

```javascript
// Find all paths between two nodes
const paths = graph.findPaths('alice', 'bob', {
  maxDepth: 3,
  relationshipTypes: ['FRIENDS_WITH'],
  direction: 'outgoing'
});

// Print the found path
console.log(paths[0].join(' -> ')); // 'alice -> bob'
```

#### Serialization

Save and load graph data:

```javascript
// Save the graph to JSON
const serialized = graph.toJSON();

// Create a new graph from serialized data
const newGraph = new Graph();
newGraph.fromJSON(serialized);
```

### Using the Query Engine

#### Setting Up the Query Engine

Initialize the necessary components:

```javascript
import { Graph, createQueryEngine, createQueryFormatter } from 'cannonball-graph';

// Initialize graph and query components
const graph = new Graph();
const engine = createQueryEngine();
const formatter = createQueryFormatter();

// Add some sample data
graph.addNode('alice', 'Person', { name: 'Alice', age: 30 });
graph.addNode('bob', 'Person', { name: 'Bob', age: 25 });
graph.addNode('charlie', 'Person', { name: 'Charlie', age: 42 });
graph.addEdge('alice', 'bob', 'FRIENDS_WITH', { since: '2020-01-01' });
```

#### Basic MATCH Queries

Execute simple pattern matching queries:

```javascript
// Find all Person nodes and return their properties
const basicResult = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');

// Format the results as a text table
console.log(formatter.toTextTable(basicResult));

/*
p.name    | p.age
----------+------
"Alice"   | 30
"Bob"     | 25
"Charlie" | 42
*/
```

#### Filtering with WHERE Clauses

Add conditions to filter your query results:

```javascript
// Find people older than 25
const whereResult = engine.executeQuery(
  graph, 'MATCH (p:Person) WHERE p.age > 25 RETURN p.name, p.age'
);

// Format as markdown table
console.log(formatter.toMarkdownTable(whereResult));

/*
| p.name | p.age |
| --- | --- |
| "Alice" | 30 |
| "Charlie" | 42 |
*/
```

#### Querying Relationships

Match patterns with relationships between nodes:

```javascript
// Add a task and assign it to Alice
graph.addNode('task1', 'Task', { title: 'Complete report', priority: 'High' });
graph.addEdge('alice', 'task1', 'ASSIGNED_TO', { date: '2023-05-15' });

// Find all task assignments
const relationResult = engine.executeQuery(
  graph, 'MATCH (p:Person)-[r:ASSIGNED_TO]->(t:Task) RETURN p.name, t.title, r.date'
);

console.log(formatter.toTextTable(relationResult));

/*
p.name  | t.title           | r.date
--------+-------------------+-------------
"Alice" | "Complete report" | "2023-05-15"
*/
```

#### Modifying the Graph with Queries

Create and connect nodes using query language:

```javascript
// Create a new task and assign it to Bob
engine.executeQuery(
  graph,
  `MATCH (p:Person {name: "Bob"})
   CREATE (t:Task {title: "New task", priority: "Medium"})
   CREATE (p)-[:ASSIGNED_TO {date: "2023-06-01"}]->(t)`
);

// Verify with a query
const verifyResult = engine.executeQuery(
  graph,
  'MATCH (p:Person)-[:ASSIGNED_TO]->(t:Task) RETURN p.name, t.title'
);

console.log(formatter.toJSON(verifyResult));

/*
{
  "success": true,
  "matchCount": 2,
  "statement": "MATCH (p:Person)-[:ASSIGNED_TO]->(t:Task) RETURN p.name, t.title",
  "stats": {
    "readOperations": true,
    "writeOperations": false,
    "executionTimeMs": 0
  },
  "query": [
    {
      "p.name": "Alice",
      "t.title": "Complete report"
    },
    {
      "p.name": "Bob",
      "t.title": "New task"
    }
  ]
}
*/
```

## 📄 License

MIT