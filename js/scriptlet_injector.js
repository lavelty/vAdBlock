(function() {
    if (window.__laveScriptletsActive) return;
    window.__laveScriptletsActive = true;

    const hostname = location.hostname;
    const rules = window.LAVE_SCRIPTLETS || {};
    
    // Find matching domain rules
    let activeRules = [];
    for (const domain in rules) {
        if (domain === '*' || hostname === domain || hostname.endsWith('.' + domain)) {
            activeRules = activeRules.concat(rules[domain]);
        }
    }

    if (activeRules.length === 0) return;

    // Parse commands
    const cmds = activeRules.map(r => {
        const match = r.match(/^([a-z-]+)\((.*)\)$/);
        if (match) {
            // Respect commas inside quotes or nested brackets? For simplicity, we just split by comma if not quoted.
            // A simple split for now since our args don't contain commas:
            const args = match[2].split(',').map(s => s.trim());
            return { cmd: match[1], args: args };
        }
        return null;
    }).filter(Boolean);

    // Helpers
    function setConstant(prop, valueStr) {
        let val;
        if (valueStr === 'false') val = false;
        else if (valueStr === 'true') val = true;
        else if (valueStr === 'null') val = null;
        else if (valueStr === 'undefined') val = undefined;
        else if (valueStr === 'empty-string') val = '';
        else if (!isNaN(Number(valueStr))) val = Number(valueStr);
        else val = valueStr;
        
        let target = window;
        const chain = prop.split('.');
        for (let i = 0; i < chain.length - 1; i++) {
            if (!target[chain[i]]) target[chain[i]] = {};
            target = target[chain[i]];
        }
        const lastProp = chain[chain.length - 1];
        
        Object.defineProperty(target, lastProp, {
            get: () => val,
            set: () => {},
            configurable: true,
            enumerable: true
        });
    }

    function abortOnPropertyRead(prop) {
        let target = window;
        const chain = prop.split('.');
        for (let i = 0; i < chain.length - 1; i++) {
            if (!target[chain[i]]) target[chain[i]] = {};
            target = target[chain[i]];
        }
        const lastProp = chain[chain.length - 1];
        
        let originalValue = target[lastProp];
        Object.defineProperty(target, lastProp, {
            get: function() {
                throw new ReferenceError("LAVE: Aborted read of property " + prop);
            },
            set: function(val) { originalValue = val; },
            configurable: true
        });
    }

    // Intercept DOM node creation to remove script text
    let rmntStrings = [];
    cmds.filter(c => c.cmd === 'rmnt' || c.cmd === 'abort-current-inline-script').forEach(c => {
        // args[1] is the string to look for. Unquote it if needed.
        let str = c.args[1] !== undefined ? c.args[1] : c.args[0];
        if (str.startsWith('"') || str.startsWith("'")) str = str.slice(1, -1);
        rmntStrings.push(str);
    });

    if (rmntStrings.length > 0) {
        const OrigNodeTextSetter = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').set;
        
        function blockText(node, val) {
            if (node.tagName === 'SCRIPT' && typeof val === 'string') {
                for (let str of rmntStrings) {
                    if (val.includes(str)) {
                        return true;
                    }
                }
            }
            return false;
        }

        if (OrigNodeTextSetter) {
            Object.defineProperty(Node.prototype, 'textContent', {
                set: function(val) {
                    if (blockText(this, val)) return;
                    OrigNodeTextSetter.call(this, val);
                }
            });
        }
        
        const OrigInnerHTMLSetter = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
        if (OrigInnerHTMLSetter) {
            Object.defineProperty(Element.prototype, 'innerHTML', {
                set: function(val) {
                    if (blockText(this, val)) return;
                    OrigInnerHTMLSetter.call(this, val);
                }
            });
        }

        // Intercept inline scripts parsed by browser
        try {
            const observer = new MutationObserver(mutations => {
                for (let m of mutations) {
                    for (let node of m.addedNodes) {
                        if (node.tagName === 'SCRIPT' && node.textContent) {
                            for (let str of rmntStrings) {
                                if (node.textContent.includes(str)) {
                                    node.textContent = '';
                                }
                            }
                        }
                    }
                }
            });
            if (document.documentElement) {
                observer.observe(document.documentElement, { childList: true, subtree: true });
            } else {
                observer.observe(document, { childList: true, subtree: true });
            }
        } catch(e) {}
    }

    // Execute scripts
    cmds.forEach(c => {
        if (c.cmd === 'set-constant') setConstant(c.args[0], c.args[1]);
        if (c.cmd === 'abort-on-property-read') abortOnPropertyRead(c.args[0]);
    });

    // Cosmetic 'hide' requires injecting CSS
    const hideSelectors = cmds.filter(c => c.cmd === 'hide').map(c => {
        // Rejoin if it contained commas
        let sel = c.args.join(','); 
        return sel;
    });
    
    if (hideSelectors.length > 0) {
        const injectCss = () => {
            const style = document.createElement('style');
            style.textContent = hideSelectors.join(', ') + ' { display: none !important; }';
            (document.head || document.documentElement).appendChild(style);
        };
        if (document.head || document.documentElement) {
            injectCss();
        } else {
            document.addEventListener('DOMContentLoaded', injectCss);
        }
    }
})();
