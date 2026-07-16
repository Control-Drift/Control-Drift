# Project Workspace Rules

## Data Presentation and Metrics

- **Accurate Metric Representation**: All metrics, dashboard numbers, and graphical representations MUST accurately represent the *true* health and data of the environment. 
- **Consider All Tests and Gaps**: When calculating metrics or displaying data, you must account for *all* simulation results and *all* current gaps (provided they are not exact duplicates). 
- **Multi-Test Consideration**: Keep in mind that a single TTP can be tested multiple times across multiple simulations using different payloads, which can form new gaps for that same TTP. Metric models must cleanly support this many-to-one relationship without omitting data or inaccurately skewing scores.
- **Value Over Simplicity**: Never take a shortcut in metric calculation (like simple flat averages) if it compromises the true mathematical representation of the data. Every data pipeline implemented must be built for accurate and valuable data presentation.

## UI and Aesthetics

- **UI Consistency & Quality**: Always ensure the UI maintains a consistent and high-quality appearance whenever a tweak or adjustment is made. Do not let quick functional changes degrade the premium feel, layout alignment, or established design system of the application.

## General Development

- **Holistic Impact Assessment**: Always consider how the whole application may be impacted by every change made. Before committing to a functional tweak or refactor, assess downstream effects, state dependencies, and shared contexts to ensure system-wide stability is preserved.
