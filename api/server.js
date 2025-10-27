// Import the TanStack Start server
import serverExports from '../dist/server/server.js';

// Get the fetch handler from the server exports
const { fetch: fetchHandler } = serverExports.default || serverExports;

export default async function handler(req, res) {
  try {
    // Construct full URL
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = new URL(req.url, `${protocol}://${host}`);

    // Create Web API Request from Vercel request
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
      }
    });

    // Handle request body
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = req.body;
      if (typeof body !== 'string' && body) {
        body = JSON.stringify(body);
      }
    }

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    // Call the TanStack Start fetch handler
    const response = await fetchHandler(request);

    // Set status and headers
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Stream response body
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }

    res.end();
  } catch (error) {
    console.error('[Server Error]:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
}
