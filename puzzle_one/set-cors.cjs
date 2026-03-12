/**
 * Sets Firebase Storage CORS configuration using the Firebase CLI access token.
 * Run with: node set-cors.js
 */
const fs = require('fs');
const https = require('https');
const os = require('os');

// Read the Firebase CLI stored access token
const configPath = os.homedir() + '/.config/configstore/firebase-tools.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let accessToken = null;
if (config.tokens?.access_token) {
  accessToken = config.tokens.access_token;
} else if (config.users) {
  const user = Object.values(config.users)[0];
  if (user?.tokens?.access_token) accessToken = user.tokens.access_token;
}

if (!accessToken) {
  console.error('No access token found. Run: firebase login');
  process.exit(1);
}

const corsConfig = {
  cors: [
    {
      origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://mwasobaddy.web.app',
        'https://mwasobaddy.firebaseapp.com'
      ],
      method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
      responseHeader: [
        'Content-Type',
        'Authorization',
        'Content-Length',
        'User-Agent',
        'x-goog-resumable'
      ],
      maxAgeSeconds: 3600
    }
  ]
};

const body = JSON.stringify(corsConfig);

// First, verify token by listing buckets so we know the exact name
const listOpts = {
  hostname: 'storage.googleapis.com',
  path: '/storage/v1/b?project=mwasobaddy',
  method: 'GET',
  headers: { 'Authorization': `Bearer ${accessToken}` }
};

https.get(listOpts, (res) => {
  let raw = '';
  res.on('data', c => raw += c);
  res.on('end', () => {
    const j = JSON.parse(raw);
    if (j.items) {
      console.log('Buckets found:', j.items.map(b => b.name));
    } else {
      console.log('List response:', raw.slice(0, 300));
    }
    applyCorsToBucket();
  });
});

function applyCorsToBucket() {const options = {
  hostname: 'storage.googleapis.com',
  path: '/storage/v1/b/mwasobaddy.appspot.com?fields=cors',
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ CORS configured successfully!');
      console.log(data);
    } else {
      console.error(`❌ Failed (HTTP ${res.statusCode}):`, data);
    }
  });
});

req.on('error', err => console.error('Request error:', err));
req.write(body);
req.end();
