// fingerprint.js — Canvas/WebGL/audio/font parmak izi korumasi (MAIN world)
(() => {
    if (window.__vadblockFpActive) return;
    window.__vadblockFpActive = true;

    function jitterU8(arr) {
        if (!arr || !arr.length) return;
        for (let i = 0; i < 4; i++) {
            arr[(Math.random() * arr.length) | 0] ^= 1;
        }
    }

    function jitterF32(arr) {
        if (!arr || !arr.length) return;
        for (let i = 0; i < 4; i++) {
            arr[(Math.random() * arr.length) | 0] += (Math.random() * 2 - 1) * 1e-5;
        }
    }

    function noiseCanvas(ctx, w, h) {
        try {
            const img = ctx.getImageData(0, 0, Math.min(w, 1024), Math.min(h, 1024));
            jitterU8(img.data);
            ctx.putImageData(img, 0, 0);
        } catch (e) {}
    }

    // Canvas 2D
    const proto = HTMLCanvasElement.prototype;
    if (!proto.__vadblockOrigToDataURL) {
        proto.__vadblockOrigToDataURL = proto.toDataURL;
        proto.toDataURL = function (...args) {
            try { const ctx = this.getContext('2d'); if (ctx) noiseCanvas(ctx, this.width, this.height); } catch (e) {}
            return proto.__vadblockOrigToDataURL.apply(this, args);
        };
        proto.__vadblockOrigToBlob = proto.toBlob;
        proto.toBlob = function (...args) {
            try { const ctx = this.getContext('2d'); if (ctx) noiseCanvas(ctx, this.width, this.height); } catch (e) {}
            return proto.__vadblockOrigToBlob.apply(this, args);
        };
    }

    // Dogrudan getImageData okumalarina gurultu
    const c2d = CanvasRenderingContext2D.prototype;
    if (!c2d.__vadblockOrigGetImageData) {
        c2d.__vadblockOrigGetImageData = c2d.getImageData;
        c2d.getImageData = function (...args) {
            const img = c2d.__vadblockOrigGetImageData.apply(this, args);
            try { jitterU8(img.data); } catch (e) {}
            return img;
        };
    }

    // measureText genisliklerine hafif jitter (font parmak izi kirilir)
    if (!c2d.__vadblockOrigMeasureText) {
        c2d.__vadblockOrigMeasureText = c2d.measureText;
        c2d.measureText = function (text) {
            const m = c2d.__vadblockOrigMeasureText.call(this, text);
            try {
                if (m && typeof m.width === 'number') {
                    const r = { width: m.width + ((Math.random() * 0.6) - 0.3) };
                    for (const k in m) if (k !== 'width' && typeof m[k] === 'number') r[k] = m[k];
                    return r;
                }
            } catch (e) {}
            return m;
        };
    }

    // WebGL
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const ctx = origGetContext.call(this, type, ...rest);
        if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') && !ctx.__vadblockFpProtected) {
            try {
                ctx.__vadblockFpProtected = true;
                const origGetParameter = ctx.getParameter.bind(ctx);
                ctx.getParameter = function (p) {
                    const UNMASKED_VENDOR_WEBGL = 0x9245;
                    const UNMASKED_RENDERER_WEBGL = 0x9246;
                    if (p === UNMASKED_VENDOR_WEBGL) return 'Google Inc. (Generic)';
                    if (p === UNMASKED_RENDERER_WEBGL) return 'ANGLE (Generic)';
                    return origGetParameter(p);
                };
                const origReadPixels = ctx.readPixels.bind(ctx);
                ctx.readPixels = function (x, y, width, height, format, type, pixels) {
                    origReadPixels(x, y, width, height, format, type, pixels);
                    try { jitterU8(pixels); } catch (e) {}
                };
            } catch (e) {}
        }
        return ctx;
    };

    // Audio parmak izi: OfflineAudioContext sonucuna gurultu ekle
    try {
        const OAC = window.OfflineAudioContext;
        if (OAC && !OAC.prototype.__vadblockOrigStartRendering) {
            OAC.prototype.__vadblockOrigStartRendering = OAC.prototype.startRendering;
            OAC.prototype.startRendering = function (...args) {
                const p = OAC.prototype.__vadblockOrigStartRendering.apply(this, args);
                if (p && typeof p.then === 'function') {
                    return p.then(buffer => {
                        try {
                            if (buffer) {
                                for (let c = 0; c < buffer.numberOfChannels; c++) {
                                    jitterF32(buffer.getChannelData(c));
                                }
                            }
                        } catch (e) {}
                        return buffer;
                    });
                }
                return p;
            };
        }
    } catch (e) {}


})();
