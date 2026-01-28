# Go Live Checklist

Complete this checklist before deploying to production.

## Pre-Launch Checklist

### Development Environment

- [ ] Local development runs without errors
- [ ] All tests pass (see TESTING.md)
- [ ] Webhook receives events successfully
- [ ] Calls place and transfer correctly
- [ ] Frontend updates in real-time
- [ ] No memory leaks observed
- [ ] Logs are clean and informative

### Code Quality

- [ ] No console.log statements in production code
- [ ] Error handling implemented everywhere
- [ ] TypeScript strict mode enabled
- [ ] No TypeScript errors
- [ ] Dependencies up to date
- [ ] Security vulnerabilities fixed (`npm audit`)

### Configuration

- [ ] Production .env file created
- [ ] All secrets rotated for production
- [ ] JWT token fresh (not expired)
- [ ] WEBHOOK_BASE_URL points to production domain
- [ ] QUEUE_E164 verified with production Call Queue
- [ ] HOLD_EXTENSION_IDS verified with production extensions
- [ ] CLIENT_URL set to production frontend URL
- [ ] NODE_ENV=production

### RingCentral Setup

- [ ] Production RingCentral account created
- [ ] Production app credentials obtained
- [ ] 6 dedicated hold line extensions provisioned
- [ ] Extensions have outbound calling enabled
- [ ] Call Queue created and configured
- [ ] Call Queue accepts transfers
- [ ] Call Queue has agents assigned
- [ ] Phone numbers assigned to queue
- [ ] Webhook subscription tested

### Infrastructure

- [ ] Production server provisioned
- [ ] Redis instance provisioned
- [ ] Database backup strategy in place
- [ ] SSL certificate installed
- [ ] Domain DNS configured
- [ ] Firewall rules configured
- [ ] Monitoring tools installed
- [ ] Log aggregation configured
- [ ] Error tracking (Sentry) configured

### Database

- [ ] Production database created
- [ ] Migrations run successfully
- [ ] Hold lines seeded
- [ ] Config values set
- [ ] Backup tested and verified
- [ ] Restore procedure documented

### Security

- [ ] Environment variables secured
- [ ] No secrets in code or git
- [ ] HTTPS enforced
- [ ] CORS restricted to production domain
- [ ] Rate limiting implemented
- [ ] Webhook signature validation added
- [ ] API authentication implemented
- [ ] Frontend authentication implemented
- [ ] Security headers configured

### Monitoring

- [ ] Health check endpoint verified
- [ ] Uptime monitoring configured
- [ ] Log monitoring configured
- [ ] Error alerting configured
- [ ] Performance monitoring configured
- [ ] Dashboard created
- [ ] Alert recipients configured
- [ ] On-call rotation established

### Documentation

- [ ] Runbook created
- [ ] Architecture diagram created
- [ ] API documentation updated
- [ ] Environment variables documented
- [ ] Deployment procedure documented
- [ ] Rollback procedure documented
- [ ] Incident response plan created
- [ ] Contact list updated

## Launch Day Checklist

### Pre-Launch (T-1 hour)

- [ ] All team members notified
- [ ] Support team on standby
- [ ] Monitoring dashboard open
- [ ] Rollback plan ready
- [ ] Communication channels open

### Deployment

- [ ] Code deployed to production
- [ ] Database migrations run
- [ ] Hold lines seeded
- [ ] Environment variables verified
- [ ] Server started
- [ ] Health check passes
- [ ] Webhook subscription created
- [ ] Frontend deployed
- [ ] DNS updated (if needed)
- [ ] SSL verified

### Smoke Tests (T+0)

- [ ] Health endpoint responds
- [ ] Frontend loads
- [ ] Socket.io connects
- [ ] Can start job via UI
- [ ] Webhook receives events
- [ ] Database writes work
- [ ] Redis connects
- [ ] Logs flowing correctly

### Validation Tests (T+15 min)

