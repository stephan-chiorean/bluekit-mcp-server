A **Blueprint** is a human-readable execution plan that organizes multiple Kits into ordered execution layers.

A Blueprint:

1. **Groups multiple Kits together**: Combines related Kits into a cohesive plan

2. **Specifies execution order**: Defines which Kits run first, then which run next

3. **Represents multi-agent, multi-step workflows**: Orchestrates complex, multi-phase development

4. **Is not sent as one payload**: It is unwrapped by the human, not executed as a single agent call

5. **Defines structure, dependencies, and phases**: Shows how Kits relate and depend on each other

6. **Kits are run individually**: Each Kit in the Blueprint is executed separately, one at a time

In short:

➡️ A Blueprint is a layered orchestration map made of Kits, showing what to run and in what order — but never executed as a single agent call.



