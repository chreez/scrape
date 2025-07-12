# Claude Development Rules for Scrape Repository

## Git Commit Structure
- **Commit Size**: Keep commits under 300 lines of changes
- **Commit Messages**: Use conventional commit format:
  ```
  type(scope): description
  
  Detailed explanation if needed
  
  🤖 Generated with [Claude Code](https://claude.ai/code)
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- **Types**: feat, fix, docs, refactor, test, chore
- **Auto-push**: Push each commit immediately after creation

## Workspace Cleanliness
- **No Test Files**: Remove all temporary test files after each iteration
- **Clean Output**: Delete generated output files (*.json, scrape-output/*)
- **Organized Structure**: Maintain clean directory structure
- **No Build Artifacts**: Remove node_modules, package-lock.json from commits

## File Organization
```
scrape/
├── bin/                 # NPX executable
├── src/                 # Core framework
│   ├── adapters/        # Platform-specific logic
│   ├── context/         # Context file generators
│   ├── extractors/      # Data extraction engines
│   ├── navigation/      # Navigation strategies
│   ├── orchestrator/    # Task management
│   └── stealth/         # Anti-detection
├── config/              # Platform configurations
├── docs/                # Documentation
└── examples/            # Usage examples
```

## Development Workflow
1. **Before Changes**: Clean workspace of test files
2. **During Development**: Keep iterations small and focused
3. **After Changes**: 
   - Clean up test files
   - Verify workspace is neat
   - Commit with proper message
   - Push immediately

## Testing Guidelines
- **Temporary Files**: Use `/tmp/` or `./temp/` for test outputs
- **Cleanup**: Always remove test files before committing
- **Examples**: Keep real examples in `examples/` directory only

## Commit Frequency
- **Small Changes**: Commit every 50-100 lines
- **Feature Complete**: Commit when feature is working
- **Bug Fixes**: Commit immediately after fix
- **Documentation**: Separate commits for doc updates

## Prohibited in Commits
- Test output files (*.json in root)
- Temporary directories (scrape-output/, temp/, tmp/)
- Debug logs or console.log additions
- Commented-out code blocks
- Package lock files (already in .gitignore)

## Quality Gates
Before each commit:
- [ ] Workspace is clean
- [ ] No test files remaining
- [ ] Code follows existing patterns
- [ ] Commit message is clear
- [ ] Changes are under 300 lines
- [ ] Ready to push immediately