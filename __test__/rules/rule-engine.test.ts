import { Graph } from '@/graph';
import { Rule } from '@/lang/rule-parser';
import { ASTRuleRoot } from '@/lang/ast-transformer';
import { RuleEngine, createRuleEngine } from '@/rules/rule-engine';
import { BindingContext } from '@/lang/condition-evaluator';

describe('RuleEngine', () => {
  let engine: RuleEngine;
  let graph: Graph;
  
  beforeEach(() => {
    engine = createRuleEngine();
    graph = new Graph();
    
    // Set up a test graph
    graph.addNode('person1', { name: 'Alice', labels: ['Person'] });
    graph.addNode('person2', { name: 'Bob', labels: ['Person'] });
    graph.addNode('task1', { title: 'Task 1', priority: 'High', labels: ['Task'] });
    graph.addNode('task2', { title: 'Task 2', priority: 'Low', labels: ['Task'] });
  });
  
  test('executeRule handles basic rule execution', () => {
    const rule: Rule = {
      name: 'TestRule',
      description: 'A test rule',
      priority: 1,
      disabled: false,
      ruleText: 'CREATE (n:NewNode {name: "TestNode"})',
      markdown: '```graphrule\nname: TestRule\ndescription: A test rule\npriority: 1\nCREATE (n:NewNode {name: "TestNode"})\n```'
    };
    
    const result = engine.executeRule(graph, rule);
    
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(1); // One empty binding context for CREATE-only rules
    expect(result.actionResults.length).toBe(1);
    
    // The rule should have created a new node
    const nodes = graph.getAllNodes();
    expect(nodes.length).toBe(5); // 4 original + 1 new
    
    // Find the created node
    const newNode = nodes.find(node => node.data.labels?.includes('NewNode'));
    expect(newNode).toBeDefined();
    expect(newNode?.data.name).toBe('TestNode');
  });
  
  test('executeRule handles pattern matching with conditions', () => {
    const rule: Rule = {
      name: 'TestRule',
      description: 'A test rule with pattern matching',
      priority: 1,
      disabled: false,
      ruleText: 'MATCH (p:Person) WHERE p.name = "Alice" SET p.status = "Active"',
      markdown: '```graphrule\nname: TestRule\ndescription: A test rule with pattern matching\npriority: 1\nMATCH (p:Person) WHERE p.name = "Alice" SET p.status = "Active"\n```'
    };
    
    const result = engine.executeRule(graph, rule);
    
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(1);
    expect(result.actionResults.length).toBe(1);
    
    // The rule should have updated Alice's status
    const alice = graph.getNode('person1');
    expect(alice?.data.status).toBe('Active');
  });
  
  test('executeRules handles multiple rules in execution order (highest priority first)', () => {
    const rules: Rule[] = [
      {
        name: 'SecondRule',
        description: 'Rule that executes second (lower priority)',
        priority: 1,
        disabled: false,
        ruleText: 'MATCH (p:Person) SET p.lastUpdatedBy = "SecondRule"',
        markdown: '```graphrule\nname: SecondRule\ndescription: Rule that executes second (lower priority)\npriority: 1\nMATCH (p:Person) SET p.lastUpdatedBy = "SecondRule"\n```'
      },
      {
        name: 'FirstRule',
        description: 'Rule that executes first (higher priority)',
        priority: 10,
        disabled: false,
        ruleText: 'MATCH (p:Person) SET p.lastUpdatedBy = "FirstRule"',
        markdown: '```graphrule\nname: FirstRule\ndescription: Rule that executes first (higher priority)\npriority: 10\nMATCH (p:Person) SET p.lastUpdatedBy = "FirstRule"\n```'
      }
    ];
    
    const results = engine.executeRules(graph, rules);
    
    expect(results.length).toBe(2);
    
    // Both person nodes should have lastUpdatedBy="SecondRule" because:
    // 1. Rules execute in priority order (highest first)
    // 2. Later executions can overwrite earlier changes
    // 3. SecondRule executed last and overwrote FirstRule's changes
    const person1 = graph.getNode('person1');
    const person2 = graph.getNode('person2');
    expect(person1?.data.lastUpdatedBy).toBe('SecondRule');
    expect(person2?.data.lastUpdatedBy).toBe('SecondRule');
  });
  
  test('executeRulesFromMarkdown extracts and executes rules from markdown', () => {
    const markdown = `
## Test Rules

\`\`\`graphrule
name: TestRule
description: A test rule
priority: 1

CREATE (n:NewNode {name: "FromMarkdown"})
\`\`\`
    `;
    
    const results = engine.executeRulesFromMarkdown(graph, markdown);
    
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    
    // The rule should have created a new node
    const newNode = graph.findNodes(node => node.data.name === 'FromMarkdown')[0];
    expect(newNode).toBeDefined();
    expect(newNode?.data.labels).toContain('NewNode');
  });
  
  test('executeRule skips disabled rules', () => {
    const rule: Rule = {
      name: 'DisabledRule',
      description: 'A disabled rule',
      priority: 1,
      disabled: true, // Disabled rule
      ruleText: 'CREATE (n:NewNode {name: "ShouldNotExist"})',
      markdown: '```graphrule\nname: DisabledRule\ndescription: A disabled rule\npriority: 1\ndisabled: true\nCREATE (n:NewNode {name: "ShouldNotExist"})\n```'
    };
    
    // Use executeRules which checks the disabled flag
    const results = engine.executeRules(graph, [rule]);
    
    // No results for disabled rules
    expect(results.length).toBe(0);
    
    // No new nodes should have been created
    const nodes = graph.getAllNodes();
    expect(nodes.length).toBe(4); // Still just the 4 original nodes
  });
  
  test('executeRule handles errors in rule execution', () => {
    const invalidRule: Rule = {
      name: 'InvalidRule',
      description: 'An invalid rule',
      priority: 1,
      disabled: false,
      ruleText: 'INVALID SYNTAX',
      markdown: '```graphrule\nname: InvalidRule\ndescription: An invalid rule\npriority: 1\nINVALID SYNTAX\n```'
    };
    
    const result = engine.executeRule(graph, invalidRule);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
  
  // This test specifically targets our fix for comma-separated patterns
  test('executeRule correctly handles comma-separated patterns with cross-product bindings', () => {
    // Define a rule that uses comma-separated patterns: MATCH (p:Person), (t:Task)
    const rule: Rule = {
      name: 'ConnectPeopleToTasks',
      description: 'Connect all people to all tasks',
      priority: 5,
      disabled: false,
      ruleText: 'MATCH (p:Person), (t:Task) CREATE (p)-[r:WORKS_ON {date: "2023-01-15"}]->(t)',
      markdown: '```graphrule\nname: ConnectPeopleToTasks\ndescription: Connect all people to all tasks\npriority: 5\nMATCH (p:Person), (t:Task) CREATE (p)-[r:WORKS_ON {date: "2023-01-15"}]->(t)\n```'
    };
    
    const result = engine.executeRule(graph, rule);
    
    // Verify execution succeeded
    expect(result.success).toBe(true);
    
    // With 2 people and 2 tasks, we should have 4 binding combinations (2×2=4)
    expect(result.matchCount).toBe(4);
    expect(result.actionResults.length).toBe(4);
    
    // We should have created 4 relationships
    const edges = graph.getAllEdges();
    expect(edges.length).toBe(4);
    
    // Each relationship should have the correct type and property
    edges.forEach(edge => {
      expect(edge.label).toBe('WORKS_ON');
      expect(edge.data.date).toBe('2023-01-15');
    });
    
    // Check that each person is connected to each task
    const person1Edges = graph.getEdgesForNode('person1', 'outgoing');
    const person2Edges = graph.getEdgesForNode('person2', 'outgoing');
    
    expect(person1Edges.length).toBe(2);
    expect(person2Edges.length).toBe(2);
    
    // Verify the specific connections using a set of source-target pairs
    const connections = new Set<string>();
    edges.forEach(edge => connections.add(`${edge.source}->${edge.target}`));
    
    expect(connections.has('person1->task1')).toBe(true);
    expect(connections.has('person1->task2')).toBe(true);
    expect(connections.has('person2->task1')).toBe(true);
    expect(connections.has('person2->task2')).toBe(true);
  });
  
  test('executeRule handles the case where one pattern has no matches', () => {
    // Create a rule that references a non-existent label
    const rule: Rule = {
      name: 'NoMatchesRule',
      description: 'Rule that matches nothing',
      priority: 1,
      disabled: false,
      ruleText: 'MATCH (p:Person), (c:Category) CREATE (p)-[r:BELONGS_TO]->(c)',
      markdown: '```graphrule\nname: NoMatchesRule\ndescription: Rule that matches nothing\npriority: 1\nMATCH (p:Person), (c:Category) CREATE (p)-[r:BELONGS_TO]->(c)\n```'
    };
    
    const result = engine.executeRule(graph, rule);
    
    // Rule should execute successfully but with no matches
    expect(result.success).toBe(true);
    expect(result.matchCount).toBe(0);
    expect(result.actionResults.length).toBe(0);
    
    // No new relationships should be created
    expect(graph.getAllEdges().length).toBe(0);
  });
});