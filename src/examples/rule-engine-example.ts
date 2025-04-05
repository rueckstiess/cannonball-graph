import { Graph } from '@/graph';
import { createRuleEngine } from '@/rules';

/**
 * Comprehensive example of using the rule engine, showcasing all features
 * of the Cannonball query language in a progressive tutorial format.
 */
function ruleEngineExample() {
  console.log('=======================================');
  console.log('Cannonball Rule Engine Tutorial Example');
  console.log('=======================================\n');

  // Initialize graph and rule engine
  const graph = new Graph();
  const engine = createRuleEngine();

  // Create initial data structure
  console.log('1. Setting up initial graph data...');
  setupInitialGraphData(graph);
  logGraphState(graph, 'Initial graph state');

  // -------------------------------------------------------------------------
  // Part 1: Basic MATCH demonstration
  // -------------------------------------------------------------------------
  console.log('\n2. Demonstrating basic MATCH...');
  const basicMatchRule = `
## Find People
\`\`\`graphrule
name: FindPeople
description: Simple rule to find all Person nodes
priority: 10

MATCH (p:Person)
CREATE (p)-[r:MATCHED {timestamp: "2023-01-15"}]->(p)
\`\`\`  
  `;

  console.log('RULE: Find all Person nodes and create self-reference');
  const basicMatchResults = engine.executeGraphQueriesFromMarkdown(graph, basicMatchRule);
  logRuleResults(basicMatchResults);
  logGraphState(graph, 'After basic MATCH');

  // -------------------------------------------------------------------------
  // Part 2: Property constraints in MATCH
  // -------------------------------------------------------------------------
  console.log('\n3. Demonstrating MATCH with property constraints...');
  const propertyMatchRule = `
## Find Senior People
\`\`\`graphrule
name: FindSeniorPeople
description: Find people with age > 30
priority: 10

MATCH (p:Person {seniorLevel: true})
CREATE (p)-[r:FLAGGED_SENIOR {timestamp: "2023-01-15"}]->(p)
\`\`\`  
  `;

  console.log('RULE: Find Person nodes with seniorLevel=true');
  const propertyMatchResults = engine.executeGraphQueriesFromMarkdown(graph, propertyMatchRule);
  logRuleResults(propertyMatchResults);
  logGraphState(graph, 'After property MATCH');

  // -------------------------------------------------------------------------
  // Part 3: Basic WHERE clause
  // -------------------------------------------------------------------------
  console.log('\n4. Demonstrating basic WHERE clause...');
  const whereRule = `
## Find Senior Engineers
\`\`\`graphrule
name: FindSeniorEngineers
description: Find engineers with age > 30
priority: 10

MATCH (p:Person)
WHERE p.age > 30 AND p.department = "Engineering"
CREATE (p)-[r:SENIOR_ENGINEER {timestamp: "2023-01-15"}]->(p)
\`\`\`  
  `;

  console.log('RULE: Find people with age > 30 AND department = "Engineering"');
  const whereResults = engine.executeGraphQueriesFromMarkdown(graph, whereRule);
  logRuleResults(whereResults);
  logGraphState(graph, 'After WHERE clause');

  // -------------------------------------------------------------------------
  // Part 4: Advanced WHERE with multiple conditions
  // -------------------------------------------------------------------------
  console.log('\n5. Demonstrating advanced WHERE conditions...');
  const advancedWhereRule = `
## Find Critical Tasks
\`\`\`graphrule
name: FindCriticalTasks
description: Find high priority tasks due soon
priority: 10

MATCH (t:Task)
WHERE t.priority = "High" AND t.dueDate CONTAINS "2023-01" AND NOT t.status = "Completed"
CREATE (t)-[r:FLAGGED_CRITICAL {reason: "High priority and due soon"}]->(t)
\`\`\`  
  `;

  console.log('RULE: Find critical tasks with multiple conditions');
  const advancedWhereResults = engine.executeGraphQueriesFromMarkdown(graph, advancedWhereRule);
  logRuleResults(advancedWhereResults);
  logGraphState(graph, 'After advanced WHERE');

  // -------------------------------------------------------------------------
  // Part 5: Basic CREATE clause for nodes
  // -------------------------------------------------------------------------
  console.log('\n6. Demonstrating CREATE for new nodes...');
  const createNodeRule = `
## Create Project
\`\`\`graphrule
name: CreateProject
description: Create a new project node
priority: 10

MATCH (p:Person)
WHERE p.name = "Alice" 
CREATE (proj:Project {name: "Mobile App", status: "Planning", labels: ["Project"]})
CREATE (p)-[r:MANAGES {since: "2023-01-01"}]->(proj)
\`\`\`  
  `;

  console.log('RULE: Create a new Project node and connect it to Alice');
  const createNodeResults = engine.executeGraphQueriesFromMarkdown(graph, createNodeRule);
  logRuleResults(createNodeResults);
  logGraphState(graph, 'After CREATE node');

  // -------------------------------------------------------------------------
  // Part 6: CREATE relationships between existing nodes
  // -------------------------------------------------------------------------
  console.log('\n7. Demonstrating CREATE for relationships...');
  const createRelationshipRule = `
## Assign Tasks
\`\`\`graphrule
name: AssignTasks
description: Assign tasks to people in the same department
priority: 10

MATCH (p:Person), (t:Task)
WHERE p.department = t.department AND t.status = "Unassigned"
CREATE (p)-[r:ASSIGNED_TO {date: "2023-01-15", auto: true}]->(t)
\`\`\`  
  `;

  console.log('RULE: Connect people to tasks in the same department');
  const createRelResults = engine.executeGraphQueriesFromMarkdown(graph, createRelationshipRule);
  logRuleResults(createRelResults);
  logGraphState(graph, 'After CREATE relationship');

  // -------------------------------------------------------------------------
  // Part 7: Basic SET clause
  // -------------------------------------------------------------------------
  console.log('\n8. Demonstrating basic SET clause...');
  const setRule = `
## Update Task Status
\`\`\`graphrule
name: UpdateTaskStatus
description: Update task status when assigned
priority: 10

MATCH (p:Person)-[r:ASSIGNED_TO]->(t:Task)
WHERE t.status = "Unassigned"
SET t.status = "In Progress", t.lastUpdated = "2023-01-15"
\`\`\`  
  `;

  console.log('RULE: Update task properties when assigned');
  const setResults = engine.executeGraphQueriesFromMarkdown(graph, setRule);
  logRuleResults(setResults);
  logGraphState(graph, 'After SET properties');

  // -------------------------------------------------------------------------
  // Part 8: Relationship pattern matching
  // -------------------------------------------------------------------------
  console.log('\n9. Demonstrating relationship pattern matching...');
  const relationshipPatternRule = `
## Find Task Chains
\`\`\`graphrule
name: FindTaskChains
description: Find tasks that depend on other tasks
priority: 10

MATCH (t1:Task)-[d:DEPENDS_ON]->(t2:Task)
WHERE t1.status = "In Progress" AND t2.status <> "Completed"
CREATE (t1)-[r:BLOCKED_BY {severity: "High"}]->(t2)
\`\`\`  
  `;

  console.log('RULE: Find task dependency relationships');
  const relPatternResults = engine.executeGraphQueriesFromMarkdown(graph, relationshipPatternRule);
  logRuleResults(relPatternResults);
  logGraphState(graph, 'After relationship pattern matching');

  // -------------------------------------------------------------------------
  // Part 9: Path existence check
  // -------------------------------------------------------------------------
  console.log('\n10. Demonstrating EXISTS path check...');
  const existsRule = `
## Check Missing Approvals
\`\`\`graphrule
name: CheckMissingApprovals
description: Find tasks without approvals 
priority: 10

MATCH (t:Task)
WHERE t.status = "Ready For Review" AND NOT EXISTS((p:Person)-[:APPROVED]->(t))
SET t.needsApproval = true, t.reminderSent = "2023-01-15"
\`\`\`  
  `;

  console.log('RULE: Check for missing approval relationships');
  const existsResults = engine.executeGraphQueriesFromMarkdown(graph, existsRule);
  logRuleResults(existsResults);
  logGraphState(graph, 'After EXISTS check');

  // -------------------------------------------------------------------------
  // Part 10: Complex multi-clause example
  // -------------------------------------------------------------------------
  console.log('\n11. Demonstrating complex multi-clause example...');
  const complexRule = `
## Project Planning
\`\`\`graphrule
name: ProjectPlanning
description: Complex rule combining multiple features
priority: 10

MATCH (proj:Project), (p:Person), (t:Task)
WHERE proj.status = "Planning" 
  AND p.department = "Engineering" 
  AND t.status = "In Progress"
  AND NOT EXISTS((t)-[:PART_OF]->(proj))
CREATE (t)-[r:PART_OF {added: "2023-01-15"}]->(proj)
CREATE (p)-[a:ASSIGNED_TO {auto: true}]->(t)
SET t.projectized = true, t.priority = "High"
\`\`\`  
  `;

  console.log('RULE: Complex multi-clause project planning rule');
  const complexResults = engine.executeGraphQueriesFromMarkdown(graph, complexRule);
  logRuleResults(complexResults);
  logGraphState(graph, 'After complex multi-clause rule');

  // -------------------------------------------------------------------------
  // Part 11: Variable-length path matching
  // -------------------------------------------------------------------------
  console.log('\n12. Demonstrating variable-length path matching...');
  const variableLengthRule = `
## Find Dependency Chains
\`\`\`graphrule
name: FindDependencyChains
description: Find chains of task dependencies 
priority: 10

MATCH (t1:Task)-[d:DEPENDS_ON*1..3]->(t2:Task)
WHERE t2.status = "Blocked"
SET t1.riskLevel = "High", t1.dependencyNote = "Dependent on blocked task"
\`\`\`  
  `;

  console.log('RULE: Find variable-length dependency chains');
  const varLengthResults = engine.executeGraphQueriesFromMarkdown(graph, variableLengthRule);
  logRuleResults(varLengthResults);
  logGraphState(graph, 'After variable-length path matching');

  // -------------------------------------------------------------------------
  // Part 12: Multiple comma-separated matches 
  // -------------------------------------------------------------------------
  console.log('\n13. Demonstrating multiple comma-separated matches...');
  const multiMatchRule = `
## Cross-Department Tasks
\`\`\`graphrule
name: CrossDepartmentTasks
description: Find tasks affecting multiple departments
priority: 10

MATCH (p1:Person {department: "Engineering"}), 
      (p2:Person {department: "Marketing"}),
      (t:Task)
WHERE t.crossDepartment = true
CREATE (p1)-[r1:COLLABORATES {task: t.id}]->(p2)
CREATE (t)-[r2:REQUIRES_COLLAB {departments: "Engineering, Marketing"}]->(t)
\`\`\`  
  `;

  console.log('RULE: Find cross-department task patterns');
  const multiMatchResults = engine.executeGraphQueriesFromMarkdown(graph, multiMatchRule);
  logRuleResults(multiMatchResults);
  logGraphState(graph, 'After multiple comma-separated matches');

  // Summary
  console.log('\n=======================================');
  console.log('Rule Engine Tutorial Example Complete');
  console.log('=======================================\n');
}

