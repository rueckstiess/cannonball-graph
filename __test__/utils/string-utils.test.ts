import { capitalize, slugify } from '../../src/utils/string-utils';

describe('String utilities', () => {
  describe('capitalize', () => {
    it('should capitalize the first letter of a string', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should return empty string for empty input', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle strings that are already capitalized', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });
  });

  describe('slugify', () => {
    it('should convert spaces to hyphens', () => {
      expect(slugify('hello world')).toBe('hello-world');
    });

    it('should convert to lowercase', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
    });

    it('should handle strings with multiple spaces', () => {
      expect(slugify('hello  world')).toBe('hello-world');
    });
  });
});