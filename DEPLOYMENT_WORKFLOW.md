# Deployment Workflow for JoeyJob

## Overview
Simple, stable deployment workflow for solo development with Railway, PostgreSQL, and Redis.

## Core Principles
- `main` branch = production (always deployable)
- `staging` branch = testing environment
- Manual checks before deployment
- Database migrations tested on staging first
- Easy rollback via git

## Infrastructure Setup

### Railway Environments
1. **Production Environment**
   - Linked to `main` branch
   - Auto-deploys on push
   - Production PostgreSQL database
   - Production Redis instance

2. **Staging Environment**
   - Linked to `staging` branch
   - Auto-deploys on push
   - Separate staging PostgreSQL database (or shared with caution)
   - Separate staging Redis instance

### Environment Variables
Set these in each Railway environment:
```bash
# Auto-populated by Railway
DATABASE_URL
REDIS_URL

# Manual configuration needed
NODE_ENV=production  # or staging
BETTER_AUTH_SECRET
BETTER_AUTH_URL
SIMPRO_CLIENT_ID
SIMPRO_CLIENT_SECRET
VITE_SIMPRO_CLIENT_ID
RESEND_API_KEY
EMAIL_FROM
SUPERADMIN_ACCESS_PASSWORD
STORAGE_PATH=/storage  # Railway volume mount
```

## Development Workflow

### Daily Development Flow
```bash
# 1. Start new work
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 2. Make your changes
# ... code ...

# 3. Test locally
npm run dev
npm run typecheck
npm run lint
npm run test

# 4. Commit changes
git add .
git commit -m "feat: your feature description"

# 5. Deploy to staging
git checkout staging
git merge feature/your-feature-name
git push origin staging
# Railway auto-deploys to staging

# 6. Test on staging environment
# Visit your staging URL and test thoroughly

# 7. If everything works, deploy to production
git checkout main
git merge staging
git push origin main
# Railway auto-deploys to production

# 8. Clean up
git branch -d feature/your-feature-name
```

### Quick Hotfix Flow
```bash
# For urgent production fixes
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# Make fix
git add .
git commit -m "fix: critical bug description"

# Skip staging if truly urgent (use judgment)
git checkout main
git merge hotfix/critical-bug
git push origin main

# Update staging to match
git checkout staging
git merge main
git push origin staging
```

## Database Management

### Migration Workflow
```bash
# 1. Create migration locally
npm run db:generate

# 2. Test migration locally
npm run db:migrate

# 3. Commit migration files
git add src/database/migrations/
git commit -m "migration: description of schema change"

# 4. Deploy to staging first
git checkout staging
git merge your-branch
git push origin staging

# 5. Run migration on staging (if not automatic)
# SSH into staging or use Railway CLI
railway run npm run db:migrate

# 6. Test thoroughly on staging

# 7. Deploy to production
git checkout main
git merge staging
git push origin main

# 8. Run migration on production (if not automatic)
railway run npm run db:migrate -e production
```

### Database Backup Strategy
Before major migrations:
```bash
# Manual backup before risky migrations
railway run pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql -e production

# Railway also has automatic daily backups
# Access via Railway dashboard > PostgreSQL > Backups
```

## Pre-Deployment Checklist

### Manual Pre-Push Script
Run before pushing to staging or main:
```bash
# Create this as a package.json script
npm run pre-push

# Which runs:
npm run typecheck && npm run lint && npm run test && npm run errors:check
```

### Before Production Deployment
- [ ] All tests pass locally
- [ ] TypeScript has no errors
- [ ] Lint passes
- [ ] Tested on staging environment
- [ ] Database migrations tested on staging
- [ ] Check Railway logs for any errors
- [ ] Verify environment variables are set

## Rollback Procedures

### Application Rollback
```bash
# Quick rollback of last deployment
git checkout main
git revert HEAD
git push origin main
# Railway automatically redeploys

# Rollback to specific commit
git checkout main
git reset --hard <commit-hash>
git push origin main --force
```

### Database Rollback
```bash
# Keep rollback migrations for last 3-5 changes
# Name them clearly:
# src/database/migrations/rollback_20240915_user_table.sql

# To rollback
railway run psql $DATABASE_URL < path/to/rollback.sql -e production

# Or restore from Railway backup
# Use Railway dashboard > PostgreSQL > Backups > Restore
```

## Monitoring & Debugging

### Check Deployment Status
```bash
# View logs
railway logs -e production

# Check service status
railway status

# SSH into service (if needed)
railway shell -e production
```

### Common Issues & Solutions

**Build Failures**
- Check Railway build logs
- Verify all dependencies in package.json
- Ensure NODE_ENV is set correctly

**Migration Failures**
- Always test on staging first
- Keep rollback scripts ready
- Check for lock timeouts on large tables

**Environment Variable Issues**
- Verify all required vars in Railway dashboard
- Check for typos in variable names
- Ensure VITE_ prefix for client-side vars

## Weekly Maintenance

1. **Every Monday:**
   - Review and merge dependabot PRs
   - Check Railway usage/costs
   - Verify backups are running

2. **Before Major Features:**
   - Create database backup
   - Document rollback plan
   - Test on staging for at least 24h

## Emergency Contacts

- Railway Status: https://status.railway.app
- Railway Discord: https://discord.gg/railway
- Database Connection Issues: Check Railway dashboard first
- Redis Issues: Verify REDIS_URL in environment vars

## Future Improvements (When Needed)

Once you need more automation:
1. Add GitHub Actions for automated testing
2. Set up preview deployments for PRs
3. Add automated database backup before migrations
4. Implement blue-green deployments
5. Add error tracking (Sentry)
6. Set up uptime monitoring

---

*Last Updated: [Current Date]*
*Remember: Simple and stable beats complex and fragile*