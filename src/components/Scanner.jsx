import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownTrayIcon, CheckCircleIcon, XMarkIcon, EyeIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import Preview from './Preview';

function Scanner({ url, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('initializing');
  const [error, setError] = useState(null);
  const [template, setTemplate] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [scannedData, setScannedData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const phaseMessages = {
    initializing: 'Initializing quantum scanner...',
    connecting: 'Connecting to target website...',
    page_loaded: 'Page loaded, analyzing structure...',
    extracting_html: 'Extracting HTML elements...',
    extracting_styles: 'Capturing all styles and CSS...',
    extracting_images: 'Downloading images and media...',
    extracting_fonts: 'Detecting custom fonts...',
    analyzing_structure: 'Analyzing page structure...',
    processing_elements: 'Processing elements...',
    verifying_fidelity: 'Verifying visual fidelity...',
    verification_failed: 'Verification failed - fidelity too low',
    verification_passed: 'Verification passed! Creating template...',
    converting_to_elementor: 'Converting to Elementor format...',
    converting: 'Converting to Elementor format...',
    finalizing: 'Finalizing template...',
    complete: 'Clone complete and verified!'
  };

  useEffect(() => {
    startCloning();
  }, [url]);

  const startCloning = async () => {
    try {
      // Update the progress simulation to be more realistic and never exceed 100%
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          // Realistic progress simulation with proper clamping
          const increment = Math.random() * 2 + 1; // 1-3% increments
          const newProgress = Math.min(prev + increment, 95); // Clamp at 95% until API completes
          
          if (newProgress >= 95) {
            clearInterval(progressInterval);
          }
          return Math.round(newProgress * 10) / 10; // Round to 1 decimal place
        });
      }, 800); // Update every 800ms for smoother progress

      // Update the API progress handling to ensure proper completion
      const response = await axios.post('/api/clone/scan', { url });
      clearInterval(progressInterval);
      
      if (response.data.success) {
        const data = {
          template: response.data.template,
          elementorTemplate: response.data.template,
          html: response.data.html,
          css: response.data.css,
          pageInfo: response.data.pageInfo || {},
          visualData: response.data.visualData || {}, // CRITICAL: Include visualData for complete theme capture
          verification: response.data.verification,
          metadata: response.data.metadata || {}, // Include full metadata for template generation
          stats: {
            elements: response.data.metadata?.elementsCount || 0,
            sections: response.data.metadata?.sectionsCount || 0,
            images: response.data.metadata?.imagesCount || 0
          }
        };
        
        setTemplate(response.data.template);
        setMetadata(response.data.metadata);
        setScannedData(data);
        setProgress(100);
        setPhase('complete');
        setVerificationFailed(false);
        
        // Auto-show preview after scan completes
        setTimeout(() => {
          setShowPreview(true);
        }, 1000);
      } else if (response.data.canRetry) {
        // Handle verification failure
        const data = {
          html: response.data.html,
          pageInfo: response.data.pageInfo || {},
          verification: response.data.verification,
          stats: { elements: 0, sections: 0, images: 0 }
        };
        
        setScannedData(data);
        setProgress(Math.min(response.data.progress || 90, 95)); // On failure, don't reach 100% - show actual progress state
        setPhase('verification_failed');
        setVerificationFailed(true);
        setError(`Verification Failed (${response.data.fidelityScore}% fidelity): ${response.data.verification?.recommendation || response.data.error}`);
      } else {
        throw new Error(response.data.error || 'Cloning failed');
      }
    } catch (err) {
      console.error('Cloning error:', err);
      setError(err.message || 'Failed to clone website');
      setPhase('error');
    }
  };

  const downloadTemplate = async () => {
    if (!scannedData) return;
    
    console.log('🔍 DOWNLOAD DEBUG - Available scannedData keys:', Object.keys(scannedData));
    
    // Get the template data
    const elementorData = scannedData.template || 
                         scannedData.elementorTemplate || 
                         scannedData.visualData?.template ||
                         scannedData.metadata?.template;
    
    if (!elementorData) {
      console.error('❌ DOWNLOAD ERROR: No template data found! Available keys:', Object.keys(scannedData));
      alert('Error: No template data available for download. Please try scanning the website again.');
      return;
    }
    
    try {
      // Send template to server for validation and proper formatting
      const response = await axios.post('/api/clone/download', {
        template: elementorData,
        filename: `${(scannedData.pageInfo?.title || 'cloned-page').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-elementor-template`
      });
      
      // Create blob from validated template
      const blob = new Blob([response.data], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `${(scannedData.pageInfo?.title || 'cloned-page').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-elementor-template.json`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('✅ Downloaded validated template:', response.data.length, 'bytes');
      
    } catch (error) {
      console.error('❌ DOWNLOAD ERROR:', error);
      
      if (error.response?.status === 400) {
        // Show validation errors to user
        const errorData = error.response.data;
        alert(`❌ Template Validation Failed!\n\n${errorData.error}\n\nErrors: ${errorData.details?.errorCount || 0}\n\n${errorData.recommendation}`);
      } else {
        alert('Error downloading template. Please try again.');
      }
    }
  };

  const handleReset = () => {
    setProgress(0);
    setPhase('initializing');
    setError(null);
    setTemplate(null);
    setMetadata(null);
    setVerificationFailed(false);
    setRetryCount(0);
    onComplete();
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setProgress(0);
    setPhase('initializing');
    setError(null);
    setVerificationFailed(false);
    startCloning();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl p-8 md:p-12 relative overflow-hidden"
        >
          {/* Scanning Animation Background */}
          <div className="absolute inset-0 opacity-20">
            <motion.div
              className="absolute inset-0 scan-line"
              animate={{
                y: ['100%', '-100%']
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear'
              }}
            />
          </div>

          {/* Close Button */}
          <button
            onClick={handleReset}
            className="absolute top-4 right-4 p-2 glass rounded-lg hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>

          {/* Main Content */}
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                <span className="gradient-text">Cloning in Progress</span>
              </h2>
              <p className="text-gray-300 text-lg">
                {url}
              </p>
            </motion.div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">
                  {phaseMessages[phase] || 'Processing...'}
                </span>
                <span className="text-sm font-bold text-accent-yellow">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-4 glass rounded-full overflow-hidden">
                <motion.div
                  className="h-full gradient-bg relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  <div className="absolute inset-0 shimmer" />
                </motion.div>
              </div>
            </div>

            {/* Visual Scanner */}
            <div className="relative h-64 glass rounded-2xl overflow-hidden mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="grid grid-cols-4 gap-2 p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {[...Array(16)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-12 h-12 glass rounded"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: progress > (i * 6) ? 1 : 0,
                        opacity: progress > (i * 6) ? 1 : 0,
                        backgroundColor: progress > (i * 6) 
                          ? 'rgba(255, 193, 7, 0.3)' 
                          : 'rgba(255, 255, 255, 0.05)'
                      }}
                      transition={{
                        delay: i * 0.1,
                        duration: 0.5,
                        type: 'spring'
                      }}
                    />
                  ))}
                </motion.div>
              </div>

              {/* Scan Line Effect */}
              <motion.div
                className="absolute left-0 right-0 h-1 bg-accent-yellow/50 neon-glow-yellow"
                animate={{
                  top: ['0%', '100%']
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              />
            </div>

            {/* Status Messages */}
            <AnimatePresence mode="wait">
              {error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center"
                >
                  <div className="text-red-400 mb-4">
                    <p className="text-xl font-semibold mb-2">Cloning Failed</p>
                    <p className="text-sm">{error}</p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 glass rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Try Again
                  </button>
                </motion.div>
              ) : verificationFailed ? (
                <motion.div
                  key="verification-failed"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 mb-4"
                  >
                    <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </motion.div>
                  
                  <h3 className="text-2xl font-bold mb-2 text-red-400">
                    Verification Failed
                  </h3>
                  
                  <p className="text-gray-300 mb-6">
                    The scan didn't meet our quality standards. Fidelity score too low.
                  </p>

                  {scannedData?.verification && (
                    <div className="glass rounded-lg p-4 mb-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Overall</p>
                          <p className="text-lg font-bold text-red-400">
                            {Math.round((scannedData.verification.fidelityScore || 0) * 100)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Visual</p>
                          <p className="text-lg font-bold text-red-400">
                            {Math.round((scannedData.verification.visualScore || 0) * 100)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Structure</p>
                          <p className="text-lg font-bold text-red-400">
                            {Math.round((scannedData.verification.structuralScore || 0) * 100)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Responsive</p>
                          <p className="text-lg font-bold text-red-400">
                            {Math.round((scannedData.verification.responsiveScore || 0) * 100)}%
                          </p>
                        </div>
                      </div>
                      
                      {scannedData.verification.recommendation && (
                        <p className="text-sm text-gray-300 italic">
                          "{scannedData.verification.recommendation}"
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={handleRetry}
                      className="gradient-bg text-white px-8 py-4 rounded-lg font-semibold flex items-center gap-2 hover:shadow-lg hover:scale-105 transition-all duration-300 neon-glow"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retry Scan {retryCount > 0 && `(Attempt ${retryCount + 1})`}
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-8 py-4 glass rounded-lg hover:bg-white/10 transition-colors font-semibold"
                    >
                      Try Different URL
                    </button>
                  </div>
                </motion.div>
              ) : progress === 100 && template ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4"
                  >
                    <CheckCircleIcon className="w-12 h-12 text-green-400" />
                  </motion.div>
                  
                  <h3 className="text-2xl font-bold mb-2 gradient-text">
                    {metadata?.isValidElementor ? 'Clone Complete & Verified!' : 'Clone Complete (Needs Review)'}
                  </h3>
                  
                  <p className="text-gray-300 mb-6">
                    {metadata?.isValidElementor 
                      ? 'Your Elementor template is validated and ready for download' 
                      : 'Template generated but may need manual adjustments for Elementor'}
                  </p>

                  {/* Add validation status badge */}
                  {metadata && (
                    <div className="glass rounded-lg p-4 mb-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Validation</p>
                          <p className={`text-lg font-bold ${metadata.isValidElementor ? 'text-green-400' : 'text-yellow-400'}`}>
                            {metadata.isValidElementor ? '✅ Valid' : '⚠️ Review'}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Elements</p>
                          <p className="text-lg font-bold text-accent-yellow">{metadata.elementsCount}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Sections</p>
                          <p className="text-lg font-bold text-accent-yellow">{metadata.sectionsCount}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Size</p>
                          <p className="text-lg font-bold text-accent-yellow">{Math.round(metadata.fileSize / 1024)}KB</p>
                        </div>
                      </div>
                      
                      {metadata.validationErrors > 0 && (
                        <p className="text-sm text-yellow-400 text-center">
                          {metadata.validationErrors} validation issue(s) detected. Please review before import.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => setShowPreview(true)}
                      className="gradient-bg text-white px-8 py-4 rounded-lg font-semibold flex items-center gap-2 hover:shadow-lg hover:scale-105 transition-all duration-300 neon-glow"
                    >
                      <EyeIcon className="w-5 h-5" />
                      View Preview
                    </button>
                    <button
                      onClick={downloadTemplate}
                      className="px-8 py-4 glass rounded-lg hover:bg-white/10 transition-colors font-semibold flex items-center gap-2"
                    >
                      <ArrowDownTrayIcon className="w-5 h-5" />
                      Download Template
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-8 py-4 glass rounded-lg hover:bg-white/10 transition-colors font-semibold"
                    >
                      Clone Another
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center"
                >
                  <div className="flex gap-2">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-3 h-3 bg-accent-yellow rounded-full"
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.2
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
      
      {/* Preview Modal */}
      <Preview
        isVisible={showPreview}
        scannedData={scannedData}
        onDownload={downloadTemplate}
        onClose={() => setShowPreview(false)}
      />
    </div>
  );
}

export default Scanner;