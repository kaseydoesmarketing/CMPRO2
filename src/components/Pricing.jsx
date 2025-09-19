import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';

const plans = [
  {
    name: 'Basic',
    price: 29,
    period: 'month',
    credits: 50,
    features: [
      '50 page clones per month',
      'Standard processing speed',
      'Basic support via email',
      'Elementor JSON export',
      'Desktop layouts only',
      'Community access'
    ],
    cta: 'Coming Soon',
    popular: false,
    color: 'from-gray-600 to-gray-700'
  },
  {
    name: 'Professional',
    price: 99,
    period: 'month',
    credits: 500,
    features: [
      '500 page clones per month',
      'Lightning fast processing',
      'Priority support',
      'Advanced CSS extraction',
      'All responsive breakpoints',
      'Custom fonts support',
      'Background images included',
      'Form detection & conversion',
      'Private Discord access'
    ],
    cta: 'Coming Soon',
    popular: true,
    color: 'from-purple-600 to-blue-600'
  },
  {
    name: 'Enterprise',
    price: 299,
    period: 'month',
    credits: -1,
    features: [
      'Unlimited page clones',
      'Fastest processing speed',
      'Dedicated support team',
      'API access included',
      'Custom integrations',
      'White-label options',
      'Bulk cloning tools',
      'Advanced animations',
      'Priority feature requests',
      'SLA guarantee'
    ],
    cta: 'Contact Sales',
    popular: false,
    color: 'from-blue-600 to-cyan-600'
  }
];

function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState('monthly');

  return (
    <section className="relative py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="gradient-text">Simple, Transparent Pricing</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Choose the perfect plan for your needs. Upgrade or downgrade anytime.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 glass rounded-full p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full transition-all duration-300 ${
                billingPeriod === 'monthly' 
                  ? 'gradient-bg text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-full transition-all duration-300 flex items-center gap-2 ${
                billingPeriod === 'yearly' 
                  ? 'gradient-bg text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="text-xs bg-accent-yellow/20 text-accent-yellow px-2 py-1 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => {
            const yearlyPrice = Math.round(plan.price * 12 * 0.8);
            const displayPrice = billingPeriod === 'monthly' ? plan.price : Math.round(yearlyPrice / 12);
            
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <div className="bg-accent-yellow text-black px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                      <SparklesIcon className="w-4 h-4" />
                      MOST POPULAR
                    </div>
                  </div>
                )}

                <div className={`glass rounded-3xl p-8 h-full border ${
                  plan.popular 
                    ? 'border-accent-yellow/50 shadow-2xl shadow-accent-yellow/20' 
                    : 'border-white/10'
                } hover:border-white/30 transition-all duration-300`}>
                  
                  {/* Plan Header */}
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold gradient-text">${displayPrice}</span>
                      <span className="text-gray-400">/{billingPeriod === 'monthly' ? 'mo' : 'mo'}</span>
                    </div>
                    {billingPeriod === 'yearly' && (
                      <p className="text-sm text-gray-400 mt-2">
                        Billed ${yearlyPrice} yearly
                      </p>
                    )}
                    <p className="text-gray-400 mt-4">
                      {plan.credits === -1 
                        ? 'Unlimited clones'
                        : `${plan.credits} clones per month`
                      }
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckIcon className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    className={`w-full py-3 rounded-lg font-semibold transition-all duration-300 ${
                      plan.popular
                        ? 'gradient-bg text-white hover:shadow-lg hover:scale-105 neon-glow'
                        : 'glass hover:bg-white/10'
                    }`}
                    disabled={plan.cta === 'Coming Soon'}
                  >
                    {plan.cta}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-20"
        >
          <div className="glass rounded-3xl p-8 md:p-12">
            <h3 className="text-3xl font-bold mb-8 text-center">
              <span className="gradient-text">Frequently Asked Questions</span>
            </h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold mb-2">How does CloneMentor Pro work?</h4>
                <p className="text-gray-400">
                  Simply enter any website URL, and our AI-powered engine scans the page, 
                  extracts all elements, styles, and media, then converts everything into 
                  a perfect Elementor-compatible JSON template file.
                </p>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold mb-2">Is it compatible with all Elementor versions?</h4>
                <p className="text-gray-400">
                  Yes! Our templates are compatible with Elementor 3.0+ and Elementor Pro. 
                  The generated JSON follows Elementor's official template format specifications.
                </p>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold mb-2">Can I edit the cloned templates?</h4>
                <p className="text-gray-400">
                  Absolutely! Every element in the cloned template is fully editable using 
                  Elementor's drag-and-drop builder. You can modify text, images, colors, 
                  layouts, and everything else.
                </p>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold mb-2">What about copyrighted content?</h4>
                <p className="text-gray-400">
                  CloneMentor Pro is a tool for legitimate use cases like redesigning your 
                  own sites or creating templates. Users are responsible for respecting 
                  copyright laws and obtaining necessary permissions.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default Pricing;