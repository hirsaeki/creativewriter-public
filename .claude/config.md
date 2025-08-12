# Claude Agent Configuration for CreativeWriter2

## Overview
This directory contains specialized Claude agent configurations for managing different aspects of the CreativeWriter2 project. Each agent is designed to handle specific workflows and responsibilities.

## Available Agents

### 🚀 Release Manager (`agents/release-manager.md`)
**Purpose**: Orchestrate releases, sync to public repository, and maintain release documentation.

**Key Responsibilities**:
- Trigger sync-to-public workflow
- Update release notes automatically
- Maintain README when needed
- Handle emergency releases
- Monitor release workflows

**Usage**: 
```bash
# Use the helper script
./.claude/scripts/release.sh release

# Or invoke the agent directly in Claude Code with:
# "I need to trigger a release using the release manager agent"
```

## Agent Invocation Guide

### Using Claude Code
To use these agents in Claude Code, reference them explicitly:

```
"Use the release-manager agent to trigger a release to the public repository"
```

### Using Helper Scripts
Each agent may have associated helper scripts in the `scripts/` directory:

```bash
# Release management
./.claude/scripts/release.sh [command]
```

## Directory Structure
```
.claude/
├── config.md                    # This file - main configuration
├── agents/                      # Specialized agent configurations
│   └── release-manager.md       # Release management agent
└── scripts/                     # Helper scripts for agents
    └── release.sh               # Release management script
```

## Agent Development Guidelines

### Creating New Agents
When creating new specialized agents:

1. **Purpose Definition**: Clearly define the agent's role and responsibilities
2. **Workflow Integration**: Document how it integrates with existing workflows
3. **Command Reference**: Provide clear command examples and usage patterns
4. **Error Handling**: Include troubleshooting and error resolution steps
5. **Best Practices**: Document recommended approaches and safety measures

### Agent Configuration Format
Each agent configuration should include:

- **Agent Purpose**: Clear description of the agent's role
- **Core Responsibilities**: List of primary tasks
- **Workflow Process**: Step-by-step process documentation
- **Commands Reference**: Practical command examples
- **Error Handling**: Common issues and solutions
- **Integration Points**: How it connects with other systems
- **Best Practices**: Recommended usage patterns

## Integration with GitHub Workflows

The agents are designed to work seamlessly with the existing GitHub Actions workflows:

- **release-merge.yml**: Automated merging with quality gates
- **sync-public.yml**: Public repository synchronization
- **docker-build.yml**: Multi-architecture Docker image builds
- **ci-main.yml**: Continuous integration pipeline

## Security Considerations

- **Token Management**: Agents use GitHub tokens with appropriate scopes
- **Workflow Permissions**: Each workflow has minimal required permissions
- **Emergency Procedures**: Emergency releases bypass quality checks with explicit confirmation
- **Access Control**: Repository access is validated before operations

## Monitoring and Logging

Agents integrate with GitHub Actions for monitoring:

- **Workflow Status**: Real-time status monitoring
- **Build Logs**: Detailed logging for troubleshooting
- **Release Tracking**: Automated release note generation
- **Error Reporting**: Automated issue creation for failures

## Usage Examples

### Standard Release Process
```bash
# 1. Trigger release
./.claude/scripts/release.sh release

# 2. Monitor progress
./.claude/scripts/release.sh monitor

# 3. Verify public release
gh release list --repo MarcoDroll/creativewriter-public
```

### Emergency Release Process
```bash
# Emergency release (use with caution)
./.claude/scripts/release.sh emergency
```

## Support and Troubleshooting

### Common Issues
1. **Authentication**: Ensure GitHub CLI is authenticated
2. **Permissions**: Verify repository access tokens
3. **Branch State**: Check that main branch is ready for release
4. **Workflow Failures**: Monitor GitHub Actions logs

### Getting Help
- Check agent-specific documentation in `agents/` directory
- Review GitHub Actions workflow logs
- Use helper scripts for guided operations
- Refer to error handling sections in agent configs

---

## Extending the System

To add new agents:

1. Create agent config in `agents/[name].md`
2. Add helper script in `scripts/[name].sh` (optional)
3. Update this config.md with agent description
4. Test agent functionality thoroughly
5. Document integration points and usage patterns

Remember: Agents should be focused, well-documented, and integrate smoothly with existing workflows.