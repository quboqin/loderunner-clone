# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based Lode Runner clone built using Phaser.js game engine. The project aims to recreate the classic Lode Runner gameplay in a modern web browser environment.

**Key References:**
- Game engine: [Phaser.js](https://docs.phaser.io/phaser/getting-started/what-is-phaser)
- Assets and level data reference: https://github.com/quboqin/Lode-Runner-Roku

## Development Setup

Since this project uses Phaser.js for web development, typical commands will include:

```bash
# Install dependencies
npm install

# Start development server  
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Architecture Guidelines

### Game Structure
- **Phaser.js Framework**: Modern HTML5 game framework for 2D games
- **Level System**: Reference the Roku implementation for level data structures and design patterns
- **Asset Management**: Sprites, animations, and audio from the referenced repository
- **Web Browser Target**: Designed to run in modern web browsers

### Key Components (To Be Implemented)
- Game engine initialization and configuration
- Level loading and rendering system
- Player character movement and physics
- Guard AI and behavior patterns
- Gold collection and scoring system
- Hole digging mechanics
- Sound and music integration

## Development Notes

- Follow Phaser.js best practices and patterns
- Implement responsive design for different screen sizes
- Ensure cross-browser compatibility
- Use modern JavaScript/TypeScript features as appropriate
- Structure code for maintainability and extensibility

## Asset Integration

When integrating assets from the reference repository:
- Maintain proper attribution
- Ensure sprite sheets are optimized for web delivery
- Implement efficient asset loading strategies
- Consider audio format compatibility across browsers

## Project Management

- **Progress Tracking**: Use `PROJECT_PROGRESS.md` for development phase tracking and task management
- **Sub-Agents**: Project Manager Agent and UX/Animation Specialist available in `.claude/agents/`
- **Development Phases**: 9-phase structure from foundation through Vercel deployment

## Deployment Notes

- Deploy this game onto Vercel

## Claude Interaction Guidelines

- Every time you finish modifying a feature, confirm with me first and don't submit the code immediately.