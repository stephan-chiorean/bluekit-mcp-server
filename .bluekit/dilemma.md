# The Kit Abstraction Dilemma

## The Core Question

**What is a Kit, really?**

Is it:
- A) A structured, opinionated template with enforced conventions?
- B) A minimal container for "anything you want to reuse"?
- C) Something in between that we haven't figured out yet?

## The User Journey Scenarios

### Scenario 1: The Specific UI Component
User: "I built this really specific modal component with custom animations. I want to use it again in another project."

**What they do:**
- Chat with Claude: "Turn this modal into a kit"
- Kit gets created with the exact code, exact styling, exact dependencies
- Later: "Use that modal kit in this new project"

**Kit structure needed:**
- Just enough to store it
- Just enough to reference it
- Just enough to execute it

**Question:** Does this need tags? Does it need a description? Or is that overhead for something so personal and context-specific?

### Scenario 2: The Refined Pattern
User: "We've built 3 Rust backends and finally figured out our perfect architecture. Save this as a template."

**What they do:**
- Chat: "Create a kit from this backend architecture"
- Kit extracts patterns, not specifics
- Uses tokens like `{{project_name}}`, `{{db_type}}`
- Later: "Generate a new backend using that pattern"

**Kit structure needed:**
- Token system for parameterization
- Clear sections for different architectural concerns
- Maybe even schema validation for required tokens

**Question:** Is this still a "kit" or is this a "blueprint"? Are we inventing too many terms?

### Scenario 3: The Quick Snippet
User: "Save this bash script I use for deployments"

**What they do:**
- Just want it saved, tagged, searchable
- Don't care about structure or metadata
- Just want to find it later and copy-paste

**Kit structure needed:**
- Bare minimum
- Maybe just markdown with front matter

**Question:** Is forcing YAML front matter with tags/description too much ceremony for this?

## The Current BlueKit Reality

### What We Have Built

```
.bluekit/
  kits/           # Markdown files with YAML front matter
  walkthroughs/   # Markdown files with YAML front matter
  agents/         # Markdown files with YAML front matter
  blueprints/     # JSON with layers and tasks
  diagrams/       # Mermaid with YAML front matter
  tasks/          # Just markdown
```

### The Pattern We're Enforcing

Every kit needs:
- `id`: unique identifier
- `alias`: display name
- `type`: 'kit'
- `version`: number
- `tags`: 1-3 descriptive tags
- `description`: clear sentence

### The Questions This Raises

1. **Is this too much structure for casual use?**
   - If I just want to save a snippet, do I need all this metadata?
   - Will users abandon the tool because it's "too formal"?

2. **Is this enough structure for serious use?**
   - If I'm building reusable templates, do I need token schemas?
   - Should there be validation for required variables?
   - What about dependencies or prerequisites?

3. **Are we building the right abstractions?**
   - Kit vs Walkthrough vs Agent vs Blueprint - are these distinct enough?
   - Or are we just creating folder organization?

## The Competitive Threat: Cursor

**What's stopping Cursor from doing this better?**

They could build:
- `@generate-from-pattern` command
- Save any code as a "Cursor Template"
- Trigger background agents to execute templates
- Built directly into the IDE
- No MCP server needed
- No separate UI app needed

**Our advantage (maybe?):**
- Cross-IDE (works with any MCP client)
- Separate UI for browsing/managing artifacts
- Project-scoped organization (`.bluekit/` directory)
- Structured metadata for searchability

**But is that enough?**

If Cursor ships this into the editor with better UX, do we lose?

## The Abstraction Spectrum

### Option A: Minimal Container (Agnostic)

**Philosophy:** "Kits are just markdown files with optional metadata"

```markdown
---
tags: [optional]
description: optional
---

# Whatever you want here

Could be code, could be prose, could be ASCII art.
No rules, just a container.
```

**Pros:**
- Zero friction to create
- Maximally flexible
- Users can evolve their own conventions

**Cons:**
- Less structured = harder to build features on top
- UI can't do much beyond "show markdown"
- No validation, no guarantees

