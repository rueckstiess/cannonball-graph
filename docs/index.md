# Cannonball Graph Documentation

Welcome to the documentation for Cannonball Graph, an in-memory graph database for JavaScript/TypeScript.

## Overview

Cannonball Graph provides two primary ways to interact with graph data:

1.  **Direct Graph API:** A programmatic interface for directly manipulating nodes and edges, performing traversals, and serializing graph data. Ideal for fine-grained control and integration within applications. See the [Graph API Guide](./graph-api.md).
2.  **Query Engine:** A declarative interface using a Cypher-inspired query language to match patterns, filter data, modify the graph, and return results. Suitable for more complex queries and data manipulation tasks. See the [Query Language Guide](./query-language.md) and the [Query Engine Guide](./query-engine.md).

## 🚧 Project Status

This project is experimental and not production-ready. Use at your own risk.

## Installation

```bash
npm install cannonball-graph
# or
yarn add cannonball-graph
```

## Quick Start

```typescript
// filepath: quick-start.ts
import { Graph, createQueryEngine, createQueryFormatter } from 'cannonball-graph';

// 1. Create a graph instance
const graph = new Graph();

// 2. Add data using the direct API
graph.addNode('alice', 'Person', { name: 'Alice', age: 30 });
graph.addNode('bob', 'Person', { name: 'Bob', age: 25 });
graph.addEdge('alice', 'bob', 'FRIENDS_WITH', { since: '2020-01-01' });

// 3. Use the Query Engine
const engine = createQueryEngine();
const formatter = createQueryFormatter();

// Find people older than 25
const result = engine.executeQuery(
  graph,
  'MATCH (p:Person) WHERE p.age > 25 RETURN p.name, p.age'
);

// Format and print results
console.log(formatter.toTextTable(result));
/*
p.name  | p.age
--------+------
"Alice" | 30
*/

// Create a new node and relationship via query
engine.executeQuery(
  graph,
  `MATCH (a:Person {name: "Alice"})
   CREATE (t:Task {title: "Write docs"})
   CREATE (a)-[:ASSIGNED_TO]->(t)`
);

// Verify creation
const assignmentResult = engine.executeQuery(graph, 'MATCH (p)-[:ASSIGNED_TO]->(t) RETURN p.name, t.title');
console.log(formatter.toTextTable(assignmentResult));
/*
p.name  | t.title
--------+------------
"Alice" | "Write docs"
*/
```

## Next Steps

*   Learn about direct graph manipulation: [Graph API Guide](./graph-api.md)
*   Understand the query language: [Query Language Guide](./query-language.md)
*   Explore the query engine features: [Query Engine Guide](./query-engine.md)
