# Cannonball Graph

_Cannonball Graph_ is an in-memory graph database for JavaScript/TypeScript that supports a subset of the Cypher query language. It provides both direct graph manipulation and a declarative query interface.

## 🚧 Project Status

This project was primarily vibe-coded and written by [Claude](https://claude.ai/), Anthropic's AI assistant. While functional, it is not production-ready and likely contains bugs. **Use at your own risk.**

## 📚 Documentation

For detailed information, please refer to the documentation:

*   **[Overview & Quick Start](./docs/index.md)**
*   **[Graph API Guide](./docs/graph-api.md)** (Direct Manipulation)
*   **[Query Language Guide](./docs/query-language.md)** (Cypher Subset)
*   **[Query Engine Guide](./docs/query-engine.md)** (Executing Queries)

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

## 💻 Usage (Examples)

See the **[Quick Start](./docs/index.md)** guide for introductory examples. More detailed examples can be found in the specific documentation pages linked above.

### Basic Graph Operations (Direct API)

```javascript
// filepath: readme-example-graph.ts
import { Graph } from 'cannonball-graph';

const graph = new Graph();
graph.addNode('alice', 'Person', { name: 'Alice', age: 30 });
graph.addNode('bob', 'Person', { name: 'Bob', age: 25 });
graph.addEdge('alice', 'bob', 'FRIENDS_WITH', { since: '2020-01-01' });
const alice = graph.getNode('alice');

console.log(alice?.data.name); // Output: Alice
```
*See [Graph API Guide](./docs/graph-api.md) for more.*

### Using the Query Engine

```javascript
// filepath: readme-example-query.ts
import { Graph, createQueryEngine, createQueryFormatter } from 'cannonball-graph';

const graph = new Graph();
graph.addNode('alice', 'Person', { name: 'Alice', age: 30 });
graph.addNode('bob', 'Person', { name: 'Bob', age: 25 });
graph.addEdge('alice', 'bob', 'FRIENDS_WITH', { since: '2020-01-01' });

const engine = createQueryEngine();
const formatter = createQueryFormatter();

const result = engine.executeQuery(graph, 
  'MATCH (p:Person)-[:FRIENDS_WITH]->(f:Person) RETURN p.name, f.name'
);

console.log(formatter.toTextTable(result));
/* Output:
p.name  | f.name
--------+-------
"Alice" | "Bob"
*/
```
*See [Query Language Guide](./docs/query-language.md) and [Query Engine Guide](./docs/query-engine.md) for more.*


## 📄 License

MIT