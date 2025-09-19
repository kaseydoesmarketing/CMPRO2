import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Hero from './components/Hero';
import Scanner from './components/Scanner';
import Features from './components/Features';
import Pricing from './components/Pricing';
import Footer from './components/Footer';

function App() {
  const [scanningUrl, setScanningUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleStartScan = (url) => {
    setScanningUrl(url);
    setIsScanning(true);
  };

  const handleScanComplete = () => {
    setIsScanning(false);
  };

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="relative">
        {/* Background Effects */}
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950" />
          <div className="absolute inset-0 matrix-bg opacity-30" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl opacity-10 animate-float" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl opacity-10 animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full filter blur-3xl animate-pulse-glow" />
        </div>

        <AnimatePresence mode="wait">
          {isScanning ? (
            <Scanner 
              url={scanningUrl}
              onComplete={handleScanComplete}
              key="scanner"
            />
          ) : (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Hero onStartScan={handleStartScan} />
              <Features />
              <Pricing />
              <Footer />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;