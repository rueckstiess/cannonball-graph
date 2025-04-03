# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Test/Lint Commands
- Build: `npm run build`
- Test all: `npm test`
- Test specific: `npm test -- --testNamePattern="test pattern"`
- Test with watch: `npm run test:watch`
- Lint: `npm run lint`
- Format: `npm run format`

## Code Style Guidelines
- **TypeScript**: Strict type checking enabled
- **Modules**: Use ESM (ES Modules) - `import/export` syntax
- **Paths**: Use `@/` to import from src directory
- **Naming**: Use camelCase for variables/methods, PascalCase for classes/types
- **Classes**: Abstract base classes with implementation inheritance
- **Documentation**: JSDoc comments for public APIs
- **Error handling**: Use explicit error types and throw with descriptive messages
- **Testing**: Jest with explicit describe/it structure and clear expectations
- **File headers**: Include file path as first line comment