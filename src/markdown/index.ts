import { remark } from 'remark';
import { inspect } from 'unist-util-inspect';
import { visit } from 'unist-util-visit';
import { RootContent, Parent } from 'mdast';
import { Graph } from '@/graph';

// Sample Markdown with custom task syntax
const markdown = `
# Custom Tasks Example

- Regular list item
- [q] What's the meaning of life?
- [x] Completed task
- [ ] Open task
- [D] Decision to make
  - Option 1
  - Option 2
`

async function runTest() {
  try {
    // Process with remark and our plugin
    const processor = remark();

    // Process the markdown
    const file = await processor.process(markdown)

    // Get the processed AST
    const ast = processor.parse(markdown)
    const root = processor.runSync(ast, file)

    console.log(inspect(root));

    const graph = new Graph();

    // enter each AST node into the graph
    let counter = 0;
    visit(root, 'text', function (node: RootContent, index: number, parent?: Parent) {
      console.log([node, parent ? parent.type : index])
      graph.addNode(`node-${counter++}`, node.type, node)
    })

    console.log('Graph\n', JSON.stringify(graph.toJSON(), null, 2))


  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Run the test
runTest()