/**
 * Setup initial graph data with a variety of nodes and relationships
 */
function setupInitialGraphData(graph) {
  // Create people
  const alice = { name: 'Alice', age: 35, seniorLevel: true, department: 'Engineering', labels: ['Person'] };
  const bob = { name: 'Bob', age: 28, seniorLevel: false, department: 'Engineering', labels: ['Person'] };
  const charlie = { name: 'Charlie', age: 42, seniorLevel: true, department: 'Marketing', labels: ['Person'] };
  const diana = { name: 'Diana', age: 31, seniorLevel: true, department: 'Product', labels: ['Person'] };

  // Create tasks
  const task1 = {
    id: 'task-1',
    title: 'Fix API bug',
    priority: 'High',
    status: 'Unassigned',
    department: 'Engineering',
    dueDate: '2023-01-20',
    labels: ['Task']
  };

  const task2 = {
    id: 'task-2',
    title: 'Create marketing materials',
    priority: 'Medium',
    status: 'Unassigned',
    department: 'Marketing',
    dueDate: '2023-02-10',
    labels: ['Task']
  };

  const task3 = {
    id: 'task-3',
    title: 'Review product specs',
    priority: 'High',
    status: 'Unassigned',
    crossDepartment: true,
    department: 'Product',
    dueDate: '2023-01-15',
    labels: ['Task']
  };

  const task4 = {
    id: 'task-4',
    title: 'Deploy new feature',
    priority: 'High',
    status: 'Ready For Review',
    department: 'Engineering',
    dueDate: '2023-01-25',
    labels: ['Task']
  };

  // Add all nodes
  const aliceId = generateId('person');
  const bobId = generateId('person');
  const charlieId = generateId('person');
  const dianaId = generateId('person');

  const task1Id = generateId('task');
  const task2Id = generateId('task');
  const task3Id = generateId('task');
  const task4Id = generateId('task');

  graph.addNode(aliceId, alice);
  graph.addNode(bobId, bob);
  graph.addNode(charlieId, charlie);
  graph.addNode(dianaId, diana);

  graph.addNode(task1Id, task1);
  graph.addNode(task2Id, task2);
  graph.addNode(task3Id, task3);
  graph.addNode(task4Id, task4);

  // Add some initial relationships
  graph.addEdge(task1Id, task4Id, 'DEPENDS_ON', { critical: true });
  graph.addEdge(task3Id, task2Id, 'DEPENDS_ON', { critical: false });

  // Simulate a more complex dependency path for variable-length testing
  const task5 = {
    id: 'task-5',
    title: 'Infrastructure update',
    priority: 'Medium',
    status: 'Blocked',
    department: 'Engineering',
    dueDate: '2023-01-05',
    labels: ['Task']
  };

  const task6 = {
    id: 'task-6',
    title: 'Security audit',
    priority: 'Medium',
    status: 'In Progress',
    department: 'Engineering',
    dueDate: '2023-01-10',
    labels: ['Task']
  };

  const task5Id = generateId('task');
  const task6Id = generateId('task');

  graph.addNode(task5Id, task5);
  graph.addNode(task6Id, task6);

  graph.addEdge(task6Id, task1Id, 'DEPENDS_ON', { critical: false });
  graph.addEdge(task1Id, task5Id, 'DEPENDS_ON', { critical: true });
}

