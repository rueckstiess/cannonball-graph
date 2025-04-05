
# Graph Rule Syntax Specification

This specification defines the syntax for graph transformation rules in Cannonball, using a subset of the Cypher query language embedded in Markdown.

## Rule Format

Rules are defined in Markdown code blocks with the `graphrule` type:

````markdown
```graphrule
name: RuleName
description: Description of what the rule does
priority: 50

MATCH (node:Type {property: value})
-[:RELATIONSHIP]->(otherNode:Type)
WHERE condition
CREATE|SET|DELETE actions
```
````

## Rule Metadata

Each rule begins with metadata that defines its identity and behavior:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier for the rule |
| `description` | Yes | Human-readable explanation of the rule's purpose |
| `priority` | Yes | Numeric priority (higher numbers run first) |
| `disabled` | No | Set to `true` to temporarily disable the rule |

## Implementation Phases

The rule syntax will be implemented in phases of increasing complexity:

### Phase 1 (Basic)
- Simple MATCH patterns
- Basic WHERE conditions
- CREATE and SET operations

### Phase 2 (Intermediate)
- Complex path patterns 
- DELETE and REMOVE operations
- Basic functions

### Phase 3 (Advanced)
- Advanced functions
- Complex filtering
- Pattern variables

## Cypher Syntax Support

### 1. Pattern Matching (MATCH)

The `MATCH` clause identifies patterns in the graph:

```cypher
MATCH pattern
```

#### Node Patterns

```cypher
(variable:Label {property: value})
```

- `variable`: Optional name to reference the node later
- `Label`: Optional node type (can include multiple with `:Label1:Label2`)
- `{property: value}`: Optional property constraints

Examples:
```cypher
(task)                      // Any node, referenced as 'task'
(t:Task)                    // Any node with label 'Task'
(:ListItem)                 // Any node with label 'ListItem' (no variable)
(t:Task {completed: false}) // Task node where completed=false
```

#### Relationship Patterns

```cypher
(node1)-[variable:TYPE {property: value}]->(node2)
```

- Direction: `->` (outgoing) or `<-` (incoming) or `-` (either direction)
- `variable`: Optional name to reference the relationship
- `TYPE`: Optional relationship type
- `{property: value}`: Optional property constraints

Examples:
```cypher
(a)-[:CONTAINS]->(b)            // a has CONTAINS relationship to b
(a)<-[:DEPENDS_ON]-(b)          // b depends on a
(a)-[r:LINKS_TO {weight: 5}]->(b)  // Named relationship with property
```

#### Path Patterns

Patterns can be chained to create paths:

```cypher
(a)-[:CONTAINS]->(b)-[:CONTAINS]->(c)
```

This matches nodes where `a` contains `b` and `b` contains `c`.

#### Variable Length Paths

For traversing multiple relationships of the same type:

```cypher
(a)-[:CONTAINS*1..3]->(b)  // 1 to 3 CONTAINS relationships
(a)-[:CONTAINS*]->(b)      // Any number of CONTAINS relationships
(a)-[:CONTAINS*1..]->(b)   // At least 1 CONTAINS relationship
```

### 2. Filtering (WHERE)

The `WHERE` clause filters matched patterns:

```cypher
WHERE condition
```

#### Comparison Operators

- `=`, `<>` (not equal)
- `<`, `<=`, `>`, `>=`
- `IS NULL`, `IS NOT NULL`

#### Boolean Operators

- `AND`, `OR`, `NOT`
- `XOR` (exclusive OR)

#### String Operators

- `STARTS WITH`, `ENDS WITH`, `CONTAINS`

#### Collection Operators

- `IN` - check if element is in a list
- `[]` - list indexing

#### Path Existence

```cypher
WHERE EXISTS((a)-[:DEPENDS_ON]->(b))  // Check if relationship exists
WHERE NOT EXISTS((a)-[:COMPLETED]->()) // Check relationship doesn't exist
```

### 3. Modification Clauses

#### CREATE

