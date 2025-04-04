import { CypherLexer, TokenType } from '../src/rules';

describe('CypherLexer', () => {
  let lexer: CypherLexer;

  beforeEach(() => {
    lexer = new CypherLexer();
  });

  describe('Basic Tokenization', () => {
    it('should tokenize an empty string', () => {
      const tokens = lexer.tokenize('');
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should tokenize keywords', () => {
      const input = 'MATCH WHERE CREATE SET REMOVE DELETE EXISTS NOT AND OR XOR NULL IN CONTAINS STARTS ENDS WITH IS';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(19); // 18 keywords + EOF
      expect(tokens[0].type).toBe(TokenType.MATCH);
      expect(tokens[1].type).toBe(TokenType.WHERE);
      expect(tokens[2].type).toBe(TokenType.CREATE);
      expect(tokens[3].type).toBe(TokenType.SET);
      expect(tokens[4].type).toBe(TokenType.REMOVE);
      expect(tokens[5].type).toBe(TokenType.DELETE);
      expect(tokens[6].type).toBe(TokenType.EXISTS);
      expect(tokens[7].type).toBe(TokenType.NOT);
      expect(tokens[8].type).toBe(TokenType.AND);
      expect(tokens[9].type).toBe(TokenType.OR);
      expect(tokens[10].type).toBe(TokenType.XOR);
      expect(tokens[11].type).toBe(TokenType.NULL);
      expect(tokens[12].type).toBe(TokenType.IN);
      expect(tokens[13].type).toBe(TokenType.CONTAINS);
      expect(tokens[14].type).toBe(TokenType.STARTS);
      expect(tokens[15].type).toBe(TokenType.ENDS);
      expect(tokens[16].type).toBe(TokenType.WITH);
      expect(tokens[17].type).toBe(TokenType.IS);
      expect(tokens[18].type).toBe(TokenType.EOF);
    });

    it('should tokenize keywords case-insensitively by default', () => {
      const input = 'match WHERE create Set';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(5); // 4 keywords + EOF
      expect(tokens[0].type).toBe(TokenType.MATCH);
      expect(tokens[1].type).toBe(TokenType.WHERE);
      expect(tokens[2].type).toBe(TokenType.CREATE);
      expect(tokens[3].type).toBe(TokenType.SET);
    });

    it('should respect case sensitivity when ignoreCase is false', () => {
      const caseSensitiveLexer = new CypherLexer({ ignoreCase: false });
      const input = 'match WHERE';
      const tokens = caseSensitiveLexer.tokenize(input);
      
      expect(tokens.length).toBe(3); // 2 tokens + EOF
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER); // 'match' is not recognized as MATCH
      expect(tokens[1].type).toBe(TokenType.WHERE);      // 'WHERE' is recognized
    });

    it('should tokenize identifiers', () => {
      const input = 'node1 _variable user_name';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(4); // 3 identifiers + EOF
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('node1');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('_variable');
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('user_name');
    });

    it('should tokenize numbers', () => {
      const input = '123 45.67 0 3.14';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(5); // 4 numbers + EOF
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('123');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('45.67');
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].value).toBe('0');
      expect(tokens[3].type).toBe(TokenType.NUMBER);
      expect(tokens[3].value).toBe('3.14');
    });

    it('should tokenize string literals', () => {
      const input = '"Hello" \'World\'';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(3); // 2 strings + EOF
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('Hello');
      expect(tokens[1].type).toBe(TokenType.STRING);
      expect(tokens[1].value).toBe('World');
    });

    it('should handle escaped quotes in strings', () => {
      const input = '"Hello \\"World\\""';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(2); // 1 string + EOF
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('Hello "World"');
    });

    it('should tokenize boolean literals', () => {
      const input = 'true false TRUE FALSE';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(5); // 4 booleans + EOF
      expect(tokens[0].type).toBe(TokenType.BOOLEAN);
      expect(tokens[0].value).toBe('true');
      expect(tokens[1].type).toBe(TokenType.BOOLEAN);
      expect(tokens[1].value).toBe('false');
      expect(tokens[2].type).toBe(TokenType.BOOLEAN);
      expect(tokens[2].value).toBe('true');
      expect(tokens[3].type).toBe(TokenType.BOOLEAN);
      expect(tokens[3].value).toBe('false');
    });
  });

  describe('Punctuation and Operators', () => {
    it('should tokenize basic punctuation', () => {
      const input = '(){},.:;[]';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(11); // 10 punctuation marks + EOF
      expect(tokens[0].type).toBe(TokenType.OPEN_PAREN);
      expect(tokens[1].type).toBe(TokenType.CLOSE_PAREN);
      expect(tokens[2].type).toBe(TokenType.OPEN_BRACE);
      expect(tokens[3].type).toBe(TokenType.CLOSE_BRACE);
      expect(tokens[4].type).toBe(TokenType.COMMA);
      expect(tokens[5].type).toBe(TokenType.DOT);
      expect(tokens[6].type).toBe(TokenType.COLON);
      expect(tokens[7].type).toBe(TokenType.SEMICOLON);
      expect(tokens[8].type).toBe(TokenType.OPEN_BRACKET);
      expect(tokens[9].type).toBe(TokenType.CLOSE_BRACKET);
    });

    it('should tokenize comparison operators', () => {
      const input = '= <> < <= > >= + -';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(9); // 8 operators + EOF
      expect(tokens[0].type).toBe(TokenType.EQUALS);
      expect(tokens[1].type).toBe(TokenType.NOT_EQUALS);
      expect(tokens[2].type).toBe(TokenType.LESS_THAN);
      expect(tokens[3].type).toBe(TokenType.LESS_THAN_OR_EQUALS);
      expect(tokens[4].type).toBe(TokenType.GREATER_THAN);
      expect(tokens[5].type).toBe(TokenType.GREATER_THAN_OR_EQUALS);
      expect(tokens[6].type).toBe(TokenType.PLUS);
      expect(tokens[7].type).toBe(TokenType.MINUS);
    });

    it('should tokenize arrow operators', () => {
      const input = '-> <-';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(3); // 2 arrows + EOF
      expect(tokens[0].type).toBe(TokenType.FORWARD_ARROW);
      expect(tokens[0].value).toBe('->');
      expect(tokens[1].type).toBe(TokenType.BACKWARD_ARROW);
      expect(tokens[1].value).toBe('<-');
    });

    it('should tokenize the asterisk operator', () => {
      const input = '*';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(2); // asterisk + EOF
      expect(tokens[0].type).toBe(TokenType.ASTERISK);
      expect(tokens[0].value).toBe('*');
    });
  });

  describe('Whitespace and Comments', () => {
    it('should ignore whitespace by default', () => {
      const input = '  MATCH  \n WHERE  \t';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(3); // MATCH + WHERE + EOF
      expect(tokens[0].type).toBe(TokenType.MATCH);
      expect(tokens[1].type).toBe(TokenType.WHERE);
    });

    it('should include whitespace when requested', () => {
      const lexerWithWhitespace = new CypherLexer({ includeWhitespace: true });
      const input = '  MATCH  \n WHERE  \t';
      const tokens = lexerWithWhitespace.tokenize(input);
      
      expect(tokens.length).toBe(6); // whitespace + MATCH + whitespace + WHERE + whitespace + EOF
      expect(tokens[0].type).toBe(TokenType.WHITESPACE);
      expect(tokens[1].type).toBe(TokenType.MATCH);
      expect(tokens[2].type).toBe(TokenType.WHITESPACE);
      expect(tokens[3].type).toBe(TokenType.WHERE);
      expect(tokens[4].type).toBe(TokenType.WHITESPACE);
    });

    it('should ignore line comments by default', () => {
      const input = 'MATCH // This is a comment\nWHERE';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(3); // MATCH + WHERE + EOF
      expect(tokens[0].type).toBe(TokenType.MATCH);
      expect(tokens[1].type).toBe(TokenType.WHERE);
    });

    it('should ignore block comments by default', () => {
      const input = 'MATCH /* This is\na block comment */WHERE';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(3); // MATCH + WHERE + EOF
      expect(tokens[0].type).toBe(TokenType.MATCH);
      expect(tokens[1].type).toBe(TokenType.WHERE);
    });

    it('should include comments when requested', () => {
      const lexerWithComments = new CypherLexer({ includeComments: true });
      const input = 'MATCH // This is a comment\nWHERE /* Block */';
      const tokens = lexerWithComments.tokenize(input);
      
      expect(tokens.length).toBe(5); // MATCH + comment + WHERE + comment + EOF
      expect(tokens[0].type).toBe(TokenType.MATCH);
      expect(tokens[1].type).toBe(TokenType.COMMENT);
      expect(tokens[1].value).toBe('// This is a comment');
      expect(tokens[2].type).toBe(TokenType.WHERE);
      expect(tokens[3].type).toBe(TokenType.COMMENT);
      expect(tokens[3].value).toBe('/* Block */');
    });
  });

  describe('Real-world Cypher Patterns', () => {
    it('should tokenize node patterns', () => {
      const input = '(node:Label {property: "value"})';
      const tokens = lexer.tokenize(input);
      
      // Expected tokens:
      // OPEN_PAREN, IDENTIFIER, COLON, IDENTIFIER, OPEN_BRACE, 
      // IDENTIFIER, COLON, STRING, CLOSE_BRACE, CLOSE_PAREN, EOF
      expect(tokens.length).toBe(11);
      expect(tokens[0].type).toBe(TokenType.OPEN_PAREN);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('node');
      expect(tokens[2].type).toBe(TokenType.COLON);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('Label');
      expect(tokens[4].type).toBe(TokenType.OPEN_BRACE);
      expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].value).toBe('property');
      expect(tokens[6].type).toBe(TokenType.COLON);
      expect(tokens[7].type).toBe(TokenType.STRING);
      expect(tokens[7].value).toBe('value');
      expect(tokens[8].type).toBe(TokenType.CLOSE_BRACE);
      expect(tokens[9].type).toBe(TokenType.CLOSE_PAREN);
    });

    it('should tokenize relationship patterns', () => {
      const input = '(a)-[r:TYPE {weight: 5}]->(b)';
      const tokens = lexer.tokenize(input);
      
      // Expected token types (simplified check)
      const expectedTypes = [
        TokenType.OPEN_PAREN, TokenType.IDENTIFIER, TokenType.CLOSE_PAREN,
        TokenType.MINUS, TokenType.OPEN_BRACKET, TokenType.IDENTIFIER,
        TokenType.COLON, TokenType.IDENTIFIER, TokenType.OPEN_BRACE,
        TokenType.IDENTIFIER, TokenType.COLON, TokenType.NUMBER,
        TokenType.CLOSE_BRACE, TokenType.CLOSE_BRACKET, TokenType.FORWARD_ARROW,
        TokenType.OPEN_PAREN, TokenType.IDENTIFIER, TokenType.CLOSE_PAREN,
        TokenType.EOF
      ];
      
      expect(tokens.length).toBe(expectedTypes.length);
      
      for (let i = 0; i < expectedTypes.length; i++) {
        expect(tokens[i].type).toBe(expectedTypes[i]);
      }
    });

    it('should tokenize MATCH clauses', () => {
      const input = 'MATCH (a:Person)-[:KNOWS]->(b:Person)';
      const tokens = lexer.tokenize(input);
      
      expect(tokens[0].type).toBe(TokenType.MATCH);
      expect(tokens[1].type).toBe(TokenType.OPEN_PAREN);
      // ... rest of the tokens
    });

    it('should tokenize WHERE clauses', () => {
      const input = 'WHERE a.age > 30 AND b.name = "John"';
      const tokens = lexer.tokenize(input);
      
      expect(tokens[0].type).toBe(TokenType.WHERE);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER); // 'a'
      expect(tokens[2].type).toBe(TokenType.DOT);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER); // 'age'
      expect(tokens[4].type).toBe(TokenType.GREATER_THAN);
      expect(tokens[5].type).toBe(TokenType.NUMBER); // '30'
      expect(tokens[6].type).toBe(TokenType.AND);
      // ... rest of the tokens
    });
    
    it('should tokenize IS NULL and IS NOT NULL expressions', () => {
      const input = 'WHERE a.prop IS NULL AND b.prop IS NOT NULL';
      const tokens = lexer.tokenize(input);
      
      // Check for IS NULL part
      expect(tokens[0].type).toBe(TokenType.WHERE);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER); // 'a'
      expect(tokens[2].type).toBe(TokenType.DOT);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER); // 'prop'
      expect(tokens[4].type).toBe(TokenType.IS);
      expect(tokens[5].type).toBe(TokenType.NULL);
      
      // Check for AND part
      expect(tokens[6].type).toBe(TokenType.AND);
      
      // Check for IS NOT NULL part
      expect(tokens[7].type).toBe(TokenType.IDENTIFIER); // 'b'
      expect(tokens[8].type).toBe(TokenType.DOT);
      expect(tokens[9].type).toBe(TokenType.IDENTIFIER); // 'prop'
      expect(tokens[10].type).toBe(TokenType.IS);
      expect(tokens[11].type).toBe(TokenType.NOT);
      expect(tokens[12].type).toBe(TokenType.NULL);
    });

    it('should tokenize CREATE clauses', () => {
      const input = 'CREATE (a)-[:KNOWS {since: 2020}]->(b)';
      const tokens = lexer.tokenize(input);
      
      expect(tokens[0].type).toBe(TokenType.CREATE);
      // ... rest of the tokens
    });

    it('should tokenize a complete Cypher-like rule', () => {
      const input = `MATCH (parent:listItem {isTask: true})
-[:renders]->(:list)
-[:renders]->(child:listItem {isTask: true})
WHERE NOT EXISTS((parent)-[:dependsOn]->(child))
CREATE (parent)-[:dependsOn {auto: true}]->(child)`;
      
      const tokens = lexer.tokenize(input);
      expect(tokens.length).toBeGreaterThan(20); // Just verify we get a substantial number of tokens
      expect(tokens[0].type).toBe(TokenType.MATCH);
      
      // Find the WHERE token
      const whereIndex = tokens.findIndex(t => t.type === TokenType.WHERE);
      expect(whereIndex).toBeGreaterThan(0);
      
      // Find the CREATE token
      const createIndex = tokens.findIndex(t => t.type === TokenType.CREATE);
      expect(createIndex).toBeGreaterThan(whereIndex);
    });
  });

  describe('Lexer Navigation', () => {
    it('should allow iterating through tokens', () => {
      const input = 'MATCH (a) WHERE a.name = "Test"';
      lexer.tokenize(input);
      
      expect(lexer.isAtEnd()).toBe(false);
      
      // First token is MATCH
      expect(lexer.peek().type).toBe(TokenType.MATCH);
      expect(lexer.next().type).toBe(TokenType.MATCH);
      
      // Next token is OPEN_PAREN
      expect(lexer.peek().type).toBe(TokenType.OPEN_PAREN);
      expect(lexer.next().type).toBe(TokenType.OPEN_PAREN);
      
      // Skip ahead
      lexer.next(); // IDENTIFIER 'a'
      lexer.next(); // CLOSE_PAREN
      
      // Now we should be at WHERE
      expect(lexer.peek().type).toBe(TokenType.WHERE);
      expect(lexer.next().type).toBe(TokenType.WHERE);
      
      // Continue until the end
      while (!lexer.isAtEnd()) {
        lexer.next();
      }
      
      // Should be at EOF
      expect(lexer.isAtEnd()).toBe(true);
      expect(lexer.peek().type).toBe(TokenType.EOF);
    });

    it('should reset the lexer correctly', () => {
      const input = 'MATCH (a) WHERE a.name = "Test"';
      lexer.tokenize(input);
      
      // Move forward a bit
      lexer.next(); // MATCH
      lexer.next(); // OPEN_PAREN
      expect(lexer.peek().type).toBe(TokenType.IDENTIFIER);
      
      // Reset
      lexer.reset();
      
      // Should be back at the start
      expect(lexer.peek().type).toBe(TokenType.MATCH);
    });
  });
  
  describe('Error Handling', () => {
    it('should mark unrecognized characters as UNKNOWN', () => {
      const input = 'MATCH @';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(3); // MATCH + UNKNOWN + EOF
      expect(tokens[0].type).toBe(TokenType.MATCH);
      expect(tokens[1].type).toBe(TokenType.UNKNOWN);
      expect(tokens[1].value).toBe('@');
    });
    
    it('should handle unterminated strings', () => {
      const input = 'MATCH "unterminated';
      const tokens = lexer.tokenize(input);
      
      expect(tokens.length).toBe(3); // MATCH + STRING + EOF
      expect(tokens[0].type).toBe(TokenType.MATCH);
      expect(tokens[1].type).toBe(TokenType.STRING);
      expect(tokens[1].value).toBe('unterminated');
    });
  });
});