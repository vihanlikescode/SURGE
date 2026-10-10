$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  $branch = git branch --show-current
  if ($LASTEXITCODE -ne 0 -or $branch -ne 'publish-surge-vercel-2026-10-10') {
    throw 'Switch to publish-surge-vercel-2026-10-10 before publishing.'
  }
  if (git status --porcelain) {
    throw 'Commit or discard local changes before publishing.'
  }

  git push
  if ($LASTEXITCODE -ne 0) { throw 'GitHub push failed.' }

  npx --yes --prefer-offline vercel@63.1.2 deploy --prod --yes
  if ($LASTEXITCODE -ne 0) { throw 'Vercel deployment failed.' }
} finally {
  Pop-Location
}