/**
 * Generate a unique ID with a given prefix
 */
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Log the current state of the graph with node and edge counts
 */
function logGraphState(graph, label) {
  console.log(`\n--- ${label} ---`);
  console.log(`Nodes: ${graph.getAllNodes().length}`);
  console.log(`Edges: ${graph.getAllEdges().length}`);

  // Count by label/type
  const personCount = graph.findNodes(n => n.data.labels?.includes('Person')).length;
  const taskCount = graph.findNodes(n => n.data.labels?.includes('Task')).length;
  const projectCount = graph.findNodes(n => n.data.labels?.includes('Project')).length;

  console.log(`Person nodes: ${personCount}`);
  console.log(`Task nodes: ${taskCount}`);
  console.log(`Project nodes: ${projectCount}`);

  // Count some relationship types
  const assignedCount = graph.findEdges(e => e.label === 'ASSIGNED_TO').length;
  const dependsOnCount = graph.findEdges(e => e.label === 'DEPENDS_ON').length;

  console.log(`ASSIGNED_TO relationships: ${assignedCount}`);
  console.log(`DEPENDS_ON relationships: ${dependsOnCount}`);
}

/**
 * Log rule execution results in a standardized format
 */
function logRuleResults(results) {
  for (const result of results) {
    console.log(`\nRule execution: ${result.statement}`);
    console.log(`Success: ${result.success}`);
    console.log(`Matches found: ${result.matchCount}`);

    if (!result.success && result.error) {
      console.log(`Error: ${result.error}`);
    }

    if (result.actions?.actionResults.length > 0) {
      console.log(`Actions performed: ${result.actions.actionResults.length}`);
    }
  }
}

// Export the example function
export default ruleEngineExample;

// Execute the example when run directly
if (import.meta.url === import.meta.resolve('./rule-engine-example.ts')) {
  console.log('Running comprehensive rule engine tutorial example...');
  ruleEngineExample();
}