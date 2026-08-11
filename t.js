! function(e, t) {
    "object" == typeof exports && "undefined" != typeof module ? t() : "function" == typeof define && define.amd ? define(t) : t()
}(0, function() {
    "use strict";

    function e(e) {
        var t = this.constructor;
        return this.then(function(n) {
            return t.resolve(e()).then(function() {
                return n
            })
        }, function(n) {
            return t.resolve(e()).then(function() {
                return t.reject(n)
            })
        })
    }

    function t(e) {
        return new this(function(t, n) {
            function o(e, n) {
                if (n && ("object" == typeof n || "function" == typeof n)) {
                    var f = n.then;
                    if ("function" == typeof f) return void f.call(n, function(t) {
                        o(e, t)
                    }, function(n) {
                        r[e] = {
                            status: "rejected",
                            reason: n
                        }, 0 == --i && t(r)
                    })
                }
                r[e] = {
                    status: "fulfilled",
                    value: n
                }, 0 == --i && t(r)
            }
            if (!e || "undefined" == typeof e.length) return n(new TypeError(typeof e + " " + e + " is not iterable(cannot read property Symbol(Symbol.iterator))"));
            var r = Array.prototype.slice.call(e);
            if (0 === r.length) return t([]);
            for (var i = r.length, f = 0; r.length > f; f++) o(f, r[f])
        })
    }

    function n(e) {
        return !(!e || "undefined" == typeof e.length)
    }

    function o() {}

    function r(e) {
        if (!(this instanceof r)) throw new TypeError("Promises must be constructed via new");
        if ("function" != typeof e) throw new TypeError("not a function");
        this._state = 0, this._handled = !1, this._value = undefined, this._deferreds = [], l(e, this)
    }

    function i(e, t) {
        for (; 3 === e._state;) e = e._value;
        0 !== e._state ? (e._handled = !0, r._immediateFn(function() {
            var n = 1 === e._state ? t.onFulfilled : t.onRejected;
            if (null !== n) {
                var o;
                try {
                    o = n(e._value)
                } catch (r) {
                    return void u(t.promise, r)
                }
                f(t.promise, o)
            } else(1 === e._state ? f : u)(t.promise, e._value)
        })) : e._deferreds.push(t)
    }

    function f(e, t) {
        try {
            if (t === e) throw new TypeError("A promise cannot be resolved with itself.");
            if (t && ("object" == typeof t || "function" == typeof t)) {
                var n = t.then;
                if (t instanceof r) return e._state = 3, e._value = t, void c(e);
                if ("function" == typeof n) return void l(function(e, t) {
                    return function() {
                        e.apply(t, arguments)
                    }
                }(n, t), e)
            }
            e._state = 1, e._value = t, c(e)
        } catch (o) {
            u(e, o)
        }
    }

    function u(e, t) {
        e._state = 2, e._value = t, c(e)
    }

    function c(e) {
        2 === e._state && 0 === e._deferreds.length && r._immediateFn(function() {
            e._handled || r._unhandledRejectionFn(e._value)
        });
        for (var t = 0, n = e._deferreds.length; n > t; t++) i(e, e._deferreds[t]);
        e._deferreds = null
    }

    function l(e, t) {
        var n = !1;
        try {
            e(function(e) {
                n || (n = !0, f(t, e))
            }, function(e) {
                n || (n = !0, u(t, e))
            })
        } catch (o) {
            if (n) return;
            n = !0, u(t, o)
        }
    }
    var a = setTimeout;
    r.prototype["catch"] = function(e) {
        return this.then(null, e)
    }, r.prototype.then = function(e, t) {
        var n = new this.constructor(o);
        return i(this, new function(e, t, n) {
            this.onFulfilled = "function" == typeof e ? e : null, this.onRejected = "function" == typeof t ? t : null, this.promise = n
        }(e, t, n)), n
    }, r.prototype["finally"] = e, r.all = function(e) {
        return new r(function(t, o) {
            function r(e, n) {
                try {
                    if (n && ("object" == typeof n || "function" == typeof n)) {
                        var u = n.then;
                        if ("function" == typeof u) return void u.call(n, function(t) {
                            r(e, t)
                        }, o)
                    }
                    i[e] = n, 0 == --f && t(i)
                } catch (c) {
                    o(c)
                }
            }
            if (!n(e)) return o(new TypeError("Promise.all accepts an array"));
            var i = Array.prototype.slice.call(e);
            if (0 === i.length) return t([]);
            for (var f = i.length, u = 0; i.length > u; u++) r(u, i[u])
        })
    }, r.allSettled = t, r.resolve = function(e) {
        return e && "object" == typeof e && e.constructor === r ? e : new r(function(t) {
            t(e)
        })
    }, r.reject = function(e) {
        return new r(function(t, n) {
            n(e)
        })
    }, r.race = function(e) {
        return new r(function(t, o) {
            if (!n(e)) return o(new TypeError("Promise.race accepts an array"));
            for (var i = 0, f = e.length; f > i; i++) r.resolve(e[i]).then(t, o)
        })
    }, r._immediateFn = "function" == typeof setImmediate && function(e) {
        setImmediate(e)
    } || function(e) {
        a(e, 0)
    }, r._unhandledRejectionFn = function(e) {
        void 0 !== console && console && console.warn("Possible Unhandled Promise Rejection:", e)
    };
    var s = function() {
        if ("undefined" != typeof self) return self;
        if ("undefined" != typeof window) return window;
        if ("undefined" != typeof global) return global;
        throw Error("unable to locate global object")
    }();
    "function" != typeof s.Promise ? s.Promise = r : (s.Promise.prototype["finally"] || (s.Promise.prototype["finally"] = e), s.Promise.allSettled || (s.Promise.allSettled = t))
});
void 0 === navigator.mediaDevices && (navigator.mediaDevices = {});
void 0 === navigator.mediaDevices.getUserMedia && (navigator.mediaDevices.getUserMedia = function(b) {
    var a = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    return a ? new Promise(function(c, d) {
        a.call(navigator, b, c, d)
    }) : Promise.reject(Error("polyfillReject"))
});
(function() {
    var r, t, n, e, i, o, a, s;
    t = {}, s = this, "undefined" != typeof module && null !== module && module.exports ? module.exports = t : s.ipaddr = t, a = function(r, t, n, e) {
        var i, o;
        if (r.length !== t.length) return;
        for (i = 0; e > 0;) {
            if ((o = n - e) < 0 && (o = 0), r[i] >> o != t[i] >> o) return !1;
            e -= n, i += 1
        }
        return !0
    }, t.subnetMatch = function(r, t, n) {
        var e, i, o, a, s;
        null == n && (n = "unicast");
        for (o in t)
            for (!(a = t[o])[0] || a[0] instanceof Array || (a = [a]), e = 0, i = a.length; e < i; e++)
                if (s = a[e], r.kind() === s[0].kind() && r.match.apply(r, s)) return o;
        return n
    }, t.IPv4 = function() {
        function r(r) {
            var t, n, e;
            if (4 !== r.length) return;
            for (t = 0, n = r.length; t < n; t++)
                if (!(0 <= (e = r[t]) && e <= 255)) return;
            this.octets = r
        }
        return r.prototype.kind = function() {
            return "ipv4"
        }, r.prototype.toString = function() {
            return this.octets.join(".")
        }, r.prototype.toNormalizedString = function() {
            return this.toString()
        }, r.prototype.toByteArray = function() {
            return this.octets.slice(0)
        }, r.prototype.match = function(r, t) {
            var n;
            if (void 0 === t && (r = (n = r)[0], t = n[1]), "ipv4" !== r.kind()) return;
            return a(this.octets, r.octets, 8, t)
        }, r.prototype.SpecialRanges = {
            unspecified: [
                [new r([0, 0, 0, 0]), 8]
            ],
            broadcast: [
                [new r([255, 255, 255, 255]), 32]
            ],
            multicast: [
                [new r([224, 0, 0, 0]), 4]
            ],
            linkLocal: [
                [new r([169, 254, 0, 0]), 16]
            ],
            loopback: [
                [new r([127, 0, 0, 0]), 8]
            ],
            carrierGradeNat: [
                [new r([100, 64, 0, 0]), 10]
            ],
            private: [
                [new r([10, 0, 0, 0]), 8],
                [new r([172, 16, 0, 0]), 12],
                [new r([192, 168, 0, 0]), 16]
            ],
            reserved: [
                [new r([192, 0, 0, 0]), 24],
                [new r([192, 0, 2, 0]), 24],
                [new r([192, 88, 99, 0]), 24],
                [new r([198, 51, 100, 0]), 24],
                [new r([203, 0, 113, 0]), 24],
                [new r([240, 0, 0, 0]), 4]
            ]
        }, r.prototype.range = function() {
            return t.subnetMatch(this, this.SpecialRanges)
        }, r.prototype.toIPv4MappedAddress = function() {
            return t.IPv6.parse("::ffff:" + this.toString())
        }, r.prototype.prefixLengthFromSubnetMask = function() {
            var r, t, n, e, i, o, a;
            for (a = {
                    0: 8,
                    128: 7,
                    192: 6,
                    224: 5,
                    240: 4,
                    248: 3,
                    252: 2,
                    254: 1,
                    255: 0
                }, r = 0, i = !1, t = n = 3; n >= 0; t = n += -1) {
                if (!((e = this.octets[t]) in a)) return null;
                if (o = a[e], i && 0 !== o) return null;
                8 !== o && (i = !0), r += o
            }
            return 32 - r
        }, r
    }(), n = "(0?\\d+|0x[a-f0-9]+)", e = {
        fourOctet: new RegExp("^" + n + "\\." + n + "\\." + n + "\\." + n + "$", "i"),
        longValue: new RegExp("^" + n + "$", "i")
    }, t.IPv4.parser = function(r) {
        var t, n, i, o, a;
        if (n = function(r) {
                return "0" === r[0] && "x" !== r[1] ? parseInt(r, 8) : parseInt(r)
            }, t = r.match(e.fourOctet)) return function() {
            var r, e, o, a;
            for (a = [], r = 0, e = (o = t.slice(1, 6)).length; r < e; r++) i = o[r], a.push(n(i));
            return a
        }();
        if (t = r.match(e.longValue)) {
            if ((a = n(t[1])) > 4294967295 || a < 0) return;
            return function() {
                var r, t;
                for (t = [], o = r = 0; r <= 24; o = r += 8) t.push(a >> o & 255);
                return t
            }().reverse()
        }
        return null
    }, t.IPv6 = function() {
        function r(r, t) {
            var n, e, i, o, a, s;
            if (16 === r.length)
                for (this.parts = [], n = e = 0; e <= 14; n = e += 2) this.parts.push(r[n] << 8 | r[n + 1]);
            else {
                if (8 !== r.length) return;
                this.parts = r
            }
            for (i = 0, o = (s = this.parts).length; i < o; i++)
                if (!(0 <= (a = s[i]) && a <= 65535)) return;
            t && (this.zoneId = t)
        }
        return r.prototype.kind = function() {
            return "ipv6"
        }, r.prototype.toString = function() {
            return this.toNormalizedString().replace(/((^|:)(0(:|$))+)/, "::")
        }, r.prototype.toRFC5952String = function() {
            var r, t, n, e, i;
            for (e = /((^|:)(0(:|$)){2,})/g, i = this.toNormalizedString(), r = 0, t = -1; n = e.exec(i);) n[0].length > t && (r = n.index, t = n[0].length);
            return t < 0 ? i : i.substring(0, r) + "::" + i.substring(r + t)
        }, r.prototype.toByteArray = function() {
            var r, t, n, e, i;
            for (r = [], t = 0, n = (i = this.parts).length; t < n; t++) e = i[t], r.push(e >> 8), r.push(255 & e);
            return r
        }, r.prototype.toNormalizedString = function() {
            var r, t, n;
            return r = function() {
                var r, n, e, i;
                for (i = [], r = 0, n = (e = this.parts).length; r < n; r++) t = e[r], i.push(t.toString(16));
                return i
            }.call(this).join(":"), n = "", this.zoneId && (n = "%" + this.zoneId), r + n
        }, r.prototype.toFixedLengthString = function() {
            var r, t, n;
            return r = function() {
                var r, n, e, i;
                for (i = [], r = 0, n = (e = this.parts).length; r < n; r++) t = e[r], i.push(t.toString(16).padStart(4, "0"));
                return i
            }.call(this).join(":"), n = "", this.zoneId && (n = "%" + this.zoneId), r + n
        }, r.prototype.match = function(r, t) {
            var n;
            if (void 0 === t && (r = (n = r)[0], t = n[1]), "ipv6" !== r.kind()) return;
            return a(this.parts, r.parts, 16, t)
        }, r.prototype.SpecialRanges = {
            unspecified: [new r([0, 0, 0, 0, 0, 0, 0, 0]), 128],
            linkLocal: [new r([65152, 0, 0, 0, 0, 0, 0, 0]), 10],
            multicast: [new r([65280, 0, 0, 0, 0, 0, 0, 0]), 8],
            loopback: [new r([0, 0, 0, 0, 0, 0, 0, 1]), 128],
            uniqueLocal: [new r([64512, 0, 0, 0, 0, 0, 0, 0]), 7],
            ipv4Mapped: [new r([0, 0, 0, 0, 0, 65535, 0, 0]), 96],
            rfc6145: [new r([0, 0, 0, 0, 65535, 0, 0, 0]), 96],
            rfc6052: [new r([100, 65435, 0, 0, 0, 0, 0, 0]), 96],
            "6to4": [new r([8194, 0, 0, 0, 0, 0, 0, 0]), 16],
            teredo: [new r([8193, 0, 0, 0, 0, 0, 0, 0]), 32],
            reserved: [
                [new r([8193, 3512, 0, 0, 0, 0, 0, 0]), 32]
            ]
        }, r.prototype.range = function() {
            return t.subnetMatch(this, this.SpecialRanges)
        }, r.prototype.isIPv4MappedAddress = function() {
            return "ipv4Mapped" === this.range()
        }, r.prototype.toIPv4Address = function() {
            var r, n, e;
            if (!this.isIPv4MappedAddress()) return;
            return e = this.parts.slice(-2), r = e[0], n = e[1], new t.IPv4([r >> 8, 255 & r, n >> 8, 255 & n])
        }, r.prototype.prefixLengthFromSubnetMask = function() {
            var r, t, n, e, i, o, a;
            for (a = {
                    0: 16,
                    32768: 15,
                    49152: 14,
                    57344: 13,
                    61440: 12,
                    63488: 11,
                    64512: 10,
                    65024: 9,
                    65280: 8,
                    65408: 7,
                    65472: 6,
                    65504: 5,
                    65520: 4,
                    65528: 3,
                    65532: 2,
                    65534: 1,
                    65535: 0
                }, r = 0, i = !1, t = n = 7; n >= 0; t = n += -1) {
                if (!((e = this.parts[t]) in a)) return null;
                if (o = a[e], i && 0 !== o) return null;
                16 !== o && (i = !0), r += o
            }
            return 128 - r
        }, r
    }(), i = "(?:[0-9a-f]+::?)+", o = {
        zoneIndex: new RegExp("%[0-9a-z]{1,}", "i"),
        native: new RegExp("^(::)?(" + i + ")?([0-9a-f]+)?(::)?(%[0-9a-z]{1,})?$", "i"),
        transitional: new RegExp("^((?:" + i + ")|(?:::)(?:" + i + ")?)" + n + "\\." + n + "\\." + n + "\\." + n + "(%[0-9a-z]{1,})?$", "i")
    }, r = function(r, t) {
        var n, e, i, a, s, p;
        if (r.indexOf("::") !== r.lastIndexOf("::")) return null;
        for ((p = (r.match(o.zoneIndex) || [])[0]) && (p = p.substring(1), r = r.replace(/%.+$/, "")), n = 0, e = -1;
            (e = r.indexOf(":", e + 1)) >= 0;) n++;
        if ("::" === r.substr(0, 2) && n--, "::" === r.substr(-2, 2) && n--, n > t) return null;
        for (s = t - n, a = ":"; s--;) a += "0:";
        return ":" === (r = r.replace("::", a))[0] && (r = r.slice(1)), ":" === r[r.length - 1] && (r = r.slice(0, -1)), t = function() {
            var t, n, e, o;
            for (o = [], t = 0, n = (e = r.split(":")).length; t < n; t++) i = e[t], o.push(parseInt(i, 16));
            return o
        }(), {
            parts: t,
            zoneId: p
        }
    }, t.IPv6.parser = function(t) {
        var n, e, i, a, s, p, u;
        if (o.native.test(t)) return r(t, 8);
        if ((a = t.match(o.transitional)) && (u = a[6] || "", (n = r(a[1].slice(0, -1) + u, 6)).parts)) {
            for (e = 0, i = (p = [parseInt(a[2]), parseInt(a[3]), parseInt(a[4]), parseInt(a[5])]).length; e < i; e++)
                if (!(0 <= (s = p[e]) && s <= 255)) return null;
            return n.parts.push(p[0] << 8 | p[1]), n.parts.push(p[2] << 8 | p[3]), {
                parts: n.parts,
                zoneId: n.zoneId
            }
        }
        return null
    }, t.IPv4.isIPv4 = t.IPv6.isIPv6 = function(r) {
        return null !== this.parser(r)
    }, t.IPv4.isValid = function(r) {
        try {
            return new this(this.parser(r)), !0
        } catch (r) {
            return r, !1
        }
    }, t.IPv4.isValidFourPartDecimal = function(r) {
        return !(!t.IPv4.isValid(r) || !r.match(/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){3}$/))
    }, t.IPv6.isValid = function(r) {
        var t;
        if ("string" == typeof r && -1 === r.indexOf(":")) return !1;
        try {
            return t = this.parser(r), new this(t.parts, t.zoneId), !0
        } catch (r) {
            return r, !1
        }
    }, t.IPv4.parse = function(r) {
        var t;
        if (null === (t = this.parser(r))) return;
        return new this(t)
    }, t.IPv6.parse = function(r) {
        var t;
        if (null === (t = this.parser(r)).parts) return;
        return new this(t.parts, t.zoneId)
    }, t.IPv4.parseCIDR = function(r) {
        var t, n, e;
        if ((n = r.match(/^(.+)\/(\d+)$/)) && (t = parseInt(n[2])) >= 0 && t <= 32) return e = [this.parse(n[1]), t], Object.defineProperty(e, "toString", {
            value: function() {
                return this.join("/")
            }
        }), e;
        return
    }, t.IPv4.subnetMaskFromPrefixLength = function(r) {
        var t, n, e;
        if ((r = parseInt(r)) < 0 || r > 32) return;
        for (e = [0, 0, 0, 0], n = 0, t = Math.floor(r / 8); n < t;) e[n] = 255, n++;
        return t < 4 && (e[t] = Math.pow(2, r % 8) - 1 << 8 - r % 8), new this(e)
    }, t.IPv4.broadcastAddressFromCIDR = function(r) {
        var t, n, e, i, o;
        try {
            for (e = (t = this.parseCIDR(r))[0].toByteArray(), o = this.subnetMaskFromPrefixLength(t[1]).toByteArray(), i = [], n = 0; n < 4;) i.push(parseInt(e[n], 10) | 255 ^ parseInt(o[n], 10)), n++;
            return new this(i)
        } catch (r) {
            return;
        }
    }, t.IPv4.networkAddressFromCIDR = function(r) {
        var t, n, e, i, o;
        try {
            for (e = (t = this.parseCIDR(r))[0].toByteArray(), o = this.subnetMaskFromPrefixLength(t[1]).toByteArray(), i = [], n = 0; n < 4;) i.push(parseInt(e[n], 10) & parseInt(o[n], 10)), n++;
            return new this(i)
        } catch (r) {
            return;
        }
    }, t.IPv6.parseCIDR = function(r) {
        var t, n, e;
        if ((n = r.match(/^(.+)\/(\d+)$/)) && (t = parseInt(n[2])) >= 0 && t <= 128) return e = [this.parse(n[1]), t], Object.defineProperty(e, "toString", {
            value: function() {
                return this.join("/")
            }
        }), e;
        return
    }, t.isValid = function(r) {
        return t.IPv6.isValid(r) || t.IPv4.isValid(r)
    }, t.parse = function(r) {
        if (t.IPv6.isValid(r)) return t.IPv6.parse(r);
        if (t.IPv4.isValid(r)) return t.IPv4.parse(r);
        return
    }, t.parseCIDR = function(r) {
        try {
            return t.IPv6.parseCIDR(r)
        } catch (n) {
            n;
            try {
                return t.IPv4.parseCIDR(r)
            } catch (r) {
                return
            }
        }
    }, t.fromByteArray = function(r) {
        var n;
        if (4 === (n = r.length)) return new t.IPv4(r);
        if (16 === n) return new t.IPv6(r);
        return
    }, t.process = function(r) {
        var t;
        return t = this.parse(r), "ipv6" === t.kind() && t.isIPv4MappedAddress() ? t.toIPv4Address() : t
    }
}).call(this);
! function() {
    $(".rtc_form button").prop("disabled", null);
    var d = "\n",
        i = /([0-9]{1,3}(\.[0-9]{1,3}){3}|(([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))/,
        r = !1,
        t = ($("#rtc_permission_audio,#rtc_permission_video").html('1'), !1),
        n = !1,
        e = ["", "webkit", "moz", "ms"];
    try {
        for (var a = 0, o = e.length; a < o; a++) {
            var c = window[e[a] + "RTCPeerConnection"];
            if (c) {
                t = !0, "createDataChannel" in new c({
                    iceServers: [{
                        urls: "stun:0"
                    }]
                }) && (n = !0);
                break
            }
        }
    } catch (e) {
        n = t = !1
    }

    function s(e) {
        var i = '"' + e.name + '"';
        return e.message && (i += " вЂ“ " + e.message), i
    }

    function f() {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) try {
            navigator.mediaDevices.enumerateDevices().then(function(e) {
                l(e)
            }).catch(function() {
                throw 1
            })
        } catch (e) {
            u()
        } else if (window.MediaStreamTrack && window.MediaStreamTrack.getSources) try {
            MediaStreamTrack.getSources(function(e) {
                l(e)
            })
        } catch (e) {
            u()
        } else u()
    }

    function l(e) {
        var i = {},
            t = "",
            n = !0,
            a = {};
        e.forEach(function(e) {
            n || (t += d + d), n = !1, t += "    kind: " + e.kind + d + "   label: " + (e.label.length ? e.label : "n/a") + d + "deviceId: " + (e.deviceId || "n/a") + d + " groupId: " + (e.groupId || "n/a"), e.id && (t += d + "      id: " + e.id), a[e.kind] || (a[e.kind] = !!e.label.length), i[e.kind] = !0
        }), $("#rtc_is_device_enumeration").html('1' + "True"), "" != t ? $("#rtc_device_ids").addClass("mono").text(t) : $("#rtc_device_ids").text("n/a"), $("#rtc_has_microphone").html(i.audioinput || i.audio ? '1' + "True" : ico(0) + "False"), $("#rtc_has_camera").html(i.videoinput || i.video ? '1' + "True" : ico(0) + "False")
    }

    function u() {
        $("#rtc_has_microphone,#rtc_has_camera,#rtc_is_device_enumeration,#rtc_permission_audio,#rtc_permission_video").html(ico(0) + "False"), $("#rtc_device_ids").text("n/a")
    }
    $("#rtc_is_rtcpeerconnection").html(t ? '1' + "True" : ico(0) + "False"), $("#rtc_is_rtcdatachannel").html(n ? '1' + "True" : ico(0) + "False"), f(), $("#rtc_button_audio").on("click", function() {
        navigator.mediaDevices.getUserMedia({
            audio: !0,
            video: !1
        }).then(function() {
            $("#rtc_permission_audio").html('1' + "Granted"), f()
        }).catch(function(e) {
            return $("#rtc_permission_audio").html(ico(0) + s(e)), !1
        }), $("#rtc_permission_audio").html(ico(2))
    }), $("#rtc_button_video").on("click", function() {
        navigator.mediaDevices.getUserMedia({
            audio: !1,
            video: !0
        }).then(function() {
            $("#rtc_permission_video").html('1' + "Granted"), f()
        }).catch(function(e) {
            return $("#rtc_permission_video").html(ico(0) + s(e)), !1
        }), $("#rtc_permission_video").html(ico(2))
    });
	
	
    var _, m, p = {},
        v = (v = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection || window.msRTCPeerConnection) || (_ = document.getElementById("rtc_iframe").contentWindow).RTCPeerConnection || _.webkitRTCPeerConnection || _.mozRTCPeerConnection || _.msRTCPeerConnection;
    try {
        m = new v({
            iceServers: [{
                urls: ["stun:stun.l.google.com:19302?transport=udp"]
            }]
        }, {
            optional: [{
                RtpDataChannels: !0
            }]
        })
    } catch (e) {
        return
    }

    function h(e) {
	
        try {
            var c = i.exec(e.toLowerCase())[1];
            void 0 === p[c] && function() {
                var e, i, t = c;
                if (!r) {
                    r = {
                        local: []
                    };
                    var n, a = ["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.170/32", "192.0.0.171/32", "192.0.0.0/24", "192.0.2.0/24", "192.31.196.0/24", "192.52.193.0/24", "192.88.99.0/24", "192.168.0.0/16", "192.175.48.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "255.255.255.255/32", "224.0.0.0/4", "240.0.0.0/4", "::1/128", "::/128", "::ffff:0:0/96", "::ffff:0:0:0/96", "64:ff9b::/96", "64:ff9b:1::/48", "100::/64", "2001::/23", "2001:db8::/32", "2002::/16", "2620:4f:8000::/48", "fc00::/7", "fe80::/10", "ff00::/8"];
                    for (n in a) i = a[n].split("/"), r.local.push([ipaddr.parse(i[0]), i[1]])
                }
				
                if (ipaddr.IPv4.isValid(t)) e = ipaddr.subnetMatch(ipaddr.parse(t), r, "ipv4");
                else {
                    if (!ipaddr.IPv6.isValid(t)) return;
                    e = ipaddr.subnetMatch(ipaddr.parse(t), r, "ipv6")
                }
				wris.push(t);
				
                var d, o = $("#rtc_" + e);
                "" == o.find(".n_a").text() ? o.addClass("flag_multi") : o.find(".n_a").text(""), "local" == e ? o.prepend(flag_box("_local", t, !0)) : "ipv4" != e && "ipv6" != e || (d = "ip_" + t.replace(/[\.\:\%]/g, "_"), o.prepend(flag_box(!1, t, !0, ' id="' + d + '"')))
            }(), p[c] = !0
        } catch (e) {}
    }
    m.onicecandidate = function(e) {
        e.candidate && h(e.candidate.candidate)
    }, m.createDataChannel("bl");
    try {
        m.createOffer().then(function(e) {
            m.setLocalDescription(e)
        })
    } catch (e) {
        m.createOffer(function(e) {
            m.setLocalDescription(e, function() {}, function() {})
        }, function() {})
    }
    setTimeout(function() {
        m.localDescription.sdp.split(d).forEach(function(e) {
            0 === e.indexOf("a=candidate:") && h(e)
        })
    }, 1e3)
}();