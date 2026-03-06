---
name: prompt-engineering-patterns
description: Use when designing and optimizing prompts for LLMs, including few-shot, chain-of-thought, and structured outputs.
---

# Prompt Engineering Patterns Skill

## Overview
This skill focuses on the patterns and techniques for crafting high-quality prompts that elicit consistent, accurate, and structured responses from Large Language Models (LLMs). It covers core capabilities, key patterns, and optimization strategies.

## Core Capabilities

### 1. Few-Shot Learning
- **Demonstrations**: Provide input-output pairs to show the model the desired format and style.
- **Example Selection**: Use semantic similarity or diversity sampling to select the most relevant examples for a given query.
- **Context Window Management**: Balance the number and size of examples with the model's context window constraints.

### 2. Chain-of-Thought (CoT)
- **Step-by-Step Reasoning**: Encourage the model to think through a problem sequentially to improve accuracy, especially for complex tasks.
- **Zero-Shot CoT**: Use phrases like "Let's think step by step" to elicit reasoning without explicit examples.
- **Few-Shot CoT**: Provide reasoning traces within your demonstrations.

### 3. Structured Outputs
- **JSON Mode**: Leverage model-specific features (like JSON mode) for reliable parsing by downstream applications.
- **Schema Enforcement**: Use tools (e.g., Pydantic in Python) to define and validate the expected output structure.
- **Type-Safe Responses**: Ensure that the model returns values of the correct types (strings, numbers, booleans).

### 4. Template Systems
- **Variable Interpolation**: Use placeholders (e.g., `{text}`, `{{user_name}}`) to create dynamic prompts.
- **Conditional Logic**: Include or exclude prompt sections based on specific conditions or input parameters.
- **Role-Based Composition**: Define distinct roles (e.g., "Software Architect", "Helpful Assistant") to guide the model's behavior.

## Key Patterns

### Pattern 1: Structured Output with Validation
Define a schema (e.g., Pydantic model) and instruct the model to return JSON that matches that schema. Use automatic validation and retry logic for malformed outputs.

### Pattern 2: Chain-of-Thought with Self-Verification
Ask the model to work through a problem, state its final answer, and then verify that answer against the original prompt or specific constraints.

### Pattern 3: Few-Shot with Dynamic Example Selection
Use a vector database (e.g., Chroma, Voyage AI) to retrieve the most semantically similar examples for each user query, providing the most relevant context for the task.

### Pattern 4: Progressive Disclosure
Start with a simple prompt and add complexity (constraints, reasoning steps, examples) only when the model fails to produce the desired result.

## Optimization Strategies

- **Iterative Refinement**: Continuously evaluate and improve prompts based on real-world performance and edge cases.
- **Token Efficiency**: Remove unnecessary words, use concise instructions, and optimize examples to minimize token usage without sacrificing quality.
- **A/B Testing**: Compare the performance of different prompt variations to identify the most effective version for a specific task.
- **System Prompt Design**: Use the system prompt to set high-level behavior, constraints, and output formats that persist across an entire conversation.

## Example: CoT with Self-Verification
```markdown
Solve this logic puzzle step by step.

Problem: [Puzzle Description]

Instructions:
1. Break down the problem into logical steps.
2. Show your reasoning for each step.
3. State your final answer clearly.
4. Verify your answer by double-checking it against the original problem constraints.

Format:
## Steps
[Reasoning]

## Answer
[Final Answer]

## Verification
[Reasoning to confirm the answer is correct]
```

## Red Flags (What to Avoid)
- **Vague Instructions**: Avoid phrases like "be creative" or "summarize well." Be specific about what you want.
- **Ambiguous Constraints**: Ensure all rules and limitations are clearly defined.
- **Overwhelming Information**: Don't provide too many irrelevant details that might distract the model.
- **Missing Negative Constraints**: If you don't want something (e.g., "don't use jargon"), state it explicitly.
