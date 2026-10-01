// Augment Express Request with an id property for request tracing.
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export {};
