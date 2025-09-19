import React from 'react';
import { motion } from 'framer-motion';
import { 
  RocketLaunchIcon, 
  CubeTransparentIcon, 
  EyeIcon,
  BoltIcon,
  PaintBrushIcon,
  CodeBracketIcon,
  CloudArrowDownIcon,
  ShieldCheckIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const features = [
  {
    icon: RocketLaunchIcon,
    title: 'One-Click Clone',
    description: 'Simply enter any URL and watch as our AI instantly clones the entire webpage structure.',
    color: 'text-purple-400'
  },
  {
    icon: CubeTransparentIcon,
    title: 'Perfect Elementor Format',
    description: 'Every clone is perfectly formatted for Elementor with proper sections, columns, and widgets.',
    color: 'text-blue-400'
  },
  {
    icon: EyeIcon,
    title: 'Pixel-Perfect Accuracy',
    description: 'Maintains exact layouts, spacing, typography, and styling from the original page.',
    color: 'text-cyan-400'
  },
  {
    icon: BoltIcon,
    title: 'Lightning Fast',
    description: 'Advanced AI processes pages in seconds, not minutes. Watch the magic happen in real-time.',
    color: 'text-yellow-400'
  },
  {
    icon: PaintBrushIcon,
    title: 'Fully Editable',
    description: 'Every element is fully editable in Elementor\'s drag-and-drop builder after import.',
    color: 'text-pink-400'
  },
  {
    icon: CodeBracketIcon,
    title: 'Clean Code Export',
    description: 'Generates clean, optimized Elementor JSON with no bloat or unnecessary code.',
    color: 'text-green-400'
  },
  {
    icon: CloudArrowDownIcon,
    title: 'Media Extraction',
    description: 'Automatically captures all images, backgrounds, and media from the original page.',
    color: 'text-indigo-400'
  },
  {
    icon: ShieldCheckIcon,
    title: 'Secure & Private',
    description: 'Your clones are processed securely with no data stored on our servers.',
    color: 'text-emerald-400'
  },
  {
    icon: SparklesIcon,
    title: 'AI-Powered Magic',
    description: 'Advanced AI understands page structure and converts it intelligently to Elementor.',
    color: 'text-orange-400'
  }
];

function Features() {
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
            <span className="gradient-text">Features That Amaze</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            CloneMentor Pro isn't just another cloning tool. It's a complete Elementor conversion powerhouse
            that transforms any webpage into a perfect, editable template.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group"
              >
                <div className="glass rounded-2xl p-6 h-full border border-white/5 hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:scale-105">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg glass mb-4 ${feature.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Comparison Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-20"
        >
          <div className="glass rounded-3xl p-8 md:p-12">
            <h3 className="text-3xl font-bold mb-8 text-center">
              <span className="gradient-text">Why CloneMentor Pro?</span>
            </h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xl font-semibold mb-4 text-red-400">Without CloneMentor Pro</h4>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-400">Hours of manual rebuilding in Elementor</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-400">Inaccurate layouts and missing styles</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-400">Complex code inspection and copying</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-400">Lost responsive design settings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">✗</span>
                    <span className="text-gray-400">Manual image downloads and uploads</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-xl font-semibold mb-4 text-green-400">With CloneMentor Pro</h4>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">One-click instant cloning in seconds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">Pixel-perfect accuracy guaranteed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">Direct import into Elementor</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">All responsive settings preserved</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-gray-300">Automatic media extraction included</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default Features;