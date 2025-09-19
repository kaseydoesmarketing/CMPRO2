import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Preview.css';

const Preview = ({ isVisible, scannedData, onDownload, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [previewHTML, setPreviewHTML] = useState('');

  useEffect(() => {
    if (isVisible && scannedData) {
      // Simulate loading the preview
      setIsLoading(true);
      
      setTimeout(() => {
        // Generate preview HTML from scanned data
        const html = generatePreviewHTML(scannedData);
        setPreviewHTML(html);
        setIsLoading(false);
      }, 1500);
    }
  }, [isVisible, scannedData]);

  const generatePreviewHTML = (data) => {
    // CRITICAL FIX: Check for HTML in multiple possible locations
    let html = null;
    
    if (data?.html) {
      html = data.html;
      console.log('✅ Found HTML in data.html');
    } else if (data?.visualStructure?.completeHTML) {
      html = data.visualStructure.completeHTML;
      console.log('✅ Found HTML in data.visualStructure.completeHTML');
    } else if (data?.responsiveLayouts?.desktop?.completeHTML) {
      html = data.responsiveLayouts.desktop.completeHTML;
      console.log('✅ Found HTML in data.responsiveLayouts.desktop.completeHTML');
    }
    
    if (!html) {
      console.warn('⚠️ No HTML content found for preview');
      return `<div class="preview-error" style="padding: 20px; text-align: center; font-family: Arial, sans-serif; color: #666;">
        <h3>Preview Not Available</h3>
        <p>The website content could not be captured for preview. This may occur with complex sites or those that heavily rely on JavaScript.</p>
        <p>The Elementor template has still been generated and can be downloaded.</p>
      </div>`;
    }
    
    // Clean and prepare HTML for preview
    
    // Remove scripts and potentially harmful content
    html = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
    html = html.replace(/<link[^>]*>/gi, '');
    html = html.replace(/on\w+="[^"]*"/gi, '');
    
    // Add our preview styles
    const previewStyles = `
      <style>
        * { box-sizing: border-box; }
        body { 
          margin: 0; 
          padding: 20px; 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f8f9fa;
        }
        .preview-container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        img { max-width: 100%; height: auto; }
        a { pointer-events: none; }
        .preview-watermark {
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(139, 69, 196, 0.9);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          z-index: 1000;
        }
      </style>
    `;
    
    return `
      ${previewStyles}
      <div class="preview-watermark">CloneMentor Pro Preview</div>
      <div class="preview-container">
        ${html}
      </div>
    `;
  };

  const handleDownload = () => {
    if (!scannedData) return;
    
    // CRITICAL FIX: Check multiple possible data paths where template might be stored
    console.log('🔍 DOWNLOAD DEBUG - Available scannedData keys:', Object.keys(scannedData));
    
    // Create proper Elementor export format  
    const elementorData = scannedData.template || 
                         scannedData.elementorTemplate || 
                         scannedData.visualData?.template ||
                         scannedData.metadata?.template;
    
    if (!elementorData) {
      console.error('❌ DOWNLOAD ERROR: No template data found! Available keys:', Object.keys(scannedData));
      alert('Error: No template data available for download. Please try scanning the website again.');
      return;
    }
    
    console.log('✅ DOWNLOAD SUCCESS: Found template data:', {
      hasContent: !!elementorData.content,
      contentLength: elementorData.content?.length,
      hasPageSettings: !!elementorData.page_settings,
      templateSize: JSON.stringify(elementorData).length
    });
    
    // Elementor expects an array of templates for import - ENHANCED with full theme data
    const exportData = {
      version: "0.4",
      title: scannedData.pageInfo?.title || 'Cloned Page',
      type: "page",
      content: elementorData.content || [],
      page_settings: {
        // Enhanced page settings with captured theme data
        ...elementorData.page_settings,
        template: elementorData.template || "elementor_canvas",
        // Include captured colors and fonts from the visual data
        custom_colors: elementorData.page_settings?.custom_colors || scannedData.visualData?.assets?.colors?.map((color, index) => ({
          _id: `color_${index}`,
          title: `Captured Color ${index + 1}`,
          color: color
        })) || [],
        custom_fonts: elementorData.page_settings?.custom_fonts || scannedData.visualData?.assets?.fonts?.map((font, index) => ({
          _id: `font_${index}`,
          title: `Captured Font ${index + 1}`,
          font_family: font
        })) || [],
        // Include captured CSS as custom CSS
        custom_css: elementorData.page_settings?.custom_css || scannedData.css || '',
      },
      export_date: new Date().toISOString(),
      elementor_version: "3.16.0",
      site_url: scannedData.pageInfo?.url || '',
      source: 'CloneMentor Pro',
      // Additional metadata for better theme preservation
      metadata: {
        original_html: scannedData.html,
        captured_css: scannedData.css,
        fidelity_score: scannedData.verification?.fidelityScore,
        capture_timestamp: new Date().toISOString(),
        original_fonts: scannedData.visualData?.assets?.fonts,
        original_colors: scannedData.visualData?.assets?.colors
      }
    };
    
    // Wrap in the format Elementor expects for import
    const finalExport = {
      content: JSON.stringify([exportData]),
      doc_type: 'page',
      version: '0.4'
    };
    
    const blob = new Blob([JSON.stringify(finalExport, null, 2)], {
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
    
    // Call the onDownload callback
    if (onDownload) onDownload();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="preview-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="preview-modal"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.4, type: "spring" }}
          >
            <div className="preview-header">
              <div className="preview-info">
                <h2>🎉 Scan Complete!</h2>
                <p>Your page has been successfully cloned and converted to Elementor format</p>
              </div>
              <button className="preview-close" onClick={onClose}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            <div className="preview-content">
              {isLoading ? (
                <div className="preview-loading">
                  <div className="loading-spinner"></div>
                  <p>Generating preview...</p>
                </div>
              ) : (
                <div className="preview-iframe-container">
                  <iframe
                    className="preview-iframe"
                    srcDoc={previewHTML}
                    title="Page Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>
            
            <div className="preview-footer">
              {/* Fidelity Score Display */}
              {scannedData?.verification && (
                <div className="fidelity-report">
                  <div className="fidelity-header">
                    <h3>Fidelity Report</h3>
                    <div className={`fidelity-badge ${scannedData.verification.passed ? 'passed' : 'failed'}`}>
                      {scannedData.verification.passed ? '✓ VERIFIED' : '⚠ NEEDS REVIEW'}
                    </div>
                  </div>
                  <div className="fidelity-scores">
                    <div className="score-item">
                      <span className="score-label">Overall</span>
                      <span className="score-value">{Math.round((scannedData.verification.fidelityScore || 0) * 100)}%</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">Visual</span>
                      <span className="score-value">{Math.round((scannedData.verification.visualScore || 0) * 100)}%</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">Structure</span>
                      <span className="score-value">{Math.round((scannedData.verification.structuralScore || 0) * 100)}%</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">Responsive</span>
                      <span className="score-value">{Math.round((scannedData.verification.responsiveScore || 0) * 100)}%</span>
                    </div>
                  </div>
                  {scannedData.verification.recommendation && (
                    <div className="fidelity-recommendation">
                      <p>{scannedData.verification.recommendation}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="preview-stats">
                <div className="stat">
                  <span className="stat-number">{scannedData?.stats?.elements || 0}</span>
                  <span className="stat-label">Elements</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{scannedData?.stats?.sections || 0}</span>
                  <span className="stat-label">Sections</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{scannedData?.stats?.images || 0}</span>
                  <span className="stat-label">Images</span>
                </div>
              </div>
              
              <div className="preview-actions">
                <button className="btn-secondary" onClick={onClose}>
                  Close Preview
                </button>
                
                {/* Conditional Download Button */}
                {scannedData?.verification?.passed ? (
                  <button className="btn-primary" onClick={handleDownload}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Download Verified Template
                  </button>
                ) : (
                  <button className="btn-warning" disabled title="Fidelity verification failed - template may not match original">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 2L22 20H2L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Verification Failed
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Preview;