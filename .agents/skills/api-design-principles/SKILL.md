---
name: api-design-principles
description: Guidelines for designing consistent, scalable, and developer-friendly APIs using REST and GraphQL.
---

# API Design Principles Skill

## Overview
This skill focuses on the principles and patterns for designing modern, high-quality APIs. It covers RESTful and GraphQL architectures, versioning, resource-oriented design, and best practices for developer experience.

## Principles

### 1. RESTful Design
- **Resource-Oriented Architecture**: Think in terms of resources (Nouns) rather than actions (Verbs). Use plural nouns for collection names (e.g., `/users`).
- **Standard HTTP Methods**: Correctly map actions to methods:
    - `GET`: Retrieve a resource or collection.
    - `POST`: Create a new resource in a collection.
    - `PUT`: Replace an existing resource completely.
    - `PATCH`: Update an existing resource partially.
    - `DELETE`: Remove a resource.
- **Statelessness**: Each request should contain all the information necessary to process it.

### 2. GraphQL Design
- **Schema-First**: Define the schema (types, queries, mutations, subscriptions) before implementing resolvers.
- **Explicit Operations**: Use `Query` for data retrieval and `Mutation` for any operation that changes state.
- **Efficient Data Fetching**: Prevent "N+1" query problems using data loaders or batching.
- **Type Safety**: Leverage GraphQL's built-in type system for robust validation and self-documentation.

### 3. API Versioning
- **URL Versioning**: (e.g., `/v1/users`) most common for breaking changes.
- **Header Versioning**: (e.g., `Accept: application/vnd.company.v1+json`) for more granular control.
- **Stability**: Avoid frequent breaking changes. Maintain backward compatibility for as long as possible.

### 4. Developer Experience (DX)
- **Clear Documentation**: Use tools like Swagger/OpenAPI or GraphQL Introspection to provide complete, up-to-date documentation.
- **Consistent Responses**: Ensure that error messages and successful responses follow a predictable structure.
- **Meaningful Error Codes**: Use standard HTTP status codes (e.g., 400 for Bad Request, 404 for Not Found, 500 for Internal Server Error) and provide descriptive error messages in the response body.

## Patterns

### REST API Patterns
- **Resource Collection Design**: Support pagination (e.g., `?limit=10&offset=20`), filtering (`?status=active`), and sorting (`?sort=created_at:desc`).
- **HATEOAS**: Include link relationships (e.g., `self`, `next`, `prev`) in responses to help developers discover related resources.
- **Sub-resources**: Use nested paths for logically dependent resources (e.g., `/users/{id}/orders`).

### GraphQL Patterns
- **Output Objects**: Always return the newly created or updated object from mutations to keep client caches up-to-date.
- **Interface and Union Types**: Use these for polymorphic data structures (e.g., `Node` interface for any resource with an ID).
- **Relay Specification**: Follow Relay's conventions for pagination (Connections, Edges, Nodes) if building complex, scalable frontends.

## Example: RESTful Error Response
```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with ID 123 was not found.",
    "status": 404,
    "details": {
      "user_id": 123
    }
  }
}
```

## Red Flags (What to Avoid)
- **Verb-Based URLs**: (e.g., `/getUser`, `/updateProfile`). Use REST methods instead.
- **Inconsistent Naming**: Mixing camelCase, snake_case, and kebab-case in URLs or JSON keys.
- **Opaque Errors**: Returning a generic `500` error without any detail.
- **Sequential Data Fetching**: Building APIs that require the client to make multiple round-trips for related data.
