(() => {
  'use strict';

  // Fonksiyonların değiştirildiğini gizlemek için Maskeleme
  const nativeToStringRegistry = new WeakMap();
  const originalToString = Function.prototype.toString;
  
  const newToString = function toString() {
    if (typeof this === 'function' && nativeToStringRegistry.has(this)) {
      return nativeToStringRegistry.get(this);
    }
    return originalToString.call(this);
  };

  nativeToStringRegistry.set(newToString, 'function toString() { [native code] }');
  Function.prototype.toString = newToString;

  function spoofNative(targetFunc, name) {
    nativeToStringRegistry.set(targetFunc, `function ${name}() { [native code] }`);
    Object.defineProperty(targetFunc, 'name', { value: name, writable: false, enumerable: false, configurable: true });
  }

  function spoofProperty(targetObj, propName, staticValue) {
    Object.defineProperty(targetObj, propName, { get: () => staticValue, enumerable: true, configurable: true });
  }

  // Opt-out Signals (GPC & DNT)
  spoofProperty(navigator, 'globalPrivacyControl', true);
  spoofProperty(navigator, 'doNotTrack', '1');
  spoofProperty(window, 'doNotTrack', '1');

  // Canvas Fingerprinting
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(...args) {
    const ctx = this.getContext('2d');
    if (ctx) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.01})`;
      ctx.fillRect(0, 0, 1, 1);
    }
    return origToDataURL.apply(this, args);
  };
  spoofNative(HTMLCanvasElement.prototype.toDataURL, 'toDataURL');

  // WebGL Fingerprinting
  const origGetParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(param) {
    if (param === 37445) return 'Google Inc.'; 
    if (param === 37446) return 'Google SwiftShader'; 
    return origGetParameter.apply(this, arguments);
  };
  spoofNative(WebGLRenderingContext.prototype.getParameter, 'getParameter');

  // Hardware Fingerprinting
  spoofProperty(navigator, 'hardwareConcurrency', 4);
  spoofProperty(navigator, 'deviceMemory', 8);

  // Audio Fingerprinting
  if (window.AudioBuffer) {
    const origGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function() {
      const results = origGetChannelData.apply(this, arguments);
      if (results.length > 100) results[50] += 0.0000001; 
      return results;
    };
    spoofNative(AudioBuffer.prototype.getChannelData, 'getChannelData');
  }

  // Font Enumeration
  if (document.fonts && document.fonts.check) {
    document.fonts.check = function() { return true; };
    spoofNative(document.fonts.check, 'check');
  }

  // Screen Metrics Fingerprinting removed due to responsive layout bugs

  // Privacy Sandbox APIs
  if ('browsingTopics' in navigator) navigator.browsingTopics = () => Promise.resolve([]);
  if ('joinAdInterestGroup' in navigator) navigator.joinAdInterestGroup = () => Promise.reject('Rejected');
  if ('runAdAuction' in navigator) navigator.runAdAuction = () => Promise.resolve(null);
  if ('setAppAttributionReportingEnabled' in navigator) delete navigator.setAppAttributionReportingEnabled;

  // Storage Access API
  if (document.requestStorageAccess) {
    document.requestStorageAccess = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
    spoofNative(document.requestStorageAccess, 'requestStorageAccess');
  }
  if (document.hasStorageAccess) {
    document.hasStorageAccess = () => Promise.resolve(false);
    spoofNative(document.hasStorageAccess, 'hasStorageAccess');
  }

  // Background Beacon Tracking & Beacon Transport
  navigator.sendBeacon = function() { return true; };
  spoofNative(navigator.sendBeacon, 'sendBeacon');

  // Eval Suppression — sadece reklam tespit scriptlerinin eval çağrılarını engelle
  const origEval = window.eval;
  window.eval = function(code) {
    if (typeof code === 'string' && (
      code.includes('adblock') || code.includes('AdBlock') || code.includes('adsbox') ||
      code.includes('ad-block') || code.includes('adsbygoogle') || code.includes('getadmiral') ||
      code.includes('detectAdBlock') || code.includes('blockadblock') || code.includes('fuckadblock') ||
      code.includes('isAdEnabled')
    )) {
      return null;
    }
    return origEval.call(this, code);
  };
  spoofNative(window.eval, 'eval');

})();
