const fs = require('fs');
let rules = JSON.parse(fs.readFileSync('data/rules.json'));
let newRules = [
  {
    "id": 1,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "resourceTypes": ["ping"],
      "urlFilter": "*"
    }
  },
  {
    "id": 2,
    "priority": 2,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        { "header": "Sec-GPC", "operation": "set", "value": "1" },
        { "header": "DNT", "operation": "set", "value": "1" }
      ]
    },
    "condition": {
      "urlFilter": "*",
      "resourceTypes": ["main_frame", "sub_frame", "script", "xmlhttprequest", "ping", "image"]
    }
  },
  {
    "id": 3,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||googletagmanager.com^",
      "resourceTypes": ["script", "xmlhttprequest", "sub_frame"]
    }
  },
  {
    "id": 4,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||doubleclick.net^",
      "resourceTypes": ["script", "image", "xmlhttprequest", "sub_frame"]
    }
  },
  {
    "id": 5,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||googlesyndication.com^",
      "resourceTypes": ["script", "image", "xmlhttprequest", "sub_frame"]
    }
  },
  {
    "id": 6,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||amazon-adsystem.com^",
      "resourceTypes": ["script", "image", "xmlhttprequest", "sub_frame"]
    }
  },
  {
    "id": 7,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||criteo.com^",
      "resourceTypes": ["script", "image", "xmlhttprequest", "sub_frame"]
    }
  },
  {
    "id": 8,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||platform.twitter.com^",
      "resourceTypes": ["script", "sub_frame"]
    }
  },
  {
    "id": 9,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||coinhive.com^",
      "resourceTypes": ["script", "xmlhttprequest", "websocket"]
    }
  },
  {
    "id": 10,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||minebox.io^",
      "resourceTypes": ["script", "xmlhttprequest", "websocket"]
    }
  }
];

// Remove existing rules with ID 1-10 to avoid conflicts
rules = rules.filter(r => r.id > 10);
// Merge new rules
rules = [...newRules, ...rules];
fs.writeFileSync('data/rules.json', JSON.stringify(rules, null, 4));
console.log('Added the 10 specific rules');
