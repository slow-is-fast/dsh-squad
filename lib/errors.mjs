/**
 * Typed error hierarchy for dsh-squad.
 *
 * Everything the CLI fails on deliberately goes through one of these, so
 * formatError() can render a stable `Error [CODE]: message` line and callers
 * can tell a bad input apart from a broken environment.
 */

export class SquadError extends Error {
  /**
   * @param {string} message
   * @param {string} code - Stable machine-readable code, e.g. FILE_ERROR
   * @param {string|null} details - Extra context for the user
   */
  constructor(message, code, details = null) {
    super(message);
    this.name = 'SquadError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends SquadError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class FileError extends SquadError {
  constructor(message, details = null) {
    super(message, 'FILE_ERROR', details);
    this.name = 'FileError';
  }
}

export class ParseError extends SquadError {
  constructor(message, details = null) {
    super(message, 'PARSE_ERROR', details);
    this.name = 'ParseError';
  }
}

export class CommandError extends SquadError {
  constructor(message, details = null) {
    super(message, 'COMMAND_ERROR', details);
    this.name = 'CommandError';
  }
}

/**
 * Print an error in the CLI's stable shape.
 *
 * Typed errors render as `Error [CODE]: message`; anything else is reported as
 * unexpected, with a stack trace only when DEBUG is set.
 * @param {Error} error
 */
export function formatError(error) {
  if (error instanceof SquadError) {
    console.error(`\n❌ Error [${error.code}]: ${error.message}`);
    if (error.details) {
      console.error(`   Details: ${error.details}`);
    }
    console.error('');
    return;
  }

  console.error(`\n❌ Unexpected error: ${error.message}\n`);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
}