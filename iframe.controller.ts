import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('api/app')
export class IframeController {
  @Get('iframe-loader')
  serveIframeLoader(@Res() res: Response) {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authenticating...</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
          .container { text-align: center; }
          .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="loader"></div>
          <p>Authenticating securely...</p>
        </div>
        <script>
          const FRONTEND_URL = 'https://<tu-frontend.com>'; // Replace with your frontend URL
          const BACKEND_API_URL = '/api/auth/start-session-from-iframe';

          function requestContext() {
            console.log('Requesting context from GoHighLevel...');
            window.parent.postMessage({ type: 'WLINK_REQUEST_CONTEXT' }, '*');
          }

          function handleGHLResponse(event) {
            const origin = event.origin || '';
            let hostname = '';
            try { hostname = new URL(origin).hostname; } catch (e) { return; }
            const isTrustedOrigin = /(gohighlevel\\.com|highlevel\\.com|leadconnectorhq\\.com|msgsndr\\.com|leadconnector\\.com|ludicrous\\.cloud)$/.test(hostname);

            if (!isTrustedOrigin) return;

            const encryptedData = event.data?.encryptedData || event.data?.context;

            if (encryptedData) {
              console.log('Received encrypted context from GoHighLevel.');
              window.removeEventListener('message', handleGHLResponse);
              
              fetch(BACKEND_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encryptedData })
              })
              .then(response => response.json())
              .then(data => {
                if (data.success && data.sessionToken) {
                  console.log('Session token received. Redirecting to Next.js app within iframe...');
                  window.location.href = \`\${FRONTEND_URL}/custom-page?token=\${data.sessionToken}\`;
                } else {
                  document.body.innerHTML = '<div class="container"><p>Authentication failed. Please try again.</p></div>';
                  console.error('Failed to get session token:', data);
                }
              })
              .catch(error => {
                document.body.innerHTML = '<div class="container"><p>An error occurred. Please try again.</p></div>';
                console.error('Error starting session:', error);
              });
            }
          }

          window.addEventListener('message', handleGHLResponse);
          
          // Request context immediately and retry every second
          const intervalId = setInterval(requestContext, 1000);
          
          // Stop trying after 15 seconds
          setTimeout(() => {
            clearInterval(intervalId);
             if (!window.location.href.includes('token=')) {
                document.body.innerHTML = '<div class="container"><p>Authentication timed out. Please refresh and try again.</p></div>';
             }
          }, 15000);

        </script>
      </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  }
}
