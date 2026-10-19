---
name: git_tooling
description: Code versioning workflow rules, commit styling standards, branch naming, and gradle/build configurations.
---

# Git and Tooling Skills

This skill defines the development workflows, version control standards, and tooling guidelines for code changes.

## Git Standards

1. **Branch Naming**:
   - Feature branches: `feature/short-description`
   - Bugfix branches: `bugfix/short-description`
   - Chore branches: `chore/short-description`

2. **Commit Style (Conventional Commits)**:
   - Structure commit messages as: `<type>(<scope>): <subject>`
   - Common types:
     - `feat`: A new user-facing feature.
     - `fix`: A bug fix.
     - `chore`: Maintenance work, dependency upgrades, build scripts.
     - `docs`: Documentation edits.
     - `style`: Code formatting changes (whitespace, semicolons).
     - `refactor`: Structural code changes without fixing bugs or adding features.

3. **PR/Commit Guidelines**:
   - Limit commits to a single, logical change.
   - Avoid long, monolithic commits. Break down changes into clean, reviewable chunks.

## Gradle and Build Tooling

1. **Gradle Build Scripts**:
   - Write and modify scripts using Kotlin DSL (`build.gradle.kts`).
   - Use Version Catalogs (`libs.versions.toml`) to centralize dependency management if configured.

2. **Static Analysis & Linting**:
   - Run checks (`./gradlew lint` or `./gradlew detekt`) prior to pushing changes to detect style inconsistencies or potential code errors.