Adds nodes and relationships:

```cypher
CREATE (n:Task {name: "New Task"})
CREATE (a)-[:DEPENDS_ON]->(b)
```

#### SET

Updates properties and labels:

```cypher
SET node.property = value
SET node.property = node.property + 1
SET node += {prop1: value1, prop2: value2}  // Set multiple properties
SET node:NewLabel  // Add a label
```

#### REMOVE

Removes properties and labels:

```cypher
REMOVE node.property  // Remove a property
REMOVE node:Label     // Remove a label
```

#### DELETE

Removes nodes and relationships:

```cypher
DELETE node, relationship
```

Note: To delete a node, all its relationships must be deleted first or use `DETACH DELETE node`.

### 4. Core Functions

#### String Functions

- `toLower(string)`, `toUpper(string)`
- `trim(string)`, `substring(string, start, length)`
- `replace(string, search, replace)`

#### Numeric Functions

- `abs(number)`, `sign(number)`
- `round(number)`, `floor(number)`, `ceiling(number)`
- `rand()` - random number between 0 and 1

#### Aggregation Functions

- `count(expression)`
- `collect(expression)` - collect values into a list
- `sum(expression)`, `avg(expression)`
- `min(expression)`, `max(expression)`

#### List Functions

- `size(list)` - number of elements in a list
- `head(list)`, `tail(list)`, `last(list)`

#### Date/Time Functions

- `timestamp()` - current timestamp
- `date()` - current date

## Example Rules

### Basic (Phase 1)

```graphrule
name: TaskDependencies
description: Creates dependency relationships between nested tasks
priority: 50

MATCH (parent:listItem {isTask: true})
-[:renders]->(:list)
-[:renders]->(child:listItem {isTask: true})
WHERE NOT EXISTS((parent)-[:dependsOn]->(child))
CREATE (parent)-[:dependsOn {auto: true}]->(child)
```

### Intermediate (Phase 2)

```graphrule
name: HeadingContainment
description: Content after a heading belongs to that heading
priority: 60

MATCH (heading:heading)
-[:nextSibling*1..]->(content)
WHERE NOT EXISTS {
  (heading)-[:nextSibling*1..]->(otherHeading:heading)
  -[:nextSibling*0..]->(content)
  WHERE otherHeading.depth <= heading.depth
}
CREATE (heading)-[:contains]->(content)
```

```graphrule
name: AutoCompleteParent
description: When all subtasks are complete, mark parent task as complete
priority: 40

MATCH (parent:listItem {isTask: true})
-[:dependsOn]->(child:listItem {isTask: true})
WHERE count(child) > 0 
AND NOT EXISTS(
  (parent)-[:dependsOn]->(someChild:listItem {isTask: true, completed: false})
)
SET parent.completed = true,
    parent.completedDate = timestamp()
```

### Advanced (Phase 3)

```graphrule
name: RelatedTopics
description: Connect notes with similar keywords
priority: 30

MATCH (note1:note), (note2:note)
WHERE note1 <> note2
AND any(keyword IN note1.tags WHERE keyword IN note2.tags)
AND NOT EXISTS((note1)-[:relatedTo]->(note2))
CREATE (note1)-[:relatedTo {reason: "shared tags"}]->(note2)
```

## Rule Groups

Rules can be organized into logical groups using the `graphrule-group` block:

````markdown
```graphrule-group
name: TaskManagement
description: Rules for managing tasks and dependencies
priority: 50
rules:
  - TaskDependencies
  - AutoCompleteParent
  - TaskBlockers
```
````

Groups allow for:
- Organizing related rules
- Enabling/disabling sets of rules together
- Assigning priority to multiple rules at once
- Conditional application of rule sets

## Implementation Considerations

1. Rule parsing should be forgiving of whitespace and formatting
2. Clear error messages should be provided for syntax errors
3. Rules should be validated before execution
4. The system should document which Cypher features are supported
5. Performance optimizations should focus on the most commonly used patterns



