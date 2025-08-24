---
description: "Action: Perform repository cleanup, security checks, and safe commit/push to GitHub. (Tailored for this repo)"
labels:
  - cleanup
  - security
  - safe-commit
  - push
---

## Scope
Repository cleanup and secure push after completing:
* **Development Phase**: Initial coding, experimentation, debugging
* **File Management**: Organizing project files, removing temporary artifacts
* **Security Audit**: Checking for sensitive data, API keys, personal information
* **Documentation**: Updating project documentation, README files

## Objective
Safely clean up the repository and push changes to GitHub while ensuring:
* **Clean Repository History**: No unnecessary files, logs, or temporary artifacts
* **Security Compliance**: No sensitive data, API keys, or personal information exposed
* **Proper Archiving**: Unused files moved to `archive/` and ignored
* **Clear Documentation**: Cleanup process and changes properly recorded
* **Repo Convention**: `dist/` is kept tracked for easy Load Unpacked

## Process

### 1. Pre-Cleanup Preparation (2 minutes)
1. **Check Current Git Status**:
   ```bash
   git status
   # Review current files and untracked changes
   ```

2. **Identify Files to Archive** (tailored):
   ```bash
   find . \
     \( -path './.git/*' -o -path './node_modules/*' -o -path './archive/*' -o -path './dist/*' \) -prune -o \
     -type f \( -name '*.log' -o -name '*.tmp' -o -name 'test_*' -o -name 'draft_*' -o -name '.env.local' -o -name 'metadata.json' \) -print
   # List files that will be archived
   ```

### 2. Repository Cleanup (5 minutes)
1. **Create Archive Directory**:
   ```bash
   mkdir -p archive
   ```

2. **Move Unnecessary Files to Archive** (ignore if not present):
   ```bash
   mv *.log *.tmp test_* draft_* archive/ 2>/dev/null || true
   [ -f .env.local ] && mv .env.local archive/ || true
   [ -f metadata.json ] && mv metadata.json archive/ || true
   ```

3. **Update .gitignore File (idempotent)**:
   ```bash
   grep -qxF 'archive/' .gitignore || echo 'archive/' >> .gitignore
   grep -qxF '*.log' .gitignore || echo '*.log' >> .gitignore
   grep -qxF '*.tmp' .gitignore || echo '*.tmp' >> .gitignore
   grep -qxF 'test_*' .gitignore || echo 'test_*' >> .gitignore
   grep -qxF 'draft_*' .gitignore || echo 'draft_*' >> .gitignore
   # Note: do NOT add 'dist/' (we keep dist tracked)
   ```

### 3. Security Audit (5 minutes)
1. **Scan for Sensitive Data** (exclude common build/vendor dirs):
   ```bash
   grep -rE '(api[_-]?key|token|password|secret|private[_-]?key|access[_-]?token)' . \
     --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=archive --exclude-dir=dist || true
   # Search for common sensitive data patterns
   ```

2. **Handle Findings**:
   - If sensitive data is found:
     - Remove the data from the files
     - Rotate/revoke keys if applicable
     - Update environment configurations
     - Commit these changes separately with a security-focused message

3. **Verify Package Dependencies** (optional, requires network):
   ```bash
   npm audit
   # Check for vulnerable dependencies
   ```

### 4. Pre-Commit Verification (3 minutes)
1. **Test Core Functionality**:
   ```bash
   npm run build
   # Ensure build completes successfully
   ```

2. **Review Git Status**:
   ```bash
   git status
   # Review all modified and new files
   # Ensure no unintended changes
   ```

3. **Examine Changes**:
   ```bash
   git diff --stat
   # Summary of changes
   git diff
   # Detailed changes
   ```

### 5. Stage and Commit (2 minutes)
1. **Stage Changes**:
   ```bash
   git add .
   # OR specific files:
   # git add .gitignore archive/
   ```

2. **Create Commit Message** (Conventional):
   ```
   <type>(scope): <description> [optional body]
   ```
   **Common Types**: `chore`, `fix`, `docs`, `refactor`

   **Examples**:
   ```bash
   git commit -m "chore(repo): archive temporary files and update .gitignore"
   git commit -m "chore(security): remove sensitive data patterns"
   git commit -m "docs: update repository cleanup guide"
   ```

### 6. Push to GitHub (1 minute)
1. **Push Changes**:
   ```bash
   git push -u origin main   # use -u on first push
   ```

2. **Handle Issues**:
   ```bash
   # If remote has changes:
   git pull origin main --rebase
   git push origin main
   ```

### 7. Post-Push Documentation (2 minutes)
1. **Update README or Documentation**:
   ```markdown
   ## Recent Maintenance
   - [x] Archive temporary files and logs ✅ <YYYY-MM-DD>
   - [x] Update .gitignore patterns ✅ <YYYY-MM-DD>
   - [x] Security audit for sensitive data ✅ <YYYY-MM-DD>
   ```

2. **Add Maintenance Note**:
   ```markdown
   ## Repository Maintenance
   - <YYYY-MM-DD>: Performed repository cleanup and security audit
   ```

3. **Tag Release (optional)**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

## Security Best Practices

### Sensitive Data Prevention
- **Environment Variables**: Store all sensitive data in environment variables
- **Secrets Management**: Use proper secrets storage for CI/CD
- **Regular Audits**: Perform security scans before pushing and at release time

### File Management
- **.gitignore Maintenance**: Keep `.gitignore` updated with temporary and generated files
- **Archive Strategy**: Regularly archive, don’t delete experimental work
- **Clean Commits**: Keep each commit focused on a single logical change

## Checklists

### Pre-Cleanup Checklist
- [ ] Review current repository contents
- [ ] Identify temporary or unnecessary files
- [ ] Check for existing sensitive data
- [ ] Verify build process works

### Pre-Commit Checklist
- [ ] `npm run build` completes without errors
- [ ] Core functionality works correctly
- [ ] No console errors in development
- [ ] Security scan completed with no findings
- [ ] `.gitignore` updated appropriately
- [ ] `archive/` contains only intended files

## Timeline
- **Pre-Cleanup Preparation**: 2 minutes
- **Repository Cleanup**: 5 minutes
- **Security Audit**: 5 minutes
- **Pre-Commit Testing**: 3 minutes
- **Review and Stage**: 2 minutes
- **Commit**: 1 minute
- **Push**: 1 minute
- **Documentation**: 2 minutes
- **Total**: 21 minutes
