---
name: react-best-practices
description: Use when building React and Next.js applications, especially when optimizing for performance and best practices on Vercel.
---

# Vercel React Best Practices

## Overview
This skill contains a comprehensive set of performance and code quality rules for React and Next.js applications, categorized by impact (CRITICAL to LOW).

## Key Areas of Focus

### 1. Eliminating Waterfalls (CRITICAL)
- **Parallel Data Fetching**: Do not await multiple database/external requests sequentially. Use `Promise.all()` for parallel execution.
- **Pre-fetching**: Use `prefetch` or `preload` strategies for data needed in subsequent steps or child components.

### 2. Bundle Size Optimization (HIGH)
- **Lazy Loading**: Use `next/dynamic` or `React.lazy` for large components that are not needed during the initial load or in certain conditions.
- **Tree-shaking**: Use libraries that support tree-shaking to eliminate unused code.
- **Optimize Assets**: Ensure images are optimized (e.g., using `next/image`) and other static assets are appropriately compressed.

### 3. Server-Side Performance (HIGH)
- **Server Components (RSC)**: Favor Server Components over Client Components for data fetching and heavy rendering to reduce client-side overhead.
- **Edge Runtime**: Where appropriate, use the Edge Runtime for reduced latency on globally distributed platforms like Vercel.
- **Caching**: Implement effective caching strategies (e.g., `revalidate`, `memo`, `use cache`) for frequently accessed data.

### 4. Client-Side Rendering and State (MEDIUM)
- **Memoization**: Use `useMemo`, `useCallback`, and `React.memo` to prevent unnecessary re-renders of expensive components.
- **State Management**: Keep state as local as possible. Avoid prop-drilling or large global state objects for small, local data needs.
- **Avoid Over-Rendering**: Optimize component structures and event handlers to minimize the frequency and scope of layout shifts and re-renders.

### 5. Layout and UX (MEDIUM)
- **Layout Consistency**: Use a consistent layout system (e.g., a shared `Layout` component) to avoid flash of unstyled content (FOUC) and layout shifts.
- **Loading States**: Provide clear loading indicators (e.g., skeletons, spinners) for all asynchronous operations.
- **Error Boundaries**: Wrap critical UI sections in React Error Boundaries to catch and handle errors gracefully without crashing the entire app.

## Rules Summary
The full list contains over 40 rules. Here are the top 5 performance-critical rules:

1.  **Rule 1**: NEVER perform sequential `await` calls for independent data fetches. Use `Promise.all()`.
2.  **Rule 2**: Use Server Components for all data fetching and SEO-sensitive content unless interactivity is strictly required.
3.  **Rule 3**: Optimize images using `next/image` to prevent layout shifts and ensure efficient delivery.
4.  **Rule 4**: Use `next/dynamic` for large, non-critical components to reduce initial JavaScript payload.
5.  **Rule 5**: Always provide loading and error states for any asynchronous or data-dependent component.

## Best Practices for AI Agents
- **Context Efficiency**: Do not repeat these rules in every response. Reference them or apply them directly to the code.
- **Modular Code**: Prefer small, focused components and utilities over large, monolithic files.
- **Type Safety**: Use TypeScript for all React and Next.js code to ensure robustness and catch errors early.

## Example: Parallel Data Fetching
```typescript
// BAD: Sequential await (Waterfall)
async function ProductPage({ id }: { id: string }) {
  const product = await getProduct(id);
  const reviews = await getReviews(id); // waits for product
  const related = await getRelated(id); // waits for reviews
  // ...
}

// GOOD: Parallel execution
async function ProductPage({ id }: { id: string }) {
  const [product, reviews, related] = await Promise.all([
    getProduct(id),
    getReviews(id),
    getRelated(id),
  ]);
  // ...
}
```
