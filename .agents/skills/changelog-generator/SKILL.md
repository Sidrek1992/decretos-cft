---
name: changelog-generator
description: Automatically generates professional, user-facing changelogs from git commits.
---

# Changelog Generator Skill

## Overview
This skill automates the creation of high-quality, professional changelogs based on git commit history. It transforms technical commit messages into descriptive, customer-focused updates that accurately represent the work done.

## Principles

### 1. Categorization
Group changes into clear, logical categories to make the changelog easy to scan and understand:
- **Features**: New functionality and enhancements.
- **Improvements**: Enhancements to existing features.
- **Bug Fixes**: Resolved issues and technical corrections.
- **Performance**: Optimizations and speed improvements.
- **Documentation**: Updates to guides, READMEs, and API docs.
- **Internal**: Maintenance, refactoring, and dependency updates (usually hidden from end-users).

### 2. Descriptive Clarity
Transform raw commits like "fix: bug in auth" or "add: user profile" into descriptive, action-oriented items:
- **Raw**: "fix: bug in auth" -> **Professional**: "Resolved an authentication issue where users were intermittently logged out after session expiration."
- **Raw**: "add: user profile" -> **Professional**: "Introduced a comprehensive user profile system with support for custom avatars and contact information."

### 3. Tone and Audience
- **Customer-Focused**: Use language that the end-user or stakeholder can understand. Avoid overly technical jargon where possible.
- **Professional**: Maintain a consistent, polished tone throughout the changelog.
- **Action-Oriented**: Start descriptions with active verbs (e.g., "Added", "Improved", "Fixed", "Updated").

### 4. Technical Detail (Optional)
Include technical details (e.g., commit hashes, PR numbers) only if it's relevant to the audience (e.g., for developer-facing changelogs or internal tracking).

## Methodology

1.  **Extract Data**: Retrieve the commit history for a specified range (e.g., between two tags or within a certain time frame).
2.  **Filter and Group**: Exclude internal or irrelevant commits and group remaining items into categories based on their purpose.
3.  **Rewrite and Polish**: Use your language model capabilities to rephrase and refine each commit message into a professional, descriptive item.
4.  **Format and Output**: Present the final changelog in a clean, structured format (e.g., Markdown).

## Red Flags (What to Avoid)
- **Technical commit messages**: Avoid directly copying raw commits (e.g., "feat: add button").
- **Vague descriptions**: Avoid phrases like "Minor changes" or "Various bug fixes" without more specific detail.
- **Inconsistent categories**: Ensure that each item is placed in the most appropriate category.
- **Technical jargon**: (Unless the audience is specifically developers) avoid terms like "refactor", "CI/CD", or "dependency injection".

## Example: Professional Changelog Item
```markdown
### Features
- **Project Management**: Implemented a new dashboard for project tracking, allowing users to visualize progress and team performance in real-time.
- **Notification System**: Added support for real-time email notifications for critical project updates and mentions.

### Improvements
- **UI Responsiveness**: Enhanced the application's mobile layout for better usability on smaller screens.
- **Performance**: Optimized the initial dashboard load time by up to 40% through lazy loading and improved data fetching.

### Bug Fixes
- **Authentication**: Resolved an issue that prevented some users from logging in via Google OAuth.
- **Data Export**: Fixed a bug where CSV exports of project data were occasionally corrupted.
```
