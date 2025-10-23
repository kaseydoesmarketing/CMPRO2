# Stripe Integration - Future Implementation Tasks

## Current State
The Stripe integration is partially implemented with the following components ready:
- Checkout session creation
- Webhook endpoint structure
- Pricing tiers configuration
- Event handling framework

## TODO Items for Database Integration

### 1. Database Schema Required
When implementing database support, create the following tables:
```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  stripe_subscription_id VARCHAR(255),
  tier VARCHAR(50),
  credits_remaining INTEGER,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clone history table
CREATE TABLE clone_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  url TEXT,
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Webhook Implementation Tasks

#### `checkout.session.completed` Event (Line 113)
```javascript
// TODO: Implement these actions
// 1. Extract customer email from session
// 2. Create or update user in database
// 3. Store stripe_customer_id
// 4. Create subscription record with initial credits
// 5. Send welcome email
// 6. Log transaction for audit
```

#### `customer.subscription.deleted` Event (Line 120)
```javascript
// TODO: Implement these actions
// 1. Find user by stripe_customer_id
// 2. Update subscription status to 'cancelled'
// 3. Set credits_remaining to 0
// 4. Send cancellation confirmation email
// 5. Log event for retention analysis
```

### 3. Additional Webhook Events to Handle
```javascript
// Add these event handlers:
case 'customer.subscription.updated':
  // Handle plan upgrades/downgrades
  // Adjust credits accordingly
  break;

case 'invoice.payment_failed':
  // Handle failed payments
  // Send warning email
  // Temporarily suspend access after X failures
  break;

case 'customer.subscription.trial_will_end':
  // Send reminder email 3 days before trial ends
  break;
```

### 4. API Endpoints to Implement

```javascript
// Get user's subscription status
router.get('/subscription/:userId', async (req, res) => {
  // Query database for user's subscription
  // Return tier, credits, status
});

// Check and deduct credits
router.post('/use-credit', async (req, res) => {
  // Verify user has credits
  // Deduct credit
  // Log usage
  // Return remaining credits
});

// Get usage history
router.get('/usage/:userId', async (req, res) => {
  // Query clone_history table
  // Return paginated results
});
```

### 5. Environment Variables Needed
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/clonementor

# Email Service (for notifications)
SENDGRID_API_KEY=sg_...
EMAIL_FROM=noreply@clonementor.pro

# Redis (for session management)
REDIS_URL=redis://localhost:6379
```

### 6. Security Considerations
- Always verify webhook signatures
- Implement idempotency for webhook processing
- Use database transactions for credit operations
- Add rate limiting to prevent abuse
- Implement proper session management
- Add CSRF protection for payment forms

### 7. Testing Requirements
- Mock Stripe webhook events for testing
- Test credit deduction logic thoroughly
- Verify subscription state transitions
- Test edge cases (expired cards, insufficient funds)
- Load test webhook endpoint

## Implementation Priority
1. **Phase 1**: Basic database integration (users, subscriptions)
2. **Phase 2**: Credit system implementation
3. **Phase 3**: Email notifications
4. **Phase 4**: Advanced analytics and reporting
5. **Phase 5**: Admin dashboard for subscription management

## Notes
- The current implementation uses placeholder Stripe keys
- Webhook secret must be configured in production
- Consider implementing Stripe Customer Portal for self-service
- Add monitoring for failed webhook deliveries
- Implement retry logic for critical operations