### Option B: Structured Template (Opinionated)

**Philosophy:** "Kits are executable templates with schemas"

```markdown
---
id: backend-template
tags: [rust, backend, postgresql]
description: Production-ready Rust backend
schema:
  required:
    - project_name
    - db_url
  optional:
    - port
---

# {{project_name}} Backend

Database: {{db_url}}
Port: {{port|default:8080}}

[Structured sections follow...]
```

**Pros:**
- Predictable execution
- Can build smart features (validation, autocomplete)
- Clear expectations

**Cons:**
- Steeper learning curve
- Might be overkill for simple use cases
- Feels like "yet another template language"

### Option C: Layered Flexibility (Hybrid)

**Philosophy:** "Minimal required, progressive enhancement"

**Base requirement:** Just markdown
**Optional layers:**
- Add front matter → becomes searchable
- Add tokens → becomes parameterized
- Add schema → gets validation
- Add tests → gets verification

**Example:**

```markdown
# My Component

Just markdown, no front matter needed.
Gets saved, that's it.
```

vs.

```markdown
---
tags: [react, form]
---

# Form Component

Has tags, now searchable in UI.
```

vs.

```markdown
---
tags: [react, form]
tokens:
  - name
  - validation_schema
---

# {{name}} Component

Parameterized, can prompt for values.
```

**Pros:**
- Start simple, grow as needed
- No forced ceremony
- Power users get power features

**Cons:**
- Inconsistent structure = harder to build reliable features
- Users might not discover advanced features
- More complex to implement

## The Real Dilemma

### What is BlueKit's Value Proposition?

1. **Storage?**
   - Filesystem already does this
   - Git already versions it
   - Why do you need BlueKit?

2. **Organization?**
   - Tags and search?
   - But so does any note-taking app

3. **Execution?**
   - MCP can trigger Claude to execute kits
   - But so can... just copy-pasting into chat

4. **Structured Reusability?**
   - Templates with token replacement
   - But so can Handlebars, Jinja, etc.

5. **AI-Native Workflow?**
   - Natural language → Kit → Execution
   - Chat interface for creating/using kits
   - Background agents for execution
   - **This might be it**

### The Hypothesis

**BlueKit's moat is the UX of the AI workflow:**

1. Natural language kit creation: "Turn this into a reusable pattern"
2. Smart kit execution: Claude understands context and adapts
3. Playground UI: Visual browse/search/execute without leaving flow
4. Project-scoped: Kits live with your project, version with git

**Not** about being the best template engine.
**Not** about being the best docs tool.
**About** being the smoothest AI-assisted code reuse workflow.

## The Decision Framework

### If BlueKit is about AI-assisted workflows, then:

**Kits should be:**
- ✅ Simple enough that Claude can generate them from any code
- ✅ Structured enough that UI can parse and display nicely
- ✅ Flexible enough to handle "save this specific thing" AND "generalize this pattern"
- ✅ Agnostic enough to work across tech stacks
- ⚠️ NOT trying to be a full-featured template engine
- ⚠️ NOT enforcing too much ceremony

### Proposed: Minimal Viable Structure

**Required:**
- Must be markdown
- Must have YAML front matter (even if empty)
- Front matter must have `type` field to distinguish artifacts

**Optional but encouraged:**
- `tags`: for searchability in UI
- `description`: for quick understanding in UI
- `tokens`: for parameterization (freeform, no schema)

**Everything else:** Free-form markdown

### This means:

```markdown
---
type: kit
---

# Whatever

[Anything goes here]
```

is valid.

And so is:

```markdown
---
type: kit
tags: [rust, backend, auth]
description: JWT authentication middleware
tokens:
  - secret_key
  - expiry_duration
---

# JWT Auth Middleware

[Detailed implementation with {{secret_key}} and {{expiry_duration}}]
```

**The UI handles both gracefully:**
- First one: Shows markdown, no tags to filter by, no tokens to fill
- Second one: Shows in tag filters, prompts for tokens on execution

## What About Feature Creep?

