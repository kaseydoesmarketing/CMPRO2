import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, SparklesIcon, BoltIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

function Hero({ onStartScan }) {
  const [url, setUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(true);

  const validateUrl = (urlString) => {
    try {
      const url = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    if (validateUrl(fullUrl)) {
      setIsValidUrl(true);
      onStartScan(fullUrl);
    } else {
      setIsValidUrl(false);
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
      <div className="max-w-6xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-accent-yellow/30 mb-8"
          >
            <SparklesIcon className="w-4 h-4 text-accent-yellow" />
            <span className="text-sm font-medium text-accent-yellow">Powered by Advanced AI</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-7xl font-bold mb-6"
          >
            <span className="gradient-text">CloneMentor Pro</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-300 mb-4"
          >
            Clone Any Webpage into a Perfect Elementor Template
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto"
          >
            Transform any website into a fully editable Elementor template with pixel-perfect accuracy. 
            One URL, one click, infinite possibilities.
          </motion.p>

          {/* URL Input Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onSubmit={handleSubmit}
            className="max-w-2xl mx-auto mb-12"
          >
            <div className="relative group">
              <div className="absolute -inset-1 gradient-bg rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative flex items-center glass rounded-xl p-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setIsValidUrl(true);
                  }}
                  placeholder="Enter website URL (e.g., example.com)"
                  className="flex-1 bg-transparent px-6 py-4 text-white placeholder-gray-400 focus:outline-none text-lg"
                  required
                />
                <button
                  type="submit"
                  className="gradient-bg text-white px-8 py-4 rounded-lg font-semibold flex items-center gap-2 hover:shadow-lg hover:scale-105 transition-all duration-300 neon-glow"
                >
                  Start Cloning
                  <ArrowRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            {!isValidUrl && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm mt-2"
              >
                Please enter a valid website URL
              </motion.p>
            )}
          </motion.form>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-12"
          >
            <div className="flex items-center gap-2 px-4 py-2 glass rounded-full">
              <BoltIcon className="w-4 h-4 text-accent-yellow" />
              <span className="text-sm">Lightning Fast</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 glass rounded-full">
              <ShieldCheckIcon className="w-4 h-4 text-green-400" />
              <span className="text-sm">100% Accurate</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 glass rounded-full">
              <SparklesIcon className="w-4 h-4 text-purple-400" />
              <span className="text-sm">AI-Powered</span>
            </div>
          </motion.div>

          {/* Live Demo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="relative max-w-4xl mx-auto"
          >
            <div className="glass rounded-2xl p-8 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="space-y-4">
                <div className="h-4 bg-gradient-to-r from-purple-500/20 to-transparent rounded"></div>
                <div className="h-4 bg-gradient-to-r from-blue-500/20 to-transparent rounded w-3/4"></div>
                <div className="h-4 bg-gradient-to-r from-cyan-500/20 to-transparent rounded w-1/2"></div>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="h-20 glass rounded"></div>
                  <div className="h-20 glass rounded"></div>
                  <div className="h-20 glass rounded"></div>
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-accent-yellow font-bold text-2xl shimmer"
                >
                  Watch It Build
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export default Hero;