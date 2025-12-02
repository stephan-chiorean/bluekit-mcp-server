# Blueprints vs Clones — Summary & Interaction Model

## Clones (Concrete App States)

A **clone** is a full git clone of a project at a given point in time.

### Characteristics
- Represents an actual, runnable, deployable version of the application
- Allows users to maintain many parallel variations of the same app (feature experiments, rewrites, UI variations, etc.)
- Clones can be:
  - modified locally
  - compared
  - deployed
  - organized into clone trees (a visual graph of all app variations)
  - shared with others

### Purpose
Provide a reproducible, isolated, concrete codebase for experimentation or deployment.

---

## Blueprints (Generative, Parameterized Structures)

A **blueprint** is a structured, decomposed representation of an application or feature.

### Characteristics
- Built from kits, tasks, and handlebars-style templates that allow parameterization (colors, labels, architecture choices, feature toggles, etc.)
- Blueprints are **not** code snapshots
- They are recipes meant for:
  - regeneration of code
  - consistent scaffolding
  - parameterized variations
  - modular assembly from multiple kits
  - re-composition of different features or flows

### Purpose
Provide a reusable, modular, configurable structure for generating or regenerating codebases.

---

## How They Interact

### 1. Blueprints → Clones

You can generate a new clone from a blueprint.

This gives you a concrete, runnable project based on:
- the blueprint's structure
- the selected parameters
- the kit/task composition

### 2. Clones → Blueprints

You can extract or refine a blueprint from a clone.

This allows users to:
- capture architecture decisions
- decompose the clone into kits/tasks
- introduce parameters later
- turn experiments into structured templates

### 3. Iterative Loop (Practical Current Workflow)

1. User works in a clone
2. Extract or update a blueprint from that clone
3. Adjust blueprint parameters/templates
4. Regenerate a new clone
5. Repeat until the blueprint is solid
6. Publish blueprint (optional)

This acknowledges that blueprints take iteration and are not created perfect on first try.

---

## Practical State of Each Today

### ✔ Clones
- Fully working
- Parallel clone trees implemented
- Ideal for experimentation + deployment
- Users can immediately benefit from clone-level versioning

### ✔ Blueprints (current early stage)
- Basic task layering
- Handlebars parameterization
- Early composability
- Still evolving as a structured, reusable generative layer

---

## Vision (Where This Is Going)

### Clones = Personalized, runnable app versions
- A forest of parallel application universes
- Sharable, deployable, experiment-friendly
- Represents **what the app is**

### Blueprints = Regenerative, modular architecture layer
- Parameterized, composable instructions
- Built from kits + tasks
- Language-agnostic patterns
- Represents **how the app should be generated or modified**
- Eventually supports multi-agent workflows, semantic levers, and dynamic recomposition

### Long-term Dynamic Between Them
- **Clones** show variation
- **Blueprints** encode structure
- **Kits** provide units of reuse
- Together they create a system where:
  - structure can be regenerated
  - variation can be captured
  - and apps can evolve in parallel without friction

---

## Key Insights

1. **Clones are concrete** — they represent a specific state of working code
2. **Blueprints are abstract** — they represent the generative structure that can produce many clones
3. **The relationship is bidirectional** — clones can inform blueprints, and blueprints can generate clones
4. **Iteration is expected** — blueprints are refined over time through experimentation in clones
5. **Both are valuable** — clones for immediate work and deployment, blueprints for reusability and systematic generation
