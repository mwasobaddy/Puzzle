import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { FaCrown, FaCheck, FaGamepad, FaTrophy, FaStar } from 'react-icons/fa';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { GiPuzzle, GiLevelThree, GiLevelEndFlag } from 'react-icons/gi';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const db = getFirestore();

const functions = getFunctions();

const planIcons = {
  free: GiPuzzle,
  basic: GiLevelThree,
  advanced: GiLevelEndFlag,
};

const plans = [
  {
    id: 'free',
    name: 'Novice Explorer',
    level: 'Level 1',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      'Leaderboard integrated',
      'Sharing on social media',
      '2 pre-designed puzzles/month',
      '1 custom puzzle/month',
    ],
    color: 'gray',
    icon: GiPuzzle,
  },
  {
    id: 'basic',
    name: 'Puzzle Master',
    level: 'Level 2',
    monthlyPrice: 4.99,
    annualPrice: 49.99,
    features: [
      'Leaderboard integrated',
      'Sharing on social media',
      'All pre-designed puzzles',
      'Unlimited custom puzzles',
    ],
    color: 'blue',
    popular: true,
    icon: GiLevelThree,
  },
  {
    id: 'advanced',
    name: 'Legend Champion',
    level: 'Level MAX',
    monthlyPrice: 9.99,
    annualPrice: 99.99,
    features: [
      'Leaderboard integrated',
      'Sharing on social media',
      'All pre-designed puzzles',
      'Unlimited custom puzzles',
      'Multiplayer access',
      'Unlimited Multiplayer sessions',
    ],
    color: 'purple',
    icon: GiLevelEndFlag,
  },
];

const PaymentPlans = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const navigate = useNavigate();

  const getCurrentPrice = (plan) => {
    return billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
  };

  const handleStripePayment = async (planId) => {
    setLoading(true);
    try {
      const stripe = await stripePromise;

      const createCheckoutSession = httpsCallable(
        functions,
        'ext-firestore-stripe-payments-createCheckoutSession'
      );

      const plan = plans.find((p) => p.id === planId);

      const result = await createCheckoutSession({
        price: plan.price * 100,
        success_url: `${window.location.origin}/payment-success`,
        cancel_url: `${window.location.origin}/payment-canceled`,
        mode: 'payment',
        metadata: {
          planId,
        },
      });

      const { error } = await stripe.redirectToCheckout({
        sessionId: result.data.sessionId,
      });

      if (error) {
        toast.error(error.message);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayPalPayment = async (plan) => {
    return {
      createOrder: async (data, actions) => {
        return actions.order.create({
          purchase_units: [
            {
              amount: {
                value: plan.price.toString(),
                currency_code: 'USD',
              },
              description: `${plan.name} Plan Subscription`,
            },
          ],
        });
      },
      onApprove: async (data, actions) => {
        const order = await actions.order.capture();
        await handleSuccessfulPayment(plan.id, 'paypal', order.id);
        toast.success('Payment successful!');
        navigate('/payment-success');
      },
      onError: (err) => {
        console.error('PayPal error:', err);
        toast.error('Payment failed. Please try again.');
      },
    };
  };

  const handleSuccessfulPayment = async (planId, provider, transactionId) => {
    try {
      await setDoc(doc(db, 'subscriptions', user.uid), {
        planId,
        provider,
        transactionId,
        startDate: new Date().toISOString(),
        status: 'active',
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
    }
  };

  return (
    <div className="min-h-screen py-12 bg-gradient-to-b from-gray-900 to-gray-800 px-4">
      <style jsx>{`
        .game-card {
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }
        
        .game-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 0 30px rgba(var(--color-primary), 0.5);
        }
        
        .pixel-border {
          clip-path: polygon(
            0 10px,
            10px 0,
            calc(100% - 10px) 0,
            100% 10px,
            100% calc(100% - 10px),
            calc(100% - 10px) 100%,
            10px 100%,
            0 calc(100% - 10px)
          );
        }
        
        @media (max-width: 640px) {
          .game-card {
            margin-bottom: 2rem;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-4">
            Choose Your Adventure Level
          </h2>
          <p className="text-xl text-gray-300">
            Level up your puzzle experience with premium powers
          </p>

          <div className="mt-8 inline-flex items-center p-2 rounded-lg bg-gray-800 border border-gray-700">
            <span
              className={`px-4 py-2 rounded cursor-pointer transition-all ${billingCycle === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400'
                }`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly Quest
            </span>
            <span
              className={`px-4 py-2 rounded cursor-pointer transition-all ${billingCycle === 'annual'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400'
                }`}
              onClick={() => setBillingCycle('annual')}
            >
              Yearly Saga
            </span>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`game-card pixel-border bg-gray-800 bg-opacity-80 rounded-lg p-6 relative ${plan.popular ? 'border-blue-500 border-2' : 'border-gray-700'
                }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                  MOST POPULAR
                </div>
              )}

              <div className="flex items-center justify-center mb-6">
                <plan.icon className={`w-16 h-16 text-${plan.color}-400`} />
              </div>

              <h3 className="text-2xl font-bold text-white text-center mb-2">
                {plan.name}
              </h3>
              <p className={`text-${plan.color}-400 text-center mb-6`}>
                {plan.level}
              </p>

              <div className="text-center mb-6">
                <span className="text-5xl font-bold text-white">
                  €{getCurrentPrice(plan).toFixed(2)}
                </span>
                <span className="text-gray-400">
                  /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                </span>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-center text-gray-300 space-x-2"
                  >
                    <FaStar className={`text-${plan.color}-400 flex-shrink-0`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.id !== 'free' && (
                <div className="mt-auto">
                  <PayPalButtons
                    className="w-full"
                    style={{
                      layout: 'horizontal',
                      color: 'blue',
                      shape: 'rect',
                      label: 'pay',
                    }}
                  />
                </div>
              )}

              {plan.id === 'free' && (
                <button
                  className="w-full py-3 px-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-500 hover:to-gray-600 transition-all duration-200"
                >
                  Start Free
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaymentPlans;