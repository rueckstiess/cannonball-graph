import {
  Lexer, CypherParser, transformToCypherAst,
  inspectAst,
  visualizeAst,
  ASTRuleRoot
} from '@/lang';

import { is } from 'unist-util-is';
import { visit } from 'unist-util-visit';

describe('Unist integration tests', () => {
  // Sample graphrule
  const sampleQuery = `
    MATCH (parent:listItem {isTask: true})-[:renders]->(:list)-[:renders]->(child:listItem {isTask: true})
    WHERE NOT EXISTS((parent)-[:dependsOn]->(child))
    CREATE (parent)-[:dependsOn {auto: true}]->(child)`;

  let ast: ASTRuleRoot;

  beforeAll(() => {

    // Parse the Cypher statement
    const lexer = new Lexer();
    const parser = new CypherParser(lexer, sampleQuery);
    const statement = parser.parse();

    // Transform to AST
    ast = transformToCypherAst(
      statement,
      "rule name",
      "rule description",
      1,
      false
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