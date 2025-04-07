# cannonball-graph

## Project Structure


## Development Process Guidelines

When helping with the `cannonball-graph` project, please follow this structured development process:

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