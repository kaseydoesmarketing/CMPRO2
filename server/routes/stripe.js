import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

// Pricing tiers
const PRICING = {
  basic: {
    name: 'Basic',
    price: 2900, // $29.00
    credits: 50,
    features: [
      '50 page clones per month',
      'Basic support',
      'Standard processing speed'
    ]
  },
  pro: {
    name: 'Professional',
    price: 9900, // $99.00
    credits: 500,
    features: [
      '500 page clones per month',
      'Priority support',
      'Fast processing speed',
      'Advanced CSS extraction',
      'Custom fonts support'
    ]
  },
  enterprise: {
    name: 'Enterprise',
    price: 29900, // $299.00
    credits: -1, // Unlimited
    features: [
      'Unlimited page clones',
      'Dedicated support',
      'Fastest processing speed',
      'API access',
      'Custom integrations',
      'White-label options'
    ]
  }
};

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
  const { tier, successUrl, cancelUrl } = req.body;
  
  if (!PRICING[tier]) {
    return res.status(400).json({ error: 'Invalid pricing tier' });
  }
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `CloneMentor Pro - ${PRICING[tier].name}`,
              description: PRICING[tier].features.join(', ')
            },
            unit_amount: PRICING[tier].price,
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: successUrl || 'http://localhost:3000/success',
      cancel_url: cancelUrl || 'http://localhost:3000/cancel',
      metadata: {
        tier,
        credits: PRICING[tier].credits
      }
    });
    
    res.json({ sessionId: session.id, url: session.url });
    
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Webhook endpoint for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      // Handle successful payment
      console.log('Payment successful:', session.id);
      // TODO: Grant user access, update database, etc.
      break;
      
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      // Handle subscription cancellation
      console.log('Subscription cancelled:', subscription.id);
      // TODO: Revoke user access, update database, etc.
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  res.json({ received: true });
});

// Get pricing information
router.get('/pricing', (req, res) => {
  res.json(PRICING);
});

export default router;