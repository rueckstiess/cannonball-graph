# Cannonball - An AI-powered productivity system integrated into Obsidian

## High-level concepts

- **Tree to Graph**: I want to be able to write Markdown quickly in Obsidian. The Markdown represents a directed labeled graph which we induce from the Markdown AST. 
- **Markdown**: Any state of the graph can be represented as an Obsidian Note (even more specifically, a bullet point list) in Markdown format, with some custom additions to define different node types and cross-referencing nodes.
- **AI assistance**: We integrate LLMs into the system, which can navigate the graph, search, filter, answer questions, and even make changes to the graph (via Markdown edits) These changes can be reviewed by a human before being applied (diff view). 
- **Obsidian Integration**: The system is written as a plugin in Obsidian and updates the markdown in the editor. We can view the graph with Obsidian's graph view. It also plays nice with popular plugins, like dataview, kanban, mininal. 
- The implementation is in TypeScript, with clean structured interfaces for graph nodes and edges. It uses remark/mdast utilities to parse and stringify the markdown. 

## Project Structure

- **Graph Module** (`src/graph/`): Core graph data structure implementation with comprehensive interface
  - `types.ts`: Defines Node, Edge, and Graph interfaces
  - `graph.ts`: Implements GraphImpl with all graph operations
  - Current branch: `rule-parser` - Working on rule system implementation

- **Rules Module** (`src/rules/`): Implementation of the graph transformation rule system
  - `types.ts`: Defines Rule interface and extraction options
  - `rule-parser.ts`: Implements rule extraction from Markdown blocks
  - Currently implements Step 1.1 (Rule Block Extraction) from the implementation plan

- **Specifications** (`specs/`):
  - `graph.md`: Graph component specification
  - `rules.md`: Rule system specification with Cypher-like query language

## Development Process Guidelines

When helping with the Cannonball project, please follow this structured development process:

1. **Specification First**: Begin by writing or discussing specifications for each component before coding. Include clear requirements, interfaces, and expected behaviors.

2. **Test-Driven Development**: After agreeing on a specification, write tests first. These tests should verify all the required functionality and edge cases.

3. **Incremental Implementation**: Implement one component at a time, focusing on making tests pass. Don't move to the next component until the current one is verified.

4. **Generic Implementation**: Always implement solutions generically, not with special cases to pass tests. Avoid pattern matching on specific test cases or hardcoding logic for particular test scenarios. Code should handle all valid inputs according to the specification, not just the test cases.

5. **Documentation-Rich**: Add comprehensive JSDoc comments to interfaces and key methods.

6. **Code Communication Preferences**:
   - Documentation and specifications: Write to Obsidian through basic-memory tool
   - Code implementation: Create as artifacts in the Claude web UI
   - Avoid lengthy code dumps across multiple files in one response

7. **Verification Steps**: Allow time for verification and feedback after each component before proceeding.

## Code Quality Commands

```bash
# Build the project
npm run build

# Run tests
npm run test

# Linting
npm run lint

# Formatting
npm run format
```

This step-by-step approach helps keep the development process manageable, verifiable, and aligned with my requirements.