export class UnauthenticatedError extends Error {
  override readonly name = 'UnauthenticatedError';
  constructor() {
    super('Please sign in to continue.');
  }
}

export class ForbiddenError extends Error {
  override readonly name = 'ForbiddenError';
  constructor(readonly permission?: string) {
    super("You don't have permission to do that.");
  }
}

export class MfaRequiredError extends Error {
  override readonly name = 'MfaRequiredError';
  constructor() {
    super('Please confirm it is you with your authenticator app.');
  }
}
