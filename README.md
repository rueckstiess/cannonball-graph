# Cannonball-TS

A TypeScript library for transforming Markdown notes into a knowledge graph, with special support for Obsidian PKM.

## Overview

Cannonball is a productivity system that turns regular Markdown documents into a directed labeled graph structure. It's designed to work seamlessly with Obsidian, allowing you to:

- Parse Markdown into a graph data structure
- Query and traverse relationships between nodes
- Make changes to the graph
- Serialize the graph back to Markdown

## Core Concepts

- **Node Types**: notes, sections, tasks, bullets, paragraphs, code blocks, etc.
- **Relation Types**: contains, depends_on, links_to, etc.
- **Graph Operations**: Add, update, delete nodes and edges, query the graph

## Features

- **Markdown Parsing**: Convert Markdown documents to a graph structure via markdown AST
- **Task Hierarchies**: Automatically create dependency relationships between tasks and subtasks
- **Section Containers**: Group content by headings and maintain hierarchical relationships
- **Serialization**: Convert the graph back to Markdown with options for restructuring via markdown AST


### Obsidian Integration

When used as an Obsidian plugin, Cannonball can:

- Parse all vault notes into a unified graph
- Maintain cross-file relationships
- Update files when the graph changes
- Visualize relationships in the graph view

## API Reference

### Core Types

- `CannonballGraph`: The main graph class for storing and manipulating nodes and edges
- `MarkdownParser`: Converts Markdown text into a Cannonball graph
- `MarkdownSerializer`: Converts a Cannonball graph back to Markdown

### Graph Operations

- `addNode(node)`: Add a new node to the graph
- `updateNode(node)`: Update an existing node
- `removeNode(id)`: Remove a node and its associated edges
- `addEdge(edge)`: Add a new edge between nodes
- `removeEdge(source, target, relation)`: Remove an edge

### Querying

- `getNode(id)`: Get a node by ID
- `getRelatedNodes(id, relation)`: Get nodes related to a given node
- `findNodesByType(type)`: Find all nodes of a specific type
- `searchNodes(query)`: Search nodes by content

## Development

### Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Roadmap

- [x] Core graph data structure
- [ ] Markdown parsing and serialization
- [ ] Obsidian plugin integration
- [ ] AI assistance features
- [ ] Advanced query language

## License

MIT