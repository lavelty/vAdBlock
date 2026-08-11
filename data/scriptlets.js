window.LAVE_SCRIPTLETS = {
    "*": [
        "set-constant(adblock, false)",
        "set-constant(adblocker, false)",
        "set-constant(isAdBlockActive, false)",
        "set-constant(window.google_ad_client, true)"
    ],
    "adblock.turtlecute.org": [
        "hide(.adbox.banner_ads.adsbox)",
        "hide(.textads)"
    ],
    "futbin.com": [
        "set-constant(adblock, false)",
        "set-constant(adblocker, false)",
        "set-constant(isAdBlockActive, false)",
        "set-constant(window.hasAdBlocker, false)"
    ],
    "aternos.org": [
        "set-constant(adblock, false)",
        "set-constant(adblocker, false)",
        "abort-on-property-read(adblock)"
    ],
    "unblockit.foo": [
        "rmnt(script, isAdb)",
        "hide(.adbwarmContainer)"
    ]
};
