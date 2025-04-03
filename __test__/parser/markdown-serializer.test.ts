// __test__/parser/markdown-serializer.test.ts
import { MarkdownParser } from '@/parser/markdown-parser';
import { MarkdownSerializer, SerializationOptions } from '@/parser/markdown-serializer';
import { normalizeMarkdown } from '@/utils/string-utils';
import { NodeRegistry } from '@/core/node-registry';
import { initializeNodeRegistry } from '@/core/registry-init';

describe('MarkdownSerializer', () => {
  let parser: MarkdownParser;
  let serializer: MarkdownSerializer;

  beforeEach(() => {
    // Reset the registry and re-initialize before each test
    NodeRegistry.clear();
    initializeNodeRegistry();

    parser = new MarkdownParser();
    serializer = new MarkdownSerializer();
  });

  describe('Basic serialization', () => {
    it('should serialize a simple document with headings', () => {
      const markdown = `# Heading 1
Some text

## Heading 2
More text
`;
      const graph = parser.parse(markdown, 'test.md');
      const result = serializer.serialize(graph);

      // Should produce a single file
      expect(result.files.size).toBe(1);
      expect(result.files.has('test.md')).toBe(true);

      const output = result.files.get('test.md')!;

      // Output should contain both headings
      expect(output).toContain('# Heading 1');
      expect(output).toContain('## Heading 2');

      // Output should contain both paragraphs
      expect(output).toContain('Some text');
      expect(output).toContain('More text');
    });

    it('should serialize tasks with correct markers', () => {
      const markdown = `# Tasks
- [ ] Open task
- [x] Completed task
- [/] In progress task
- [!] Blocked task
- [-] Cancelled task
`;
      const graph = parser.parse(markdown, 'tasks.md');
      const result = serializer.serialize(graph);

      const output = result.files.get('tasks.md')!;

      // Check all task markers are preserved
      expect(output).toContain('- [ ] Open task');
      expect(output).toContain('- [x] Completed task');
      expect(output).toContain('- [/] In progress task');
      expect(output).toContain('- [!] Blocked task');
      expect(output).toContain('- [-] Cancelled task');
    });

    it('should serialize nested list structures', () => {
      const markdown = `# List
- Item 1
  - Subitem 1.1
  - Subitem 1.2
    - Subsubitem 1.2.1
- Item 2
`;
      const graph = parser.parse(markdown, 'list.md');
      const result = serializer.serialize(graph);

      const output = result.files.get('list.md')!;

      // Check indentation and nesting
      expect(output).toContain('- Item 1');
      expect(output).toContain('  - Subitem 1.1');
      expect(output).toContain('  - Subitem 1.2');
      expect(output).toContain('    - Subsubitem 1.2.1');
      expect(output).toContain('- Item 2');
    });

    it('should serialize code blocks', () => {
      const markdown = `# Code
\`\`\`javascript
function test() {
  return true;
}
\`\`\`
`;
      const graph = parser.parse(markdown, 'code.md');
      const result = serializer.serialize(graph);

      const output = result.files.get('code.md')!;

      // Check code block formatting
      expect(output).toContain('```javascript');
      expect(output).toContain('function test() {');
      expect(output).toContain('```');
    });
  });

  describe('Advanced serialization', () => {
    it('should split output into multiple files when configured', () => {
      const markdown = `# Project
## Tasks
- [ ] Task 1
- [ ] Task 2

## Notes
Some notes here.
`;
      const graph = parser.parse(markdown, 'project.md');

      // Configure to split by heading
      const options: SerializationOptions = {
        splitIntoFiles: true,
        getFilePath: (node) => {
          if (node.content === 'Tasks') {
            return 'tasks.md';
          } else if (node.content === 'Notes') {
            return 'notes.md';
          }
          return 'project.md';
        }
      };

      const result = serializer.serialize(graph, options);

      // Should create multiple files
      expect(result.files.size).toBeGreaterThan(1);
      expect(result.files.has('tasks.md')).toBe(true);
      expect(result.files.has('notes.md')).toBe(true);

      // Check content
      expect(result.files.get('tasks.md')!).toContain('Task 1');
      expect(result.files.get('notes.md')!).toContain('Some notes here');
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve structure in parse-serialize round trip', () => {
      const originalMarkdown = `# Heading 1
Some text for heading 1.

## Heading 2
- [ ] Task A
  - [x] Subtask A.1
  - [ ] Subtask A.2
- [/] Task B

### Heading 3
More content here.

\`\`\`python
def test():
    return "Hello"
\`\`\`
`;
      // Parse to graph
      const graph = parser.parse(originalMarkdown, 'document.md');

      // Serialize back to markdown
      const result = serializer.serialize(graph);
      const roundTripMarkdown = result.files.get('document.md')!;

      // Generate normalized versions for comparison (ignore whitespace differences)
      const normalizedRoundTrip = normalizeMarkdown(roundTripMarkdown);

      // Core structures should be preserved
      expect(normalizedRoundTrip).toContain('# Heading 1');
      expect(normalizedRoundTrip).toContain('## Heading 2');
      expect(normalizedRoundTrip).toContain('### Heading 3');
      expect(normalizedRoundTrip).toContain('- [ ] Task A');
      expect(normalizedRoundTrip).toContain('- [x] Subtask A.1');
      expect(normalizedRoundTrip).toContain('```python');
      expect(normalizedRoundTrip).toContain('def test():');
    });
  });
});