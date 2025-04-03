// __test__/core/nodes/code-block-node.test.ts
import { CodeBlockNode, NoteNode } from '@/core/nodes';
import { NodeType } from '@/core/types';
import { createParserContext } from '@/parser/parser-context';
import { CannonballGraph } from '@/core/graph';
import { Code } from 'mdast';

describe('CodeBlockNode', () => {
  let graph: CannonballGraph;
  let codeBlock: CodeBlockNode;
  let rootNote: NoteNode;

  beforeEach(() => {
    graph = new CannonballGraph();
    rootNote = new NoteNode('test.md', 'Test Note', { filePath: 'test.md' });
    codeBlock = new CodeBlockNode(
      'test.md#code1',
      'console.log("Hello");',
      'javascript',
      { filePath: 'test.md' }
    );

    graph.addNode(rootNote);
    graph.addNode(codeBlock);
  });

  describe('Constructor and properties', () => {
    it('should create a code block node with correct type and properties', () => {
      expect(codeBlock.type).toBe(NodeType.CodeBlock);
      expect(codeBlock.content).toBe('console.log("Hello");');
      expect(codeBlock.language).toBe('javascript');
      expect(codeBlock.id).toBe('test.md#code1');
      expect(codeBlock.metadata.filePath).toBe('test.md');
    });

    it('should handle null language', () => {
      const noLangCodeBlock = new CodeBlockNode(
        'test.md#code2',
        'plain text code',
        null
      );

      expect(noLangCodeBlock.language).toBeNull();
    });
  });

  describe('Containment rules', () => {
    it('should not allow containing other nodes', () => {
      const otherCodeBlock = new CodeBlockNode('test.md#code2', 'more code', 'python');
      expect(codeBlock.canContain(otherCodeBlock)).toBe(false);
    });
  });

  describe('AST conversion', () => {
    it('should convert from AST code node', () => {
      const codeAst: Code = {
        type: 'code',
        value: 'function test() {\n  return true;\n}',
        lang: 'javascript'
      };

      const context = createParserContext('test.md', graph, rootNote);

      const result = CodeBlockNode.fromAst(codeAst, context, []);

      expect(result).not.toBeNull();
      expect(result?.type).toBe(NodeType.CodeBlock);
      expect(result?.content).toBe('function test() {\n  return true;\n}');
      expect(result?.language).toBe('javascript');
    });

    it('should handle code blocks without language', () => {
      const codeAst: Code = {
        type: 'code',
        value: 'plain text code'
      };

      const context = createParserContext('test.md', graph, rootNote);

      const result = CodeBlockNode.fromAst(codeAst, context, []);

      expect(result).not.toBeNull();
      expect(result?.language).toBeNull();
    });

    it('should return null for non-code nodes', () => {
      const nonCodeAst = {
        type: 'paragraph',
        children: []
      };

      const context = createParserContext('test.md', graph, rootNote);

      // @ts-ignore - intentionally testing with wrong type
      const result = CodeBlockNode.fromAst(nonCodeAst, context, []);

      expect(result).toBeNull();
    });

    it('should convert to AST code node', () => {
      const ast = codeBlock.toAst() as Code;

      expect(ast.type).toBe('code');
      expect(ast.value).toBe('console.log("Hello");');
      expect(ast.lang).toBe('javascript');
    });

    it('should convert to AST code node with null language', () => {
      const noLangCodeBlock = new CodeBlockNode(
        'test.md#code2',
        'plain text code',
        null
      );

      const ast = noLangCodeBlock.toAst() as Code;

      expect(ast.type).toBe('code');
      expect(ast.value).toBe('plain text code');
      expect(ast.lang).toBeUndefined();
    });
  });

  describe('canParseAst', () => {
    it('should return true for code nodes', () => {
      const codeAst: Code = {
        type: 'code',
        value: 'code'
      };

      expect(CodeBlockNode.canParseAst(codeAst)).toBe(true);
    });

    it('should return false for non-code nodes', () => {
      const nonCodeAst = {
        type: 'paragraph',
        children: []
      };

      // @ts-ignore - intentionally testing with wrong type
      expect(CodeBlockNode.canParseAst(nonCodeAst)).toBe(false);
    });
  });
});