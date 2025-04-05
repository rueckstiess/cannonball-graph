import {
  CypherLexer, CypherParser, parseRuleFromMarkdown, transformToCypherAst,
  inspectAst,
  visualizeAst,
  ASTRuleRoot
} from '@/lang';

import { is } from 'unist-util-is';
import { visit } from 'unist-util-visit';

describe('Unist integration tests', () => {
  // Sample graphrule
  const sampleRule = '```graphrule\n' +
    'name: TaskDependencies\n' +
    'description: Creates dependency relationships between nested tasks\n' +
    'priority: 50\n' +
    '\n' +
    'MATCH (parent:listItem {isTask: true})\n' +
    '-[:renders]->(:list)\n' +
    '-[:renders]->(child:listItem {isTask: true})\n' +
    'WHERE NOT EXISTS((parent)-[:dependsOn]->(child))\n' +
    'CREATE (parent)-[:dependsOn {auto: true}]->(child)\n' +
    '```';

  let ast: ASTRuleRoot;

  beforeAll(() => {
    // Parse the rule
    const rule = parseRuleFromMarkdown(sampleRule);

    // Parse the Cypher statement
    const lexer = new CypherLexer();
    const parser = new CypherParser(lexer, rule.ruleText);
    const statement = parser.parse();

    // Transform to AST
    ast = transformToCypherAst(
      statement,
      rule.name,
      rule.description,
      rule.priority,
      rule.disabled
    );
  });

  test('AST is a valid unist node', () => {
    expect(ast).toBeDefined();
    expect(ast.type).toBe('rule');
    expect(Array.isArray(ast.children)).toBe(true);
    expect(ast.children.length).toBeGreaterThan(0);
  });

  test('unist-util-is works with the AST', () => {
    expect(is(ast, { type: 'rule' })).toBe(true);

    const matchNode = ast.children.find(child => child.type === 'match');
    expect(matchNode).toBeDefined();
    expect(is(matchNode, { type: 'match' })).toBe(true);
  });

  test('unist-util-visit works with the AST', () => {
    const nodeTypes: Record<string, number> = {};

    visit(ast, (node) => {
      const type = node.type;
      nodeTypes[type] = (nodeTypes[type] || 0) + 1;
    });

    // We should have counted various node types
    expect(Object.keys(nodeTypes).length).toBeGreaterThan(3);
    expect(nodeTypes['rule']).toBe(1);
    expect(nodeTypes['match']).toBe(1);
    expect(nodeTypes['where']).toBe(1);
    expect(nodeTypes['create']).toBe(1);
  });

  test('unist-util-visit finds specific node types', () => {
    const nodePatterns: any[] = [];

    visit(ast, 'nodePattern', (node) => {
      nodePatterns.push(node);
    });

    // We should have found multiple node patterns
    expect(nodePatterns.length).toBeGreaterThan(1);
    expect(nodePatterns[0].type).toBe('nodePattern');
    expect(nodePatterns[0].labels).toContain('listItem');
  });

  test('visualizeAst produces meaningful output', () => {
    const visualization = visualizeAst(ast);
    expect(visualization).toContain('rule');
    expect(visualization).toContain('match');
    expect(visualization).toContain('nodePattern');
    expect(visualization).toContain('listItem');
    expect(visualization.length).toBeGreaterThan(100);
  });

  test('inspectAst produces unist-compatible output', () => {
    const inspected = inspectAst(ast);
    expect(inspected).toContain('rule');
    // Verify that the output shows child nodes with the tree structure indicators
    expect(inspected).toContain('├─0');
    expect(inspected.length).toBeGreaterThan(100);
  });
});