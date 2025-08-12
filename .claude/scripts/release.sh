#!/bin/bash

# CreativeWriter2 Release Manager Script
# This script helps trigger releases using the Release Manager agent workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
REPO="MarcoDroll/creativewriter2"
RELEASE_WORKFLOW="release-merge.yml"
SYNC_WORKFLOW="sync-public.yml"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if gh CLI is installed
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) is not installed. Please install it first."
        echo "Installation: https://cli.github.com/"
        exit 1
    fi
    
    # Check if user is authenticated
    if ! gh auth status &> /dev/null; then
        log_error "Not authenticated with GitHub CLI. Please run 'gh auth login' first."
        exit 1
    fi
}

# Validate repository access
validate_repo_access() {
    log_info "Validating repository access..."
    if ! gh repo view "$REPO" &> /dev/null; then
        log_error "Cannot access repository $REPO. Check permissions."
        exit 1
    fi
    log_success "Repository access validated"
}

# Run pre-release checks
pre_release_checks() {
    log_info "Running pre-release checks..."
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "angular.json" ]; then
        log_error "Not in CreativeWriter2 project directory"
        exit 1
    fi
    
    # Check git status
    if [ -n "$(git status --porcelain)" ]; then
        log_warning "You have uncommitted changes. Consider committing them first."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Release cancelled"
            exit 0
        fi
    fi
    
    log_success "Pre-release checks completed"
}

# Show current status
show_status() {
    echo
    log_info "Current Status:"
    echo "Repository: $REPO"
    echo "Current branch: $(git branch --show-current)"
    echo "Latest commit: $(git log -1 --oneline)"
    
    # Check current version
    if [ -f "package.json" ]; then
        VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
        echo "Current version: $VERSION"
    fi
    
    echo
}

# Trigger standard release
trigger_release() {
    log_info "Triggering standard release workflow..."
    
    if gh workflow run "$RELEASE_WORKFLOW" --repo "$REPO"; then
        log_success "Release workflow triggered successfully"
        log_info "Monitor progress: gh run list --workflow=$RELEASE_WORKFLOW --repo=$REPO"
    else
        log_error "Failed to trigger release workflow"
        exit 1
    fi
}

# Trigger emergency release
trigger_emergency_release() {
    log_warning "Triggering EMERGENCY release (skips quality checks)..."
    read -p "Are you sure? This skips all safety checks! (type 'EMERGENCY' to confirm): "
    
    if [ "$REPLY" = "EMERGENCY" ]; then
        if gh workflow run "$RELEASE_WORKFLOW" --repo "$REPO" -f merge_type=force -f skip_checks=true; then
            log_success "Emergency release triggered"
        else
            log_error "Failed to trigger emergency release"
            exit 1
        fi
    else
        log_info "Emergency release cancelled"
        exit 0
    fi
}

# Trigger manual sync
trigger_sync() {
    log_info "Triggering manual sync to public repository..."
    
    if gh workflow run "$SYNC_WORKFLOW" --repo "$REPO"; then
        log_success "Public sync triggered successfully"
        log_info "Monitor progress: gh run list --workflow=$SYNC_WORKFLOW --repo=$REPO"
    else
        log_error "Failed to trigger sync workflow"
        exit 1
    fi
}

# Monitor workflows
monitor_workflows() {
    echo
    log_info "Recent workflow runs:"
    echo
    gh run list --repo "$REPO" --limit 10
}

# Show help
show_help() {
    cat << EOF
CreativeWriter2 Release Manager

Usage: $0 [command] [options]

Commands:
    release     Trigger standard release workflow
    emergency   Trigger emergency release (skips quality checks)
    sync        Manually trigger sync to public repository
    status      Show current repository status
    monitor     Show recent workflow runs
    help        Show this help message

Examples:
    $0 release          # Standard release
    $0 emergency        # Emergency release
    $0 sync             # Manual sync
    $0 status           # Check current status
    $0 monitor          # View workflow runs

The release process:
1. Standard release merges main -> release with quality checks
2. Release branch triggers automatic sync to public repository
3. Public repository creates release and builds Docker images

For emergency releases, quality checks are bypassed - use carefully!

EOF
}

# Main script logic
main() {
    check_gh_cli
    
    case "${1:-help}" in
        "release")
            validate_repo_access
            show_status
            pre_release_checks
            trigger_release
            ;;
        "emergency")
            validate_repo_access
            show_status
            trigger_emergency_release
            ;;
        "sync")
            validate_repo_access
            trigger_sync
            ;;
        "status")
            show_status
            ;;
        "monitor")
            validate_repo_access
            monitor_workflows
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function with all arguments
main "$@"