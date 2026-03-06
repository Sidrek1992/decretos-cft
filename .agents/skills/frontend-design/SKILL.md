---
name: frontend-design
description: Guidelines for creating distinctive, production-grade frontend interfaces with high design quality. Focuses on aesthetics, typography, color, motion, and spatial composition.
---

# Frontend Design Skill

## Overview
This skill focuses on creating distinctive, high-end, and production-grade frontend interfaces. It prioritizes visual excellence, modern aesthetics, and professional polish over generic AI-generated outputs.

## Core Principles

### 1. Aesthetic Excellence
- **Avoid Generic Defaults**: Do not use standard browser defaults or basic CSS frameworks (like plain Tailwind) without significant customization.
- **Premium Feel**: Aim for a "wow" factor. Use curated color palettes, elegant typography, and subtle micro-animations.
- **Visual Hierarchy**: Clear distinction between primary, secondary, and tertiary elements through size, weight, color, and spacing.

### 2. Typography
- **Modern Fonts**: Use high-quality Google Fonts (e.g., Inter, Roboto, Outfit, Playfair Display) instead of system defaults.
- **Scale and Contrast**: Implement a deliberate typographic scale. Ensure high legibility with appropriate line height (typically 1.5-1.6 for body text) and letter spacing.
- **Intentionality**: Bold headings, subtle labels, and clear differentiation between different types of information.

### 3. Color and Depth
- **Curated Palettes**: Use harmonious colors (HSL-based) rather than basic hex codes. Define primary, secondary, accent, and semantic colors.
- **Depth and Dimension**: Use subtle borders, soft shadows (`box-shadow`), and layered backgrounds to create a sense of depth.
- **Glassmorphism/Vibrancy**: Where appropriate, use `backdrop-filter: blur()`, gradients, and semi-transparent layers for a modern, high-end look.

### 4. Motion and Interaction
- **Micro-animations**: Subtle hover effects, smooth transitions on state changes, and entrance animations for key elements.
- **Feedback**: Immediate and clear visual feedback for all user interactions (clicks, hovers, loading states).
- **Smoothness**: Use `ease-in-out` or custom cubic-bezier curves for transitions to ensure they feel natural and premium.

### 5. Spatial Composition
- **Generous White Space**: Avoid cramped layouts. Use padding and margin to let elements "breathe."
- **Grid and Flexbox**: Use modern layout techniques for responsive and precise alignment.
- **Consistency**: Maintain a consistent spacing system (e.g., 4px or 8px increments).

## Implementation Workflow

1.  **Understand Intent**: Before coding, deeply explore the user's requirements and the specific context of the interface.
2.  **Define Design System**: Establish color tokens, typography rules, and spacing constants in a central CSS/theme file.
3.  **Build Components**: Create modular, reusable components that strictly follow the design system.
4.  **Refine and Polish**: Iterate on the visual details (shadows, borders, animations) until the interface feels professional and "finished."
5.  **Performance Check**: Ensure that animations and high-resolution assets do not compromise performance.

## Red Flags (What to Avoid)
- **Plain Colors**: (e.g., `background-color: blue`, `color: red`).
- **Default Borders**: (e.g., `1px solid black`).
- **No Animations**: Static interfaces that feel "dead."
- **Cramped Layouts**: Lack of white space and inconsistent margins.
- **Generic Icons**: Use high-quality icon sets like Lucide or Phosphor Icons.

## Example: Premium Button Style
```css
.btn-premium {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 9999px;
  background: linear-gradient(135deg, hsl(230, 80%, 60%), hsl(260, 80%, 60%));
  color: white;
  font-weight: 600;
  border: none;
  box-shadow: 0 4px 15px hsla(245, 80%, 60%, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.btn-premium:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px hsla(245, 80%, 60%, 0.4);
}

.btn-premium:active {
  transform: translateY(0);
}
```
