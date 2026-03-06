---
name: postgresql
description: Guidelines for designing, implementing, and optimizing PostgreSQL databases for high-quality, production-grade applications.
---

# PostgreSQL Skill

## Overview
This skill focuses on best practices and design principles for working with PostgreSQL databases. It covers table design, data types, constraints, indexing, and advanced features to ensure high performance, data integrity, and scalability.

## Principles

### 1. Core Rules for Table Design
- **Primary Keys**: Always define a `PRIMARY KEY` for reference tables. Prefer `BIGINT GENERATED ALWAYS AS IDENTITY`. Use `UUID` only if global uniqueness or opacity is required.
- **Normalization**: Aim for Third Normal Form (3NF) to minimize redundancy and update anomalies. Denormalize only for proven performance improvements (high ROI).
- **Not Null and Defaults**: Add `NOT NULL` to all semantically required columns. Use `DEFAULT` for common initial values.
- **Foreign Key Indexes**: Postgres does NOT automatically index foreign key columns. Create these manually to speed up joins and prevent locking issues.

### 2. Data Types and Precision
- **Event Time**: Prefer `TIMESTAMPTZ` for all event timestamps.
- **Money**: Use `NUMERIC` to avoid rounding errors.
- **Strings**: Use `TEXT` for strings of arbitrary length.
- **Floating Point**: Use `DOUBLE PRECISION` or `NUMERIC` (for exact arithmetic).
- **Integers**: Use `BIGINT` for all primary keys and large numeric values.

### 3. PostgreSQL "Gotchas"
- **Snake Case**: Identifiers are lowercased unless quoted. Use `snake_case` for all table and column names by default.
- **Unique + NULLs**: Standard `UNIQUE` constraints allow multiple `NULL` values. For restrictive behavior, use `UNIQUE (...) NULLS NOT DISTINCT` (PG15+).
- **Sequence Gaps**: Rollbacks or crashes create gaps in auto-generated IDs. This is expected—don't try to make IDs consecutive.
- **No Silent Coercions**: Length or precision overflows in Postgres will error out (unlike some databases that silently truncate).

## Advanced Patterns

### 1. Constraints and Validation
- **Check Constraints**: Use `CHECK (condition)` for row-local validation (e.g., `CHECK (price > 0)`). Note: NULL values pass these checks.
- **Exclusion Constraints**: Use `EXCLUDE` (often with GiST indexes) to prevent overlapping values (e.g., double-booking rooms).

### 2. Indexing Strategies
- **B-Tree**: Default for most equality and range queries (`=`, `<`, `>`, `BETWEEN`, `ORDER BY`).
- **Composite Indexes**: Use these for queries that filter on multiple columns. Order matters—the leftmost prefix is most critical.
- **Partial and Expression Indexes**: Use `WHERE` on indexes or index computed values (e.g., `LOWER(email)`) for hot subsets or specific search keys.
- **GIN/GiST**: Use GIN for JSONB and arrays. Use GiST for geometry, ranges, and exclusion constraints.

### 3. Performance and Scalability
- **Partitioning**: Use for very large tables (>100M rows) to improve query pruning and maintenance. Favor declarative partitioning (PG10+) or tools like TimescaleDB.
- **Row-Level Security (RLS)**: Enable RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) and create policies for granular, user-based access control.
- **MVCC and Vacuuming**: Be aware that updates and deletes create "dead tuples," and `VACUUM` handles their cleanup. Design to avoid excessive "hot row churn."

## Red Flags (What to Avoid)
- **Missing PKs**: Every reference table MUST have a PK.
- **Quoted Identifiers**: Avoid ` "MixedCaseColumn" ` names; use `snake_case`.
- **Silent Truncation**: Don't use data types with lengths that you assume will be "long enough." Use `TEXT`.
- **Global Unique Constraints in Partitioning**: Be aware that you cannot have a global unique constraint on a partitioned table unless it includes the partition key.

## Example: Table Definition with Best Practices
```sql
CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_login TIMESTAMPTZ,
  settings JSONB DEFAULT '{}' NOT NULL
);

-- Remember to index FKs!
CREATE INDEX idx_users_email_lower ON users (LOWER(email));
```
