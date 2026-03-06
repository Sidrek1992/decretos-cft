---
name: error-handling-patterns
description: Guidelines for implementing robust, scalable, and developer-friendly error handling in modern applications.
---

# Error Handling Patterns Skill

## Overview
This skill focuses on establishing a robust framework for error handling. It covers philosophies, categories, language-specific patterns (Python, TS, JS), and universal patterns to ensure applications are resilient and provide clear feedback.

## Principles

### 1. Error Handling Philosophies
- **Exceptions vs Result Types**:
  - **Exceptions**: Disrupt control flow; use for "exceptional" (unexpected) conditions (e.g., database connection failure).
  - **Result Types**: Explicitly return success or failure; use for "expected" errors (e.g., validation failures).
- **Graceful Failure**: Always aim to provide a fallback or clear error message instead of crashing or showing a generic "Something went wrong."

### 2. Error Categories
- **Recoverable Errors**: Errors that can be handled (e.g., network timeout, invalid input). Provide retry mechanisms or fallback values.
- **Unrecoverable Errors**: Critical failures (e.g., OOM, logic bugs). Log aggressively and fail fast to prevent data corruption.
- **User Errors**: Input-related; return clear, actionable feedback to the user.

### 3. Developer Experience (DX)
- **Detailed Error Messages**: Use unique error codes (`CODE_HERE`) and descriptive messages to help developers debug.
- **Contextual Information**: Include relevant data (e.g., invalid ID, parameter name) in the error response.
- **Consistent Response Structure**: Ensure that error objects follow a predictable format across the API.

## Patterns

### TypeScript/JavaScript Error Handling
- **Custom Error Classes**: Extend the base `Error` class to create domain-specific error types (e.g., `ValidationError`, `NotFoundError`).
- **Result Type Pattern**: Use a literal type (e.g., `{ ok: true, data: T } | { ok: false, error: E }`) for explicit error handling without exceptions.
- **Async Error Handling**: Correctly handle errors in `async/await` blocks with `try/catch` and appropriate error propagation.

### Python Error Handling
- **Application Exception Hierarchy**: Define a base `AppError` and specialized subclasses to categorize errors.
- **Circuit Breaker Pattern**: Prevent cascading failures in distributed systems by temporarily "opening" the circuit after repeated failures to an external service.
- **Retry with Exponential Backoff**: Use decorators or library implementations to retry failing operations with increasing delays.

### Universal Patterns
- **Error Aggregation**: Collect multiple validation errors and return them all at once rather than failing on the first error.
- **Graceful Degradation**: Provide a fallback value or simplified functionality when a non-critical component fails.

## Red Flags (What to Avoid)
- **Swallowing Exceptions**: `try: ... except: pass` is a critical failure. Always log or handle the error.
- **Opaque Error Messages**: Returning "Internal Server Error" for every failure.
- **Inconsistent Error Formats**: Mixing various error structures across different parts of the application.
- **Exceptions for Control Flow**: Using exceptions for normal, expected business logic branching.

## Example: Custom Error Class (TS)
```typescript
class ApplicationError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
```
