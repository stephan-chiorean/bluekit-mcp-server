An **Agent** is a markdown file that defines HOW an expert would think when generating or modifying kits.

This is meta-knowledge, not instructions.

This is the mental model, guiding heuristics, preferred patterns, and best practices for a particular persona/expert.

An agent.md should contain:

- **Style rules** ("Always separate domain logic from UI logic")
- **Preferred patterns** ("Use repository pattern for data access")
- **Red flags** ("Avoid mutable shared state")
- **Quality standards** ("Must include unit tests using Jest + Testing Library")
- **Design philosophies** ("Favor composition over inheritance")
- **Stack-specific expertise** ("When using React, always wrap forms with react-hook-form")
- **Code review heuristics**
- **Security concerns for this area**
- **Architecture principles**
- **Taste** (naming conventions, file organization, code style)

An agent.md file must have `type: agent` in the YAML front matter, otherwise it follows the same structure as kits and walkthroughs.

