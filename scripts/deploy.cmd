@echo off
set PATH=C:\Users\hussi\AppData\Local\nvm\v20.18.0;%PATH%
echo Building and Deploying B's Mart to Cloudflare Pages (project: bs-mart)...
call npm run build
call npx wrangler pages deploy out --project-name=bs-mart --branch=main
if %ERRORLEVEL% EQU 0 (
  git tag -f last-deployed -m "Deployed B's Mart to Cloudflare Pages on %date% %time%"
  echo [Safety] Updated 'last-deployed' tag to current commit.
  echo Deployment Complete!
) else (
  echo [Error] Deployment failed. 'last-deployed' tag was preserved at previous state.
  exit /b %ERRORLEVEL%
)
