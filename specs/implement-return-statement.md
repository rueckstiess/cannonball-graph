Implementation Plan for RETURN Statement

  1. Lexer Update (DONE)
    - Add RETURN to the TokenType enum
    - Add RETURN to the recognized keywords map
  2. Parser Update
    - Create a new ReturnClause interface:
    export interface ReturnClause {
    /** Variables to return from the query */
    variables: string[];
  }
    - Add return property to CypherStatement interface
    - Add a parseReturnClause method to handle RETURN statements
    - Update the main parse method to recognize RETURN clauses
  3. Rule Engine Update
    - Create a QueryResult interface:
    export interface QueryResult<NodeData = any, EdgeData = any> {
    rule: Rule;
    success: boolean;
    matchCount: number;
    data: Record<string, Array<Node<NodeData> | Edge<EdgeData>>>;
    error?: string;
  }
    - Modify executeRule to handle rules that have RETURN instead of CREATE/SET
    - Add executeQuery helper method that returns matched data instead of execution results
  4. API Update
    - Add new methods to expose query functionality:
    executeQuery(graph: Graph, rule: Rule): QueryResult
  executeQueryFromMarkdown(graph: Graph, markdown: string): QueryResult
  5. Testing & Documentation
    - Add tests for the new RETURN clause
    - Update documentation to show query examples

  The implementation would let you write queries like:

  MATCH (t:Task)
  WHERE t.priority = "High"
  RETURN t

  And extend to more complex queries:

  MATCH (p:Person)-[r:ASSIGNED_TO]->(t:Task)
  WHERE t.status = "In Progress"
  RETURN p, r, t

  This approach maintains compatibility with existing rule structures and provides a clean syntax for queries that aligns with the Cypher query language.