- [ ] Start full test job
- [ ] Verify 6 calls placed
- [ ] Verify staggered dialing
- [ ] Verify webhook events received
- [ ] Verify status updates in UI
- [ ] Verify LIVE detection
- [ ] Verify transfer execution
- [ ] Verify cleanup of losing legs
- [ ] Verify job marked TRANSFERRED
- [ ] Verify no errors in logs

### Monitoring (T+30 min)

- [ ] CPU usage normal (<50%)
- [ ] Memory usage normal (<500MB)
- [ ] Redis memory normal (<100MB)
- [ ] Database queries fast (<100ms)
- [ ] No error spikes
- [ ] Webhook latency acceptable
- [ ] Transfer latency <500ms
- [ ] No failed transfers

### User Acceptance (T+1 hour)

- [ ] Run 3 consecutive successful jobs
- [ ] Verify winner selection works
- [ ] Verify UI shows correct data
- [ ] Verify real-time updates work
- [ ] Test manual stop functionality
- [ ] Test starting new jobs
- [ ] Verify historical data
- [ ] Get stakeholder sign-off

## Post-Launch Checklist

### Day 1

- [ ] Monitor logs continuously
- [ ] Check error rates
- [ ] Verify webhook subscription active
- [ ] Check database growth
- [ ] Verify backups running
- [ ] Review performance metrics
- [ ] Collect user feedback
- [ ] Document any issues

### Week 1

- [ ] Review all logs
- [ ] Analyze performance trends
- [ ] Check for memory leaks
- [ ] Verify backup integrity
- [ ] Test disaster recovery
- [ ] Review error patterns
- [ ] Optimize if needed
- [ ] Update documentation

### Month 1

- [ ] Review RingCentral usage
- [ ] Analyze transfer success rate
- [ ] Check average wait times
- [ ] Review cost metrics
- [ ] Plan optimizations
- [ ] Schedule maintenance
- [ ] Update runbook
- [ ] Team retrospective

## Emergency Contacts

```
Primary On-Call: [Name] - [Phone] - [Email]
Secondary On-Call: [Name] - [Phone] - [Email]
RingCentral Support: https://support.ringcentral.com
Server Provider: [Support URL/Phone]
Database Admin: [Contact]
DevOps Lead: [Contact]
```

## Rollback Procedure

If critical issues occur:

1. **Immediate Rollback**
   ```bash
   # Stop current deployment
   pm2 stop irs-hold-hunter
   
   # Revert to previous version
   git checkout <previous-tag>
   npm run build
   pm2 start irs-hold-hunter
   ```

2. **Notify Team**
   - Post in team channel
   - Update status page
   - Inform stakeholders

3. **Investigate**
   - Collect logs
   - Review errors
   - Identify root cause

4. **Fix and Redeploy**
   - Create fix
   - Test thoroughly
   - Deploy with care

## Success Criteria

Production deployment is successful when:

✅ **Functionality**
- Jobs start without errors
- All 6 calls place successfully
- Webhooks receive all events
- LIVE detection works reliably
- Transfers complete <500ms
- Losers hang up immediately
- UI updates in real-time

✅ **Performance**
- Response time <200ms
- Transfer latency <500ms
- Zero failed transfers
- No memory leaks
- CPU usage <50%
- Database queries <100ms

✅ **Reliability**
- Zero downtime
- No error spikes
- Webhook delivery 100%
- Database connections stable
- Redis stable

✅ **User Experience**
- UI responsive
- Real-time updates work
- No delays or lag
- Clear status indicators
- Intuitive workflow

## Sign-Off

Once all checklist items complete:

**Technical Lead:** _________________ Date: _______
**Product Owner:** _________________ Date: _______
**Operations:** ____________________ Date: _______
**Security:** ______________________ Date: _______

## Notes

Use this section for any deployment-specific notes:

```
[Add notes here during deployment]
```
