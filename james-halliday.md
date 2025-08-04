## I will record all the instructions and thought processes for the AI Agent(Claude Code) in this file.

## Goal
I want to clone the classic game ‘lode runner’, the game should run in web browser, I want to choose Phaser(https://docs.phaser.io/phaser/getting-started/what-is-phaser) as the engine for this game

The project at https://github.com/quboqin/Lode-Runner-Roku provides the required soundtrack and artwork, including the game's sprites and animation. Also, the data structure for level design can be referred to. 

Deploy this game to Vercel

## Phase 1 - Planning
1. In this project, I want to use sub agents by Claude Code to replace Super Claude
>do this task manually
>```bash
>SuperClaude uninstall
>```

2. First, create a Project Manager Agent to help me manage the progress of the entire project, break down requirements and tasks, set up project Check Points, update the project progress after completing tasks, and record the progress in a progress file. Since this is a cloned project, there is no particular need for a Product Manager and a UX role. Maybe a hybrid role is needed to oversee the interface interaction and animation effects.

3. Generate the above two sub-agents according to the specifications in https://docs.anthropic.com/en/docs/claude-code/overview

> Because the two prompt commands 2 and 3 were not executed together, a bunch of redundant GUIDE files were generated, which led to the optimizations in 4 and 5 later.

4. Judge whether @PROGRESS_TRACKING_TEMPLATE.md and @PROJECT_STRUCTURE_PHASES.md can be combined and simplified into one file, and delete unnecessary content and files.

5. Based on the two agents under @./claude/agents, check for duplicate content in @PM_AGENT_OPERATION_GUIDE.md, @PROJECT_MANAGER_AGENT_SPEC.md, and @UI_ANIMATION_QUALITY_STANDARDS.md, and delete such duplicate content or files.
and check whether the two agents under @./claude/agents are using @PROJECT_PROGRESS.md reasonably