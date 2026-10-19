@echo off
set PATH=C:\Users\hussi\AppData\Local\nvm\v20.18.0;%PATH%

echo ======================================================================
echo  B'S MART - EMERGENCY ROLLBACK TO LAST DEPLOYED VERSION
echo ======================================================================

git rev-parse last-deployed >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [Error] 'last-deployed' tag does not exist. Aborting rollback.
  exit /b 1
)

echo [1/4] Stashing current uncommitted changes to safety backup stash...
git stash push -u -m "pre-rollback-backup"

echo [2/4] Resetting repository to 'last-deployed' tag...
git reset --hard last-deployed

echo [3/4] Cleaning untracked build artifacts...
git clean -fd

echo [4/4] Verifying clean build of restored version...
call npm run build

if %ERRORLEVEL% EQU 0 (
  echo ======================================================================
  echo  SUCCESS: Codebase cleanly retracted to 'last-deployed'!
  echo  Any overwritten work was backed up to: git stash list
  echo ======================================================================
) else (
  echo [Warning] Rollback completed, but build verification reported issues.
)
