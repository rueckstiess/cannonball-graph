import { Graph } from '@/graph';
import { PatternMatcherWithConditions } from '@/lang/pattern-matcher-with-conditions';
import { Rule } from '@/lang/rule-parser';
import { RuleEngine, createRuleEngine } from '@/rules/rule-engine';

describe('Rule Engine Binding Tests', () => {
  let engine: RuleEngine;
  let graph: Graph;

  beforeEach(() => {
    engine = createRuleEngine();
    graph = new Graph();

    // Add test nodes
    graph.addNode('person1', 'Person', { name: 'Alice', }); graph.addNode('person2', 'Person', { name: 'Bob', }); graph.addNode('task1', 'Task', { title: 'Task 1', priority: 'High', }); graph.addNode('task2', 'Task', { title: 'Task 2', priority: 'Low', });
  });

  test('RuleEngine combines bindings from comma-separated patterns', () => {
    // Define a query with comma-separated patterns
    const query = 'MATCH (p:Person), (t:Task) CREATE (p)-[r:WORKS_ON {date: "2023-01-15"}]->(t)';

    const result = engine.executeQuery(graph, query);

    // Verify execution succeeded
    expect(result.success).toBe(true);

    // With 2 people and 2 tasks, we should have 4 binding combinations (2×2=4)
    expect(result.matchCount).toBe(4);
    expect(result.actions).toBeDefined();
    expect(result.actions!.actionResults.length).toBe(4);

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
    const connections = new Set();
    edges.forEach(edge => connections.add(`${edge.source}->${edge.target}`));

    expect(connections.has('person1->task1')).toBe(true);
    expect(connections.has('person1->task2')).toBe(true);
    expect(connections.has('person2->task1')).toBe(true);
    expect(connections.has('person2->task2')).toBe(true);
  });

  test('RuleEngine handles the case where one pattern has no matches', () => {
    // Create a rule that references a non-existent label
    const rule: Rule = {
      name: 'NoMatchesRule',
      description: 'Rule that matches nothing',
      priority: 1,
      disabled: false,
      ruleText: 'MATCH (p:Person), (c:Category) CREATE (p)-[r:BELONGS_TO]->(c)',
      markdown: '```graphrule\nname: NoMatchesRule\ndescription: Rule that matches nothing\npriority: 1\nMATCH (p:Person), (c:Category) CREATE (p)-[r:BELONGS_TO]->(c)\n```'
    };

    const result = engine.executeQuery(graph, rule.ruleText);

    // We're specifically testing that even when Category nodes don't exist,
    // the rule engine correctly handles this case with an empty result set
    expect(result.matchCount).toBe(0); // No combined matches when one pattern has no matches

    // No actions should be executed because there were no matches
    expect(result.actions?.actionResults.length).toBe(0); // No actions attempted
    expect(result.success).toBe(true); // Operation completes successfully even with no matches

    // No new relationships should be created
    expect(graph.getAllEdges().length).toBe(0);
  });

  test('RuleEngine handles single pattern rules correctly', () => {
    // Define a rule with only one pattern
    const rule: Rule = {
      name: 'UpdatePersonRule',
      description: 'Update all person nodes',
      priority: 1,
      disabled: false,
      ruleText: 'MATCH (p:Person) SET p.status = "Active"',
      markdown: '```graphrule\nname: UpdatePersonRule\ndescription: Update all person nodes\npriority: 1\nMATCH (p:Person) SET p.status = "Active"\n```'
    };

    const result = engine.executeQuery(graph, rule.ruleText);

    // Verify execution succeeded
    expect(result.success).toBe(true);

    // Should have 2 matches (2 Person nodes)
    expect(result.matchCount).toBe(2);
    expect(result.actions?.actionResults.length).toBe(2);

    // Each Person node should have been updated
    const person1 = graph.getNode('person1');
    const person2 = graph.getNode('person2');

    expect(person1?.data.status).toBe('Active');
    expect(person2?.data.status).toBe('Active');
  });
});