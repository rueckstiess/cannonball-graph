# Query Engine Guide

The Query Engine provides a high-level interface for executing Cypher-like queries, formatting results, and working with query output.

## Core Components

*   **`QueryEngine`**: Parses and executes query statements against a `Graph` instance. Handles `MATCH`, `WHERE`, `CREATE`, `SET`, `DELETE`, and `RETURN`.
    Reference: [`src/query/query-engine.ts`](../src/query/query-engine.ts)
*   **`QueryFormatter`**: Formats the results returned by the `QueryEngine` into various text-based formats (Text Table, Markdown Table, JSON).
    Reference: [`src/query/query-formatter.ts`](../src/query/query-formatter.ts)
*   **`QueryUtils`**: Provides utility functions for extracting specific data (columns, nodes, edges) from query results or converting results into different structures (object arrays, subgraphs).
    Reference: [`src/query/query-utils.ts`](../src/query/query-utils.ts)

## Initialization

```typescript
import { Graph, createQueryEngine, createQueryFormatter, createQueryUtils } from 'cannonball-graph';

const graph = new Graph();
// ... populate graph ...

const engine = createQueryEngine();
const formatter = createQueryFormatter();
const utils = createQueryUtils();
```

## Executing Queries (`QueryEngine`)

The primary method is `executeQuery`. It takes the graph instance and the query string.

```typescript
const result = engine.executeQuery(
  graph,
  'MATCH (p:Person) WHERE p.age > 30 RETURN p.name, p.age'
);

if (result.success) {
  console.log(`Query successful! Matched ${result.matchCount} patterns.`);
  if (result.query) {
    console.log('Query Results:');
    console.log(formatter.toTextTable(result));
  }
  if (result.actions) {
    console.log('Graph Modifications:');
    console.log(`- Nodes affected: ${result.actions.affectedNodes.length}`);
    console.log(`- Edges affected: ${result.actions.affectedEdges.length}`);
    if (result.actions.deletedNodeIds) {
      console.log(`- Nodes deleted: ${result.actions.deletedNodeIds.length}`);
    }
    if (result.actions.deletedEdgeKeys) {
      console.log(`- Edges deleted: ${result.actions.deletedEdgeKeys.length}`);
    }
  }
} else {
  console.error(`Query failed: ${result.error}`);
}
```

### Query Result Structure (`QueryResult`)

The `executeQuery` method returns a `QueryResult` object with the following structure:

```typescript
interface QueryResult<NodeData = any, EdgeData = any> {
  success: boolean;       // Was the execution successful?
  matchCount: number;     // How many initial pattern matches were found before actions/filtering.
  error?: string;         // Error message if success is false.
  statement: string;      // The original query statement executed.
  stats: {
    readOperations: boolean; // Did the query involve MATCH or RETURN?
    writeOperations: boolean;// Did the query involve CREATE, SET, or DELETE?
    executionTimeMs: number; // Time taken in milliseconds.
  };
  query?: {               // Present if the query had a RETURN clause.
    columns: string[];    // Names of the returned columns.
    rows: ReturnedValue<NodeData, EdgeData>[][]; // Array of rows, each row is an array of returned values.
  };
  actions?: {             // Present if the query had CREATE, SET, or DELETE clauses.
    actionResults: ActionExecutionResult<NodeData, EdgeData>[]; // Detailed results per action (internal use mainly).
    affectedNodes: Node<NodeData>[]; // Nodes created or modified by SET.
    affectedEdges: Edge<EdgeData>[]; // Edges created or modified by SET.
    deletedNodeIds?: NodeId[];       // IDs of nodes deleted by DELETE/DETACH DELETE.
    deletedEdgeKeys?: string[];      // Keys ('source-label-target') of edges deleted by DELETE/DETACH DELETE.
  };
}

// Structure of a single returned value within a row
interface ReturnedValue<NodeData = any, EdgeData = any> {
  name: string; // The variable or property name (e.g., "p", "p.name")
  value: Node<NodeData> | Edge<EdgeData> | any; // The actual value (Node, Edge, or primitive)
  type: 'node' | 'edge' | 'property'; // Type indicator
}
```

### Read and Write Queries

The engine handles queries that only read data (`MATCH...RETURN`), only write data (`CREATE...`), or do both (`MATCH...SET...RETURN`). The `QueryResult` object will contain the relevant `query` and/or `actions` sections based on the clauses used.

```typescript
// Read-only
const readResult = engine.executeQuery(graph, 'MATCH (n:User) RETURN n.name');
// readResult.query will be populated, readResult.actions will be undefined

// Write-only
const writeResult = engine.executeQuery(graph, 'CREATE (:Log {message: "System start"})');
// writeResult.query will be undefined, writeResult.actions will be populated

// Read-Write
const readWriteResult = engine.executeQuery(graph, 'MATCH (p:Product {id: "prod1"}) SET p.viewCount = p.viewCount + 1 RETURN p.id, p.viewCount');
// readWriteResult.query and readWriteResult.actions will both be populated
```

## Formatting Results (`QueryFormatter`)

The `QueryFormatter` takes a `QueryResult` object and converts the `query` part into human-readable formats.

### Text Table

