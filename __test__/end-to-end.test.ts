import { Graph } from '@/graph';
import { createRuleEngine, RuleEngine, GraphQueryResult } from '@/rules';
import { QueryFormatter, createQueryFormatter } from '@/rules';

describe('End-to-End Query Tests', () => {
  let graph: Graph<any, any>;
  let engine: RuleEngine;
  let formatter: QueryFormatter;

  beforeEach(() => {
    // Create a new graph for each test
    graph = new Graph<any, any>();
    engine = createRuleEngine();
    formatter = createQueryFormatter();

    // Add nodes with different types and properties
    // People
    graph.addNode('alice', 'person', { name: 'Alice', age: 30, active: true });
    graph.addNode('bob', 'person', { name: 'Bob', age: 40, active: true });
    graph.addNode('charlie', 'person', { name: 'Charlie', age: 25, active: false });
    graph.addNode('dave', 'person', { name: 'Dave', age: 35, active: true });
    graph.addNode('eve', 'person', { name: 'Eve', age: 28, active: true });

    // Organizations
    graph.addNode('techCorp', 'company', { name: 'TechCorp', active: true });
    graph.addNode('eduInst', 'university', { name: 'EduInst' });

    // Tasks
    graph.addNode('task1', 'task', { name: 'Fix bug', active: true, priority: 'high' });
    graph.addNode('task2', 'task', { name: 'Write docs', active: false, priority: 'medium' });
    graph.addNode('task3', 'task', { name: 'Deploy app', active: true, priority: 'high' });

    // Categories
    graph.addNode('cat1', 'category', { name: 'Work', tags: ['important', 'professional'] });
    graph.addNode('cat2', 'category', { name: 'Personal', tags: ['leisure', 'health'] });

    // Create a social network with KNOWS relationships
    // Alice knows Bob, Charlie, and Eve
    graph.addEdge('alice', 'bob', 'KNOWS', { since: '2020-01-01', weight: 5 });
    graph.addEdge('alice', 'charlie', 'KNOWS', { since: '2021-02-15', weight: 3 });
    graph.addEdge('alice', 'eve', 'KNOWS', { since: '2019-06-10', weight: 4 });

    // Bob knows Charlie and Dave
    graph.addEdge('bob', 'charlie', 'KNOWS', { since: '2018-12-05', weight: 2 });
    graph.addEdge('bob', 'dave', 'KNOWS', { since: '2022-03-20', weight: 3 });

    // Charlie knows Eve
    graph.addEdge('charlie', 'eve', 'KNOWS', { since: '2020-07-18', weight: 4 });

    // Dave knows Eve
    graph.addEdge('dave', 'eve', 'KNOWS', { since: '2021-11-03', weight: 1 });

    // Eve knows Alice (closes the loop)
    graph.addEdge('eve', 'alice', 'KNOWS', { since: '2022-01-25', weight: 5 });

    // WORKS_AT relationships
    graph.addEdge('alice', 'techCorp', 'WORKS_AT', { since: '2018-05-01', role: 'Engineer' });
    graph.addEdge('bob', 'techCorp', 'WORKS_AT', { since: '2019-10-15', role: 'Manager' });
    graph.addEdge('charlie', 'eduInst', 'STUDIES_AT', { since: '2020-09-01', program: 'Computer Science' });

    // ASSIGNED relationships
    graph.addEdge('alice', 'task1', 'ASSIGNED', { since: '2023-01-01' });
    graph.addEdge('bob', 'task2', 'ASSIGNED', { since: '2023-02-15' });
    graph.addEdge('charlie', 'task3', 'ASSIGNED', { since: '2023-03-10' });

    // BELONGS_TO relationships
    graph.addEdge('task1', 'cat1', 'BELONGS_TO', { primary: true });
    graph.addEdge('task2', 'cat1', 'BELONGS_TO', { primary: true });
    graph.addEdge('task3', 'cat2', 'BELONGS_TO', { primary: true });
  });

  describe('1. MATCH Clause Tests', () => {
    test('Match by node type', () => {
      const query = `MATCH (p:person) RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(5); // All 5 person nodes
      expect(result.query?.rows.length).toBe(5);
    });

    test('Match by multiple node types', () => {
      const query = `MATCH (t:task:active) RETURN t`;

      const result = engine.executeQuery(graph, query);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/single label supported, but got task,active/g)
      expect(result.matchCount).toBe(0); // None match both task AND active as types
    });

    test('Match with property constraints', () => {
      const query = `MATCH (p:person {age: 30}) RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1); // Only Alice has age 30
      expect(result.query?.rows[0][0].value.data.name).toBe('Alice');
    });

    test('Match with multiple properties', () => {
      const query = `MATCH (p:person {age: 30, active: true}) RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1); // Only Alice matches both criteria
      expect(result.query?.rows[0][0].value.data.name).toBe('Alice');
    });

    test('Match simple relationship', () => {
      const query = `MATCH (p:person)-[r:KNOWS]->(f:person) RETURN p, r, f`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(8); // 8 KNOWS relationships in the test graph
      expect(result.query?.rows.length).toBe(8);
    });

    test('Match specific relationship direction', () => {
      const query = `MATCH (p:person)<-[r:KNOWS]-(f:person) RETURN p, r, f`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(8); // 8 KNOWS relationships in the reverse direction
    });

    test('Match undirected relationship', () => {
      const query = `MATCH (p:person)-[r:KNOWS]-(f:person) RETURN p, r, f`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(16); // 8 in each direction = 16 total
    });

    test('Match relationship with property constraints', () => {
      const query = `MATCH (p:person)-[r:KNOWS {weight: 5}]->(f:person) RETURN p, r, f`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(2); // Alice->Bob and Eve->Alice have weight 5
      expect(result.query?.rows.length).toBe(2);
    });

    test('Match multiple patterns (cross product)', () => {
      const query = `MATCH (p:person), (t:task) RETURN p, t`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(15); // 5 persons × 3 tasks = 15 combinations
      expect(result.query?.rows.length).toBe(15);
    });

    test.skip('Match complex pattern chains', () => {
      const query = `MATCH (p:person)-[:WORKS_AT]->(c:company)<-[:WORKS_AT]-(coworker:person) RETURN p, coworker`;
      const result = engine.executeQuery(graph, query);

      // BUG: returns alice->alice and bob->bob as well, which is not expected

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(2); // Alice and Bob are coworkers
      expect(result.query?.rows.length).toBe(2);
    });
  });

  describe('2. WHERE Clause Tests', () => {
    test('WHERE with equality comparison', () => {
      const query = `MATCH (p:person) WHERE p.name = "Alice" RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);
      expect(result.query?.rows[0][0].value.data.name).toBe('Alice');
    });


    test('WHERE on two variables, return relationship', () => {
      const query = `
        MATCH (p:person)-[r:KNOWS]->(f:person)
        WHERE p.name = "Alice" AND f.name = "Bob"
        RETURN r
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);
    });

    test('WHERE on two variables, return relationship property', () => {
      const query = `
        MATCH (p:person)-[r:KNOWS]->(f:person)
        WHERE p.name = "Alice" AND f.name = "Bob"
        RETURN r.weight
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);
      expect(result.query?.rows[0][0].value).toBe(5);
    });

    test('WHERE with inequality comparison', () => {
      const query = `MATCH (p:person) WHERE p.age <> 30 RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(4); // All except Alice
    });

    test('WHERE with greater than comparison', () => {
      const query = `MATCH (p:person) WHERE p.age > 30 RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(2); // Bob (40) and Dave (35)
    });

    test('WHERE with less than comparison', () => {
      const query = `MATCH (p:person) WHERE p.age < 30 RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(2); // Charlie (25) and Eve (28)
    });

    test('WHERE with greater than or equal comparison', () => {
      const query = `MATCH (p:person) WHERE p.age >= 30 RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(3); // Alice (30), Bob (40), and Dave (35)
    });

    test('WHERE with less than or equal comparison', () => {
      const query = `MATCH (p:person) WHERE p.age <= 30 RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(3); // Alice (30), Charlie (25), and Eve (28)
    });

    test('WHERE with CONTAINS string operator', () => {
      const query = `MATCH (c:category) WHERE c.name CONTAINS "Work" RETURN c`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);
      expect(result.query?.rows[0][0].value.data.name).toBe('Work');
    });

    test('WHERE with STARTS WITH string operator', () => {
      const query = `MATCH (p:person) WHERE p.name STARTS WITH "A" RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);
      expect(result.query?.rows[0][0].value.data.name).toBe('Alice');
    });

    test('WHERE with ENDS WITH string operator', () => {
      const query = `MATCH (p:person) WHERE p.name ENDS WITH "e" RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(4); // Alice, Charlie, Dave, Eve
    });

    test('WHERE with AND operator', () => {
      const query = `MATCH (p:person) WHERE p.age > 25 AND p.active = true RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(4); // Alice, Bob, Dave, Eve
    });

    test('WHERE with OR operator', () => {
      const query = `MATCH (p:person) WHERE p.age < 30 OR p.active = false RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(2); // Charlie, Eve
    });

    test('WHERE with NOT operator', () => {
      const query = `MATCH (p:person) WHERE NOT p.active = true RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1); // Only Charlie is inactive
    });

    test.skip('WHERE with IN operator', () => {
      const query = `MATCH (p:person) WHERE p.name IN ["Alice", "Bob", "Eve"] RETURN p`;
      const result = engine.executeQuery(graph, query);

      // BUG: IN expression with Array syntax leads to parser error

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(3); // Alice, Bob, Eve
    });

    test('WHERE with IS NULL operator', () => {
      const query = `MATCH (n) WHERE n.missing IS NULL RETURN n`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      // All nodes should match since none have a 'missing' property
      expect(result.matchCount).toBe(12); // 5 people + 2 orgs + 3 tasks + 2 categories
    });

    test('WHERE with IS NOT NULL operator', () => {
      const query = `MATCH (p:person) WHERE p.age IS NOT NULL RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(5); // All 5 people have an age
    });

    test('WHERE with EXISTS pattern check', () => {
      const query = `MATCH (p:person) WHERE EXISTS((p)-[:ASSIGNED]->(:task)) RETURN p`;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(3); // Alice, Bob, Charlie have assigned tasks
    });

    // SKIPPING THIS TEST FOR NOW AS IT GETS STUCK IN AN INFINITE LOOP
    test.skip('WHERE with complex nested conditions', () => {
      const query = `
        MATCH (p:person)
        WHERE (p.age > 30 AND p.active = true) OR (p.name = "Charlie" AND p.age < 30)
        RETURN p
      `;
      const result = engine.executeQuery(graph, query);

      // BUG: Get's stuck in an infinite loop!!! 

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(3); // Bob, Dave, and Charlie
    });
  });

  describe('3. CREATE Clause Tests', () => {
    test('Create a simple node', () => {
      const query = `
        CREATE (n:project {name: "New Project", status: "Planning"})
        RETURN n
      `;
      const result = engine.executeQuery(graph, query);

      // BUG: created node has no type, but instead a labels[] property 

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);
      expect(result.query?.rows[0][0].value.data.name).toBe('New Project');

      // Verify node is in the graph
      const nodes = graph.getAllNodes().filter(n => n.label === 'project');
      expect(nodes.length).toBe(1);
      expect(nodes[0].data.name).toBe('New Project');
    });

    test('Fail when trying to create a node with multiple types', () => {
      const query = `
        CREATE (n:task:priority {title: "Important Task", due: "2023-12-31"})
        RETURN n
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Only a single label supported, but got task,priority/)
    });

    test('Create a relationship between existing nodes', () => {
      const query = `
        MATCH (p:person), (t:task)
        WHERE p.name = "Dave" AND t.name = "Deploy app"
        CREATE (p)-[r:ASSIGNED {date: "2023-06-01"}]->(t)
        RETURN r
      `;
      const result = engine.executeQuery(graph, query);

      // BUG: Matcher with WHERE clause returned 0 matches, no relationships were created

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);

      // Check the returned relationship
      const rel = result.query?.rows[0][0].value;
      expect(rel.label).toBe('ASSIGNED');
      expect(rel.data.date).toBe('2023-06-01');

      // Verify the relationship exists in the graph
      const relationships = graph.getEdgesForNode('dave').filter(e => e.target === 'task3');
      const assignedRel = relationships.find(r => r.label === 'ASSIGNED');
      expect(assignedRel).toBeDefined();
      expect(assignedRel?.data.date).toBe('2023-06-01');
    });

    test.skip('Create multiple nodes and relationships in one query', () => {
      const query = `
        CREATE (p:project {name: "Website Redesign"})
        CREATE (t1:task {name: "Design Mockups"})
        CREATE (t2:task {name: "Frontend Implementation"})
        CREATE (p)-[:CONTAINS]->(t1)
        CREATE (p)-[:CONTAINS]->(t2)
        CREATE (t1)-[:PRECEDES]->(t2)
        RETURN p, t1, t2
      `;
      const result = engine.executeQuery(graph, query);

      // BUG: Parse errors: Expected ']' after relationship details

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);
      expect(result.query?.rows[0].length).toBe(3); // p, t1, t2 returned

      // Get the created node IDs
      const projId = result.query?.rows[0][0].value.id;
      const task1Id = result.query?.rows[0][1].value.id;
      const task2Id = result.query?.rows[0][2].value.id;

      // Verify relationships were created
      const projToTask1 = graph.getEdgesForNode(projId).filter(e => e.target === task1Id);
      const projToTask2 = graph.getEdgesForNode(projId).filter(e => e.target === task2Id);
      const task1ToTask2 = graph.getEdgesForNode(task1Id).filter(e => e.target === task2Id);

      expect(projToTask1.length).toBe(1);
      expect(projToTask1[0].label).toBe('CONTAINS');
      expect(projToTask2.length).toBe(1);
      expect(projToTask2[0].label).toBe('CONTAINS');
      expect(task1ToTask2.length).toBe(1);
      expect(task1ToTask2[0].label).toBe('PRECEDES');
    });

    test.skip('Create node based on matched patterns', () => {
      const query = `
        MATCH (p:person)
        WHERE p.name = "Alice"
        CREATE (t:task {name: "Review PR", assignee: p.name})
        CREATE (p)-[:ASSIGNED]->(t)
        RETURN t
      `;
      const result = engine.executeQuery(graph, query);

      // BUG: Parse errors: Expected a literal value after ':' for property assignee

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);

      // Check the task was created with correct attributes
      const task = result.query?.rows[0][0].value;
      expect(task.data.name).toBe('Review PR');
      expect(task.data.assignee).toBe('Alice');

      // Verify the relationship was created
      const relationships = graph.getEdgesForNode('alice').filter(e => e.target === task.id);
      expect(relationships.length).toBe(1);
      expect(relationships[0].label).toBe('ASSIGNED');
    });
  });

  describe('4. SET Clause Tests', () => {
    test('SET a single property', () => {
      const query = `
        MATCH (t:task)
        WHERE t.name = "Fix bug"
        SET t.status = "In Progress"
        RETURN t
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);

      // Check that status was updated
      const task = result.query?.rows[0][0].value;
      expect(task.data.status).toBe('In Progress');

      // Verify in the graph
      const node = graph.getNode('task1');
      expect(node?.data.status).toBe('In Progress');
    });

    test('SET multiple properties', () => {
      const query = `
        MATCH (t:task)
        WHERE t.name = "Write docs"
        SET t.status = "Completed", t.completedDate = "2023-06-15"
        RETURN t
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);

      // Check that properties were updated
      const task = result.query?.rows[0][0].value;
      expect(task.data.status).toBe('Completed');
      expect(task.data.completedDate).toBe('2023-06-15');

      // Verify in the graph
      const node = graph.getNode('task2');
      expect(node?.data.status).toBe('Completed');
      expect(node?.data.completedDate).toBe('2023-06-15');
    });

    test('SET properties on relationship', () => {
      const query = `
        MATCH (p:person)-[r:KNOWS]->(f:person)
        WHERE p.name = "Alice" AND f.name = "Bob"
        SET r.strength = 10, r.updatedAt = "2023-06-15"
        RETURN r
      `;
      const result = engine.executeQuery(graph, query);

      // BUG: Maybe? The actionResults array is deeply nested, not sure if this is expected

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);

      // Check that relationship properties were updated
      const rel = result.query?.rows[0][0].value;
      expect(rel.data.strength).toBe(10);
      expect(rel.data.updatedAt).toBe('2023-06-15');

      // Verify in the graph
      const edges = graph.getEdgesForNode('alice').filter(e => e.target === 'bob');
      const edge = edges.find(e => e.label === 'KNOWS');
      expect(edge?.data.strength).toBe(10);
      expect(edge?.data.updatedAt).toBe('2023-06-15');
    });
  });

  describe('5. RETURN Clause Tests', () => {
    test('RETURN single node', () => {
      const query = `
        MATCH (p:person)
        WHERE p.name = "Alice"
        RETURN p
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);
      expect(result.query?.rows.length).toBe(1);
      expect(result.query?.rows[0][0].value.data.name).toBe('Alice');
    });

    test('RETURN multiple nodes', () => {
      const query = `
        MATCH (p:person)-[:KNOWS]->(f:person)
        RETURN p, f
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(8); // 8 KNOWS relationships
      expect(result.query?.rows.length).toBe(8);
      expect(result.query?.columns).toEqual(['p', 'f']);
    });

    test('RETURN specific properties', () => {
      const query = `
        MATCH (p:person)
        RETURN p.name, p.age
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(5); // 5 persons
      expect(result.query?.rows.length).toBe(5);
      expect(result.query?.columns).toEqual(['p.name', 'p.age']);

      // Verify property values
      const names = result.query?.rows.map(row => row[0].value);
      const ages = result.query?.rows.map(row => row[1].value);
      expect(names).toContain('Alice');
      expect(names).toContain('Bob');
      expect(ages).toContain(30);
      expect(ages).toContain(40);
    });

    test('RETURN relationship', () => {
      const query = `
        MATCH (p:person)-[r:KNOWS]->(f:person)
        RETURN r
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(8); // 8 KNOWS relationships
      expect(result.query?.rows.length).toBe(8);
      expect(result.query?.columns).toEqual(['r']);

      // Verify all returned items are relationships
      result.query?.rows.forEach(row => {
        expect(row[0].type).toBe('edge');
        expect(row[0].value.label).toBe('KNOWS');
      });
    });

    test.skip('RETURN relationship properties', () => {
      const query = `
        MATCH (p:person)-[r:KNOWS]->(f:person)
        RETURN r.since, r.weight
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      // expect(result.matchCount).toBe(8);
      // expect(result.query?.rows.length).toBe(8);
      expect(result.query?.columns).toEqual(['r.since', 'r.weight']);

      // BUG: value missing from relation data

      // Check all rows have since and weight properties
      result.query?.rows.forEach(row => {
        expect(row[0].type).toBe('property');
        expect(row[1].type).toBe('property');
        expect(typeof row[0].value).toBe('string'); // since dates
        expect(typeof row[1].value).toBe('number'); // weight numbers
      });
    });

    test.skip('RETURN mixed node and relationship data', () => {
      const query = `
        MATCH (p:person)-[r:WORKS_AT]->(c:company)
        RETURN p.name, r.role, c.name
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(2); // Alice and Bob work at TechCorp
      expect(result.query?.rows.length).toBe(2);
      expect(result.query?.columns).toEqual(['p.name', 'r.role', 'c.name']);

      // BUG: value missing from relationships

      // Check specific values
      const names = result.query?.rows.map(row => row[0].value);
      const roles = result.query?.rows.map(row => row[1].value);
      const companies = result.query?.rows.map(row => row[2].value);

      expect(names).toContain('Alice');
      expect(names).toContain('Bob');
      expect(roles).toContain('Engineer');
      expect(roles).toContain('Manager');
      expect(companies).toEqual(['TechCorp', 'TechCorp']);
    });
  });

  describe('6. Combined Operations Tests', () => {
    test('MATCH-WHERE-RETURN', () => {
      const query = `
        MATCH (p:person)-[r:KNOWS]->(f:person)
        WHERE p.age > 30 AND r.weight >= 3
        RETURN p.name, f.name, r.weight
      `;
      const result = engine.executeQuery(graph, query);

      // BUG: Returns no matches

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1); // Only Bob->Dave meets both criteria
      expect(result.query?.rows.length).toBe(1);

      // Check specific values
      expect(result.query?.rows[0][0].value).toBe('Bob'); // p.name
      expect(result.query?.rows[0][1].value).toBe('Dave'); // f.name
      expect(result.query?.rows[0][2].value).toBe(3); // r.weight
    });

    test('MATCH-CREATE-RETURN', () => {
      const query = `
        MATCH (p:person), (c:category)
        WHERE p.name = "Alice" AND c.name = "Work"
        CREATE (t:task {name: "New task", priority: "High"})
        CREATE (p)-[r:ASSIGNED]->(t)
        CREATE (t)-[:BELONGS_TO]->(c)
        RETURN t, r
      `;
      const result = engine.executeQuery(graph, query);

      // BUG: Doesn't match anything

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(1);
      expect(result.query?.rows.length).toBe(1);

      // Check created task
      const taskId = result.query?.rows[0][0].value.id;
      const task = graph.getNode(taskId);
      expect(task?.data.name).toBe('New task');
      expect(task?.data.priority).toBe('High');

      // Check created relationships
      const aliceToTask = graph.getEdgesForNode('alice').filter(e => e.target === taskId);
      expect(aliceToTask.length).toBe(1);
      expect(aliceToTask[0].label).toBe('ASSIGNED');

      const taskToCat = graph.getEdgesForNode(taskId).filter(e => e.target === 'cat1');
      expect(taskToCat.length).toBe(1);
      expect(taskToCat[0].label).toBe('BELONGS_TO');
    });

    test('MATCH-SET-RETURN', () => {
      const query = `
        MATCH (p:person)-[r:ASSIGNED]->(t:task)
        WHERE t.active = true
        SET t.lastUpdated = "2023-06-15", p.taskCount = 1
        RETURN p.name, t.name, t.lastUpdated, p.taskCount
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(2); // Alice->task1 and Charlie->task3
      expect(result.query?.rows.length).toBe(2);

      // Verify updated properties
      result.query?.rows.forEach(row => {
        expect(row[2].value).toBe('2023-06-15'); // t.lastUpdated
        expect(row[3].value).toBe(1); // p.taskCount
      });

      // Check in graph directly
      const alice = graph.getNode('alice');
      const task1 = graph.getNode('task1');
      expect(alice?.data.taskCount).toBe(1);
      expect(task1?.data.lastUpdated).toBe('2023-06-15');
    });

    test('Complex query with all operations', () => {
      const query = `
        MATCH (p:person)-[w:WORKS_AT]->(c:company)
        WHERE p.active = true AND c.name = "TechCorp"
        CREATE (t:task {name: "Company Project", status: "New"})
        CREATE (p)-[a:ASSIGNED {date: "2023-06-15"}]->(t)
        CREATE (t)-[:RELATED_TO]->(c)
        SET p.taskCount = 1, t.priority = "High"
        RETURN p.name, t.name, t.priority, a.date
      `;
      const result = engine.executeQuery(graph, query);

      // Bug: Validation failed: Source node t not found in bindings
      // Does CREATE need to update the binding context?

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(2); // Alice and Bob work at TechCorp
      expect(result.query?.rows.length).toBe(2);

      // Verify returned data
      result.query?.rows.forEach(row => {
        expect(['Alice', 'Bob']).toContain(row[0].value); // p.name
        expect(row[1].value).toBe('Company Project'); // t.name
        expect(row[2].value).toBe('High'); // t.priority
        expect(row[3].value).toBe('2023-06-15'); // a.date
      });

      // Get the created tasks (should be 2, one for each person)
      const createdTasks = graph.getAllNodes().filter(n =>
        n.data.type === 'task' && n.data.name === 'Company Project'
      );
      expect(createdTasks.length).toBe(2);

      // Check relationships to company
      const taskToCompanyRels = createdTasks.flatMap(task =>
        graph.getEdgesForNode(task.id).filter(e => e.target === 'techCorp')
      );
      expect(taskToCompanyRels.length).toBe(2);
      expect(taskToCompanyRels[0].label).toBe('RELATED_TO');
    });
  });

  describe('7. Edge Cases and Error Handling Tests', () => {
    test('Query with syntax error', () => {
      const query = `MATCH (p:person RETURN p`; // Missing closing parenthesis
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('Query referencing non-existent property', () => {
      const query = `
        MATCH (p:person)
        WHERE p.nonExistentProperty = "something"
        RETURN p
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(0); // No matches found, shouldn't error
    });

    test('Query matching non-existent node type', () => {
      const query = `
        MATCH (p:nonExistentType)
        RETURN p
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(0); // No matches, not an error
    });

    test('Query with empty results but valid syntax', () => {
      const query = `
        MATCH (p:person)
        WHERE p.age > 100
        RETURN p
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      expect(result.matchCount).toBe(0); // No person has age > 100
      expect(result.query?.rows.length).toBe(0);
    });

    test('Query with invalid property type comparison', () => {
      const query = `
        MATCH (p:person)
        WHERE p.name > 100
        RETURN p
      `;
      const result = engine.executeQuery(graph, query);

      expect(result.success).toBe(true);
      // String vs number comparison should not match anything
      expect(result.matchCount).toBe(0);
    });

    test('Query creating node with same ID as existing node', () => {
      // First create a node with a known ID
      const createQuery = `
        CREATE (n:project {id: "proj1", name: "Project One"})
        RETURN n
      `;
      let result = engine.executeQuery(graph, createQuery);
      expect(result.success).toBe(true);

      // Now try to create another with the same ID property
      const duplicateQuery = `
        CREATE (n:project {id: "proj1", name: "Another Project"})
        RETURN n
      `;
      result = engine.executeQuery(graph, duplicateQuery);


      // BUG: CREATE doesn't create type property but labels

      // This should still succeed - we just create another node with the same property
      expect(result.success).toBe(true);

      // But now we should have two nodes with id property "proj1"
      const nodes = graph.getAllNodes().filter(n =>
        n.label === 'project' && n.data.id === 'proj1'
      );
      expect(nodes.length).toBe(2);
    });
  });
});