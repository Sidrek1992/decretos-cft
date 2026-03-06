---
name: interface-design
description: Guidelines for designing dashboards, admin panels, SaaS apps, and tools with high-end craft and consistency.
---

# Interface Design Skill

## Overview
This skill focuses on designing functional and beautiful interfaces for complex web applications (dashboards, admin panels, tools). It emphasizes a craft-based approach, focusing on detail, consistency, and a premium feel while avoiding "generic AI" outputs.

## Principles

### 1. Typography and Information Hierarchy
- **Standard-Size Type**: High density of information through appropriate sizing (e.g., 14px for body, 16px for secondary headings, 18-20px for titles).
- **Legibility**: Use fonts with wide character ranges (e.g., Inter, Outfit, or custom brand fonts) for maximum clarity in dense UIs.
- **Hierarchy through Contrast**: Distinguish key data points from labels using weight (Medium/SemiBold vs Regular) or subtle color shifts.

### 2. Navigation and Layout
- **Sidebar-First**: For dashboards and complex tools, a structured sidebar (e.g., dark background `#0E172A`) is the standard for high-level navigation.
- **Top Bar Utility**: Use the top bar for breadcrumbs, search, user profile, and context-dependent actions (e.g., "Create New").
- **Content Organization**: Group related information into distinct cards or sections with clear borders and padding.

### 3. Visual Craft (Shadows and Borders)
- **Soft Shadows**: Use multi-layered or very soft shadows (`box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)`) for a premium "floating" effect on cards.
- **Thin Borders**: Subtle, high-contrast borders (e.g., `1px solid hsla(220, 10%, 90%, 0.5)`) for light modes and dark borders for dark mods.
- **Depth and Surface**: Use a subtle background color for the main workspace (e.g., `#F8FAFC`) to differentiate it from pure white cards or panels.

### 4. Interactive Elements
- **Input Fields**: Focus on clean, well-padded input fields with distinct focus states (e.g., high-contrast blue ring).
- **Buttons**: Differentiate Primary, Secondary, and Ghost buttons through color, weight, and subtle depth effects. Use consistent border-radius (e.g., 8px or 12px) across the interface.
- **Hover States**: Every interactive element should have a smooth hover state transition for immediate feedback.

### 5. Data Representation
- **KPI Cards**: Emphasize key metrics with large, bold numbers, clear labels, and subtle trend indicators (e.g., color-coded percentages).
- **Tables**: Use clean, well-spaced tables with subtle row dividers and clear headers. Avoid heavy borders between columns.
- **Empty States**: Design thoughtful and helpful empty states for situations with no data.

## Implementation Workflow

1.  **Understand Intent**: Identify the primary and secondary goals of the interface before designing.
2.  **Establish a Design Token System**: Define base colors, typography scales, and spacing units.
3.  **Propose a Design Direction**: Present a high-level approach or mood board to the user before starting heavy coding.
4.  **Iterative Component Building**: Build and refine core UI elements (Sidebars, Cards, Inputs) based on the design system.
5.  **Assemble and Polish**: Combine components into a cohesive layout, adding final touches like breadcrumbs, search, and refined animations.

## Example: Dashboard Card Component
```css
.card-dashboard {
  background: white;
  border-radius: 12px;
  border: 1px solid hsl(210, 20%, 94%);
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card-dashboard:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
```