```typescript
const result = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
console.log(formatter.toTextTable(result));
/* Example Output:
p.name  | p.age
--------+------
"Alice" | 31
"Bob"   | 25
*/
```

### Markdown Table

```typescript
const result = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
console.log(formatter.toMarkdownTable(result));
/* Example Output:
| p.name | p.age |
| --- | --- |
| "Alice" | 31 |
| "Bob" | 25 |
*/
```

### JSON Output

The `toJSON` method provides a comprehensive JSON representation of the *entire* `QueryResult`, including success status, stats, query data (formatted as an array of objects), and action summaries.

```typescript
const result = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
console.log(formatter.toJSON(result, { prettyPrint: true, indentSpaces: 2 }));
/* Example Output:
{
  "success": true,
  "matchCount": 2,
  "statement": "MATCH (p:Person) RETURN p.name, p.age",
  "stats": {
    "readOperations": true,
    "writeOperations": false,
    "executionTimeMs": 1
  },
  "query": [
    {
      "p.name": "Alice",
      "p.age": 31
    },
    {
      "p.name": "Bob",
      "p.age": 25
    }
  ]
}
*/

// Example with actions
const actionResult = engine.executeQuery(graph, 'CREATE (t:Tag {name: "Urgent"})');
console.log(formatter.toJSON(actionResult, { prettyPrint: false }));
/* Example Output (condensed):
{"success":true,"matchCount":1,"statement":"CREATE (t:Tag {name: \"Urgent\"})","stats":{"readOperations":false,"writeOperations":true,"executionTimeMs":0},"actions":{"affectedNodesCount":1,"affectedEdgesCount":0}}
*/
```

### Formatting Options

Formatters accept an optional `QueryFormatterOptions` object:

```typescript
interface QueryFormatterOptions {
  includeNulls?: boolean;     // Default: true
  maxValueLength?: number;    // Default: 100 (truncate long strings)
  includeIds?: boolean;       // Default: true (include node/edge IDs in JSON/object output)
  prettyPrint?: boolean;      // Default: true (for JSON output)
  indentSpaces?: number;      // Default: 2 (for JSON output)
}

// Example: JSON without IDs, not pretty-printed
console.log(formatter.toJSON(result, { includeIds: false, prettyPrint: false }));
```

## Working with Results (`QueryUtils`)

The `QueryUtils` class helps extract specific information from the `QueryResult` object.

### Extracting a Column

Get all values from a specific column as an array.

```typescript
const result = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
const names = utils.extractColumn(result, 'p.name'); // ["Alice", "Bob"]
const ages = utils.extractColumn(result, 'p.age');   // [31, 25]
```

### Converting to Object Array

Transform the result rows into an array of plain JavaScript objects, where keys are column names.

```typescript
const result = engine.executeQuery(graph, 'MATCH (p:Person) RETURN p.name, p.age');
const people = utils.toObjectArray(result);
console.log(people);
/* Output:
[
  { "p.name": "Alice", "p.age": 31 },
  { "p.name": "Bob", "p.age": 25 }
]
*/
```

### Extracting Nodes/Edges

Get unique Node or Edge objects returned anywhere in the result set.

```typescript
const result = engine.executeQuery(graph, 'MATCH (p:Person)-[r:KNOWS]->(f:Person) RETURN p, r, f.name');

const nodes = utils.extractNodes(result); // Array of unique Person Node objects (p and f)
const edges = utils.extractEdges(result); // Array of unique KNOWS Edge objects (r)

console.log(`Found ${nodes.length} unique nodes.`);
console.log(`Found ${edges.length} unique edges.`);
```

### Creating a Subgraph

Generate a new `Graph` instance containing only the nodes and edges present in the query result.

```typescript
const result = engine.executeQuery(graph, 'MATCH (p:Person {name:"Alice"})-[r:KNOWS]->(f:Person) RETURN p, r, f');
const subgraph = utils.toSubgraph(result);

console.log(subgraph.hasNode('alice')); // true
console.log(subgraph.hasNode('bob'));   // true (if Alice knows Bob)
console.log(subgraph.hasEdge('alice', 'bob', 'KNOWS')); // true
console.log(subgraph.getAllNodes().length); // Typically 2 (Alice and Bob)
```

### Checking for Empty Results

```typescript
const result = engine.executeQuery(graph, 'MATCH (n:DoesNotExist) RETURN n');
if (utils.isEmpty(result)) {
  console.log("Query returned no results.");
}
```

### Getting a Single Value

Retrieve the value from the first column of the first row. Useful for queries expected to return a single scalar value.

```typescript
// Assume a query like 'MATCH (u:User) RETURN count(u)' was possible and returned one row/column
// const result = engine.executeQuery(graph, 'RETURN 42 AS answer'); // Example if literals worked like this
// const answer = utils.getSingleValue(result); // 42
// const answerByName = utils.getSingleValue(result, 'answer'); // 42 (if aliases worked)

// More realistic example with current features:
const result = engine.executeQuery(graph, 'MATCH (p:Person {name:"Alice"}) RETURN p.age');
const aliceAge = utils.getSingleValue(result); // 31 (assuming Alice exists and has age 31)
```
