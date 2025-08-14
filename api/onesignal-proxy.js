// /api/onesignal-proxy.js
// Production proxy for OneSignal API calls

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers for your frontend
  res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get the API key from server environment (secure)
    const apiKey = process.env.ONESIGNAL_API_KEY;
    
    if (!apiKey) {
      console.error('ONESIGNAL_API_KEY not found in server environment');
      return res.status(500).json({ error: 'Service configuration error' });
    }

    console.log('Proxying OneSignal request...');

    // Forward the request to OneSignal with secure API key
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    
    // Log success/failure (without sensitive data)
    if (response.ok) {
      console.log('OneSignal notification sent successfully via proxy');
    } else {
      console.error('OneSignal API error:', response.status, data);
    }
    
    // Return the same status and data as OneSignal
    return res.status(response.status).json(data);
    
  } catch (error) {
    console.error('OneSignal proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error'
    });
  }
}