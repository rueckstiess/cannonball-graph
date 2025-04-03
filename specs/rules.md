
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



## Detailed Implementation Plan for Graph Rule System

### 1. Rule Parser Foundation (Phase 1)

#### 1.1 Rule Block Extraction
- Create a function to identify and extract `graphrule` code blocks from Markdown
- Parse the rule metadata (name, description, priority)
- Validate required metadata fields are present
- Create data structures to represent rules

#### 1.2 Basic Cypher Parser - Lexical Analysis
- Implement a lexer to tokenize Cypher query text
- Define token types for keywords (MATCH, WHERE, CREATE, etc.)
- Define token types for identifiers, literals, operators, etc.
- Implement handling of whitespace and comments

#### 1.3 Basic Cypher Parser - Syntax Analysis
- Create a parser for the MATCH clause
  - Parse node patterns `(variable:Label {properties})`
  - Parse simple relationship patterns `-[:TYPE]->`
  - Parse basic path patterns (node-relationship-node)
- Create a parser for basic WHERE conditions
  - Property comparisons (equals, not equals)
  - Boolean operators (AND, OR, NOT)
  - Existence checks (EXISTS)
- Create a parser for basic CREATE/SET operations
  - Parse node creation
  - Parse relationship creation
  - Parse property setting

#### 1.4 Rule AST Generation
- Define AST (Abstract Syntax Tree) structure for rules
- Transform parsed Cypher into AST
- Implement validation of the AST
- Create visualization/debug tools for the AST

### 2. Pattern Matcher Foundation (Phase 1)

#### 2.1 Node Pattern Matching
- Implement matching for node labels
- Implement matching for node properties
- Create efficient node lookup by label

#### 2.2 Relationship Pattern Matching
- Implement matching for relationship types
- Implement matching for relationship properties
- Implement direction-aware relationship traversal

#### 2.3 Path Pattern Matching
- Implement simple path matching (fixed length)
- Create a pattern matching algorithm that connects matched nodes and relationships
- Add backtracking capability for failed matches

#### 2.4 Condition Evaluation
- Implement property access and comparison
- Implement boolean operators
- Implement existence checks
- Create a condition evaluation engine

### 3. Rule Application Engine (Phase 1)

#### 3.1 Action Execution
- Implement CREATE operations for relationships
- Implement SET operations for properties
- Create a transaction-like mechanism for applying changes

#### 3.2 Rule Scheduling
- Implement priority-based rule ordering
- Create a rule execution queue
- Add conflict detection between rules

#### 3.3 Execution Monitoring
- Add logging for rule execution
- Track executed rules
- Measure execution time and performance metrics

#### 3.4 Integration with Graph Component
- Connect rule engine to the Graph component
- Ensure efficient graph operations during rule execution

### 4. Extended Pattern Matching (Phase 2)

#### 4.1 Variable Length Paths
- Implement matching for paths with variable length (`*`)
- Implement min/max path length constraints (`*1..3`)
- Add cycle detection and handling

#### 4.2 Complex WHERE Conditions
- Implement nested pattern matching in WHERE
- Add support for more comparison operators
- Implement string operations (CONTAINS, STARTS WITH, etc.)

#### 4.3 Advanced Node/Relationship Matching
- Add support for multiple labels
- Implement negative pattern matching
- Add optional pattern matching

### 5. Extended Rule Actions (Phase 2)

#### 5.1 DELETE/REMOVE Operations
- Implement node deletion (with safety checks)
- Implement relationship deletion
- Implement property removal
- Implement label removal

#### 5.2 Basic Functions
- Implement string functions (toUpper, toLower, etc.)
- Implement numeric functions (abs, round, etc.)
- Implement conversion functions

#### 5.3 Transaction Management
- Implement rule atomic execution
- Add rollback capability for failed rules
- Implement rule dependencies

### 6. Advanced Features (Phase 3)

#### 6.1 Advanced Functions
- Implement aggregation functions (count, collect, etc.)
- Implement list operations
- Add date/time functions

#### 6.2 Complex Filtering
- Add list comprehensions
- Implement advanced string pattern matching
- Add regular expression support

#### 6.3 Pattern Variables
- Implement path variables
- Add support for reusing matched patterns
- Implement subqueries

### 7. Rule Groups and Management

#### 7.1 Rule Group Parser
- Create parser for `graphrule-group` blocks
- Implement group metadata extraction
- Add validation for group references

#### 7.2 Rule Group Execution
- Implement group-based rule scheduling
- Add group-level enable/disable functionality
- Create conditional group application

#### 7.3 Rule Management
- Implement rule repository
- Add rule versioning
- Create rule dependency tracking

