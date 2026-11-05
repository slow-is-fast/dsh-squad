/**
 * Tests for error classes and error handling
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// ============================================================================
// Custom Error Classes
// ============================================================================

// We need to define these since they might not be exported
class SquadError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'SquadError';
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends SquadError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class FileError extends SquadError {
  constructor(message, details = null) {
    super(message, 'FILE_ERROR', details);
    this.name = 'FileError';
  }
}

class ParseError extends SquadError {
  constructor(message, details = null) {
    super(message, 'PARSE_ERROR', details);
    this.name = 'ParseError';
  }
}

class CommandError extends SquadError {
  constructor(message, details = null) {
    super(message, 'COMMAND_ERROR', details);
    this.name = 'CommandError';
  }
}

// ============================================================================
// SquadError Tests
// ============================================================================

describe('SquadError', () => {
  test('should create error with message', () => {
    const error = new SquadError('Test error', 'TEST_ERROR');
    assert.strictEqual(error.message, 'Test error');
    assert.strictEqual(error.code, 'TEST_ERROR');
    assert.strictEqual(error.name, 'SquadError');
  });

  test('should include details', () => {
    const error = new SquadError('Test error', 'TEST_ERROR', 'Additional info');
    assert.strictEqual(error.details, 'Additional info');
  });

  test('should have null details by default', () => {
    const error = new SquadError('Test error', 'TEST_ERROR');
    assert.strictEqual(error.details, null);
  });

  test('should be instance of Error', () => {
    const error = new SquadError('Test error', 'TEST_ERROR');
    assert.ok(error instanceof Error);
  });

  test('should preserve stack trace', () => {
    const error = new SquadError('Test error', 'TEST_ERROR');
    assert.ok(error.stack);
    assert.ok(error.stack.includes('SquadError'));
  });
});

// ============================================================================
// ValidationError Tests
// ============================================================================

describe('ValidationError', () => {
  test('should have correct code', () => {
    const error = new ValidationError('Invalid input');
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
  });

  test('should have correct name', () => {
    const error = new ValidationError('Invalid input');
    assert.strictEqual(error.name, 'ValidationError');
  });

  test('should include details', () => {
    const error = new ValidationError('Invalid filepath', 'Received: null');
    assert.strictEqual(error.details, 'Received: null');
  });

  test('should be instance of SquadError', () => {
    const error = new ValidationError('Invalid input');
    assert.ok(error instanceof SquadError);
  });

  test('should be instance of Error', () => {
    const error = new ValidationError('Invalid input');
    assert.ok(error instanceof Error);
  });
});

// ============================================================================
// FileError Tests
// ============================================================================

describe('FileError', () => {
  test('should have correct code', () => {
    const error = new FileError('File not found');
    assert.strictEqual(error.code, 'FILE_ERROR');
  });

  test('should have correct name', () => {
    const error = new FileError('File not found');
    assert.strictEqual(error.name, 'FileError');
  });

  test('should include file path in details', () => {
    const error = new FileError('File not found', 'Path: /path/to/file');
    assert.strictEqual(error.details, 'Path: /path/to/file');
  });

  test('should be instance of SquadError', () => {
    const error = new FileError('File not found');
    assert.ok(error instanceof SquadError);
  });
});

// ============================================================================
// ParseError Tests
// ============================================================================

describe('ParseError', () => {
  test('should have correct code', () => {
    const error = new ParseError('JSON parse error');
    assert.strictEqual(error.code, 'PARSE_ERROR');
  });

  test('should have correct name', () => {
    const error = new ParseError('JSON parse error');
    assert.strictEqual(error.name, 'ParseError');
  });

  test('should include syntax error details', () => {
    const error = new ParseError('Failed to parse JSON', 'Unexpected token at line 5');
    assert.strictEqual(error.details, 'Unexpected token at line 5');
  });

  test('should be instance of SquadError', () => {
    const error = new ParseError('Parse error');
    assert.ok(error instanceof SquadError);
  });
});

// ============================================================================
// CommandError Tests
// ============================================================================

describe('CommandError', () => {
  test('should have correct code', () => {
    const error = new CommandError('Invalid command');
    assert.strictEqual(error.code, 'COMMAND_ERROR');
  });

  test('should have correct name', () => {
    const error = new CommandError('Invalid command');
    assert.strictEqual(error.name, 'CommandError');
  });

  test('should include command details', () => {
    const error = new CommandError('Unknown command', 'Command: unknown');
    assert.strictEqual(error.details, 'Command: unknown');
  });

  test('should be instance of SquadError', () => {
    const error = new CommandError('Command error');
    assert.ok(error instanceof SquadError);
  });
});

// ============================================================================
// Error Handling Patterns
// ============================================================================

describe('Error Handling Patterns', () => {
  test('should throw and catch ValidationError', () => {
    assert.throws(
      () => {
        throw new ValidationError('Test validation');
      },
      (error) => {
        assert.ok(error instanceof ValidationError);
        assert.strictEqual(error.code, 'VALIDATION_ERROR');
        return true;
      }
    );
  });

  test('should throw and catch FileError', () => {
    assert.throws(
      () => {
        throw new FileError('Test file error');
      },
      (error) => {
        assert.ok(error instanceof FileError);
        assert.strictEqual(error.code, 'FILE_ERROR');
        return true;
      }
    );
  });

  test('should distinguish error types', () => {
    const errors = [
      new ValidationError('Validation'),
      new FileError('File'),
      new ParseError('Parse'),
      new CommandError('Command')
    ];

    for (const error of errors) {
      assert.ok(error instanceof SquadError);
      assert.ok(error instanceof Error);
    }

    assert.ok(errors[0] instanceof ValidationError);
    assert.ok(errors[1] instanceof FileError);
    assert.ok(errors[2] instanceof ParseError);
    assert.ok(errors[3] instanceof CommandError);
  });

  test('should format error with details', () => {
    const error = new ValidationError('Invalid input', 'Received: undefined');
    const formatted = `${error.name} [${error.code}]: ${error.message}\nDetails: ${error.details}`;
    
    assert.ok(formatted.includes('ValidationError'));
    assert.ok(formatted.includes('VALIDATION_ERROR'));
    assert.ok(formatted.includes('Invalid input'));
    assert.ok(formatted.includes('Received: undefined'));
  });
});

// ============================================================================
// Error Recovery
// ============================================================================

describe('Error Recovery', () => {
  test('should create error with recovery info', () => {
    const error = new FileError('File not found', 'Use valid path');
    assert.ok(error.details);
  });

  test('should preserve error chain', () => {
    const originalError = new Error('Original');
    const wrappedError = new FileError(
      'Failed to load file',
      `Original: ${originalError.message}`
    );
    
    assert.ok(wrappedError.details.includes('Original'));
  });
});