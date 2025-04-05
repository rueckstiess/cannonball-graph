# Cannonball Query Language Documentation

The Cannonball Query Language is a Cypher-inspired language for defining graph transformation rules. This document provides a comprehensive reference for writing and understanding rules in the system.

## Rule Basics

Rules are defined in Markdown code blocks with the `graphrule` type. Each rule consists of:

1. **Metadata**: Name, description, and priority
2. **Query**: A Cypher-like query defining pattern matching and transformations

Example:

````markdown
## Task Assignment Rule

```graphrule
name: AssignTaskToPerson
description: Creates a relationship between a person and task
priority: 10

MATCH (p:Person), (t:Task)
WHERE p.assignee = true AND t.status = "unassigned"
CREATE (p)-[r:ASSIGNED]->(t)
SET t.status = "assigned"
```
````

## Rule Structure

Rules consist of the following clauses:

- `MATCH`: Find patterns in the graph
- `WHERE`: Filter matches with conditions
- `CREATE`: Create new nodes and relationships
- `SET`: Update properties on existing nodes and relationships

### MATCH Clause

The `MATCH` clause defines patterns to find in the graph:

```
MATCH (n:Person {name: "Alice"})-[r:KNOWS]->(m:Person)
```

#### Node Patterns

Node patterns are specified in parentheses:

```
(variable:Label {property: value})
```

- `variable`: Optional name to reference the node
- `:Label`: Optional node type/label (can have multiple: `:Label1:Label2`)
- `{property: value}`: Optional property constraints

#### Relationship Patterns

Relationship patterns connect nodes:

```
-[variable:TYPE {property: value}]->
```

- `variable`: Optional name for the relationship
- `:TYPE`: Optional relationship type 
- `{property: value}`: Optional property constraints
- Direction: `->` (outgoing), `<-` (incoming), `-` (either direction)

### WHERE Clause

The `WHERE` clause filters matches with boolean conditions:

```
WHERE n.age > 30 AND (m.status = "active" OR m.role = "admin")
```

#### Operators

- Comparison: `=`, `<>`, `<`, `<=`, `>`, `>=`
- String: `STARTS WITH`, `ENDS WITH`, `CONTAINS`
- Logical: `AND`, `OR`, `NOT`, `XOR`
- Collection: `IN`
- Null checks: `IS NULL`, `IS NOT NULL`
- Existence: `EXISTS`

#### Property Access

Access properties with dot notation:

```
WHERE node.property = "value"
```

### CREATE Clause

The `CREATE` clause adds new nodes and relationships:

```
CREATE (n:NewNode {name: "Example"})-[r:CONNECTS]->(m)
```

- Creates nodes: `(n:Label {property: value})`
- Creates relationships: `(existingNode)-[r:TYPE {property: value}]->(existingNode)`

When creating relationships, both nodes must already exist (either in the graph or created earlier in the same statement).

### SET Clause

The `SET` clause updates properties on existing nodes and relationships:

```
SET n.property = "new value", r.count = 42
```

## Data Types

The language supports the following data types:

- **Strings**: Quoted text (`"example"`)
- **Numbers**: Integers and floating-point (`42`, `3.14`)
- **Booleans**: `true` and `false`
- **Null**: `null`

## Variable Length Relationships

You can match paths of variable length:

```
MATCH (a:Person)-[r:KNOWS*1..3]->(b:Person)
```

This matches paths where the relationship occurs 1 to 3 times.

## Examples

### Basic Pattern Matching

```graphrule
MATCH (p:Person {name: "John"})
```

### Multiple Patterns

```graphrule
MATCH (p:Person), (t:Task)
WHERE p.department = t.assignedDept
```

### Condition Filtering

```graphrule
MATCH (p:Person)-[r:MANAGES]->(e:Person)
WHERE p.department = "Engineering" AND e.level > 3
```

### Creating Nodes

```graphrule
MATCH (p:Person {name: "John"})
CREATE (t:Task {title: "New Task", priority: "High"})
CREATE (p)-[r:OWNS {created: "2023-05-01"}]->(t)
```

### Updating Properties

```graphrule
MATCH (t:Task)
WHERE t.status = "completed"
SET t.archived = true, t.completionDate = "2023-05-15"
```

### Path Existence Check

```graphrule
MATCH (a:Person), (b:Task)
WHERE NOT EXISTS((a)-[:ASSIGNED]->(b))
CREATE (a)-[r:NEEDS_ASSIGNMENT]->(b)
```

## Integration with Cannonball

Rules are executed by the Rule Engine:

```typescript
import { Graph } from '@/graph';
import { createRuleEngine } from '@/rules';

// Create a graph and rule engine
const graph = new Graph();
const engine = createRuleEngine();

// Add data to graph
graph.addNode('person1', { name: 'Alice', labels: ['Person'] });

// Execute rules from markdown
const markdown = `...rule markdown...`;
const results = engine.executeRulesFromMarkdown(graph, markdown);
```

## Technical Notes

1. Node labels are typically stored in a `labels` array property.
2. The rule engine processes matches in deterministic order.
3. All `MATCH` patterns are found and validated before any `CREATE` or `SET` operations.
4. Changes from one rule execution do not affect the matched patterns within the same rule.
5. Rules are executed in priority order (higher numbers first).