### Current Artifact Types

- **Kit:** Reusable code/pattern (this discussion)
- **Walkthrough:** Documentation of how something works
- **Agent:** Prompt for autonomous agent behavior
- **Blueprint:** Multi-layer project generation
- **Diagram:** Visual architecture representation
- **Task:** One-off todo items

### The Question: Is this too many types?

**Counterpoint:** They're all just markdown with `type` field.

The "types" are really just:
1. Folders for organization (`.bluekit/kits/` vs `.bluekit/agents/`)
2. UI tabs for filtering
3. Semantic meaning for users

**They're not separate systems**, they're organizational buckets.

### Alternative: Just "Artifacts"

```
.bluekit/
  artifacts/
    my-component.md (type: kit)
    auth-flow.md (type: walkthrough)
    test-runner.md (type: agent)
```

Single folder, single concept, `type` field differentiates.

**Trade-off:** Cleaner conceptually, but harder to browse filesystem directly.

## The Cursor Comparison

### What Cursor Could Do

```javascript
// In Cursor editor
> @save-pattern "This form component"
// Saves to .cursor/patterns/form-component.md

> @use-pattern "form-component" with name="LoginForm"
// Background agent executes it
```

**Advantages:**
- Seamless IDE integration
- No separate app needed
- Already have the user base

**What they'd struggle with:**
- Cross-IDE portability (Cursor-locked)
- Project organization (where do patterns live?)
- Discoverability (UI for browsing patterns)
- Standardization (every user invents their own system)

### What BlueKit Offers Differently

1. **Standard structure** everyone uses (`.bluekit/` directory)
2. **Cross-tool compatibility** (any MCP client)
3. **Dedicated UI** for artifact management
4. **Git-friendly** (just files, easy to version/share)
5. **Project-scoped** by default (artifacts live with code)

### The Real Competition

Not Cursor itself, but **Cursor + Copy-Paste**.

Why use BlueKit when you can:
1. Save snippet in Notes app
2. Paste into Cursor chat: "Use this pattern for new component"
3. Done

**Answer:** When copy-paste breaks down:
- Working across multiple projects
- Need to track variations of a pattern
- Want searchable/browsable library
- Team sharing of patterns
- Version history of patterns

## Conclusion: The Bet We're Making

### BlueKit's Value Proposition

**We are NOT building:**
- A template engine (Handlebars exists)
- A snippet manager (Alfred/Raycast exist)
- An AI coding assistant (Cursor/Copilot exist)

**We ARE building:**
- The **file system structure** for AI development artifacts
- The **MCP interface** for AI-assisted code reuse
- The **UI layer** for browsing/managing these artifacts
- The **workflow** for natural-language pattern creation/execution

### The Minimal Viable Abstraction

**Kits should be:**
- Markdown files (human-readable, git-friendly)
- With YAML front matter (machine-parseable, UI-friendly)
- Stored in `.bluekit/kits/` (standardized, discoverable)
- Executed via MCP tools (AI-native, context-aware)
- Viewed in BlueKit UI (visual, searchable)

**Kits should NOT be:**
- Opinionated about content structure
- Enforcing schemas or validation (unless user adds it)
- Trying to replace proper template engines
- Language or framework specific

### The Answer to "Opinionated vs Agnostic"

**Agnostic container, opinionated workflow.**

The kit structure itself: minimal, flexible, agnostic.
The experience of creating/using kits: smooth, guided, opinionated.

Users can put anything in a kit (agnostic).
BlueKit makes it easy to create, find, and execute kits (opinionated UX).

---

## Open Questions

1. **Token replacement:** Do we build it into MCP tools, or let Claude handle it naturally?
2. **Validation:** Should kits be able to declare required vs optional tokens?
3. **Dependencies:** Should kits be able to reference other kits?
4. **Versioning:** How do we handle kit evolution over time?
5. **Sharing:** Should there be a global kit registry, or just per-project?

These questions determine how much we're building a "system" vs a "convention."

Right now, we're more convention than system. Is that enough?
