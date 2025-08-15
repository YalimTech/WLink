import { Controller, Get, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';

@Controller('api/app')
export class IframeController {
  @Get('iframe-loader')
  serveIframeLoader(@Req() req: Request, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const encHeader = (req.headers['x-ghl-context'] as string) || (req.headers['x-lc-context'] as string) || '';
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authenticating...</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f6f7fb; color: #1f2937 }
          .container { text-align: center; }
          .loader { border: 4px solid #e5e7eb; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 16px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="loader"></div>
          <p>Authenticating securely…</p>
        </div>
        <script>
          const FRONTEND_URL = ${JSON.stringify(frontendUrl)};
          const BACKEND_API_URL = '/api/auth/start-session-from-iframe';
          const PRE_LOADED_ENC = ${JSON.stringify(encHeader)};

          function requestContext() {
            try { window.parent.postMessage({ type: 'WLINK_REQUEST_CONTEXT' }, '*'); } catch {}
          }

          function handleGHLResponse(event) {
            const origin = event.origin || '';
            let hostname = '';
            try { hostname = new URL(origin).hostname; } catch (e) { return; }
            const isTrustedOrigin = /(gohighlevel\\.com|highlevel\\.com|leadconnectorhq\\.com|msgsndr\\.com|leadconnector\\.com|ludicrous\\.cloud)$/.test(hostname);
            if (!isTrustedOrigin) return;

            const d = event.data || {};
            const encryptedData = d.encryptedData || d.context || d?.data?.encryptedData || d?.data?.context;
            if (encryptedData) {
              window.removeEventListener('message', handleGHLResponse);
              startSession(encryptedData);
            }
          }

          function startSession(encryptedData) {
            fetch(BACKEND_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ encryptedData })
            }).then(r => r.json()).then(data => {
              if (data && data.success && data.sessionToken) {
                window.location.replace(FRONTEND_URL + '/custom-page?token=' + encodeURIComponent(data.sessionToken));
              } else {
                document.body.innerHTML = '<div class="container"><p>Authentication failed. Please try again.</p></div>'
              }
            }).catch(() => {
              document.body.innerHTML = '<div class="container"><p>An error occurred. Please try again.</p></div>'
            })
          }

          window.addEventListener('message', handleGHLResponse);
          const intervalId = setInterval(requestContext, 1000);
          setTimeout(() => {
            clearInterval(intervalId);
            if (!/\\btoken=/.test(window.location.href)) {
              document.body.innerHTML = '<div class="container"><p>Authentication timed out. Please refresh and try again.</p></div>'
            }
          }, 25000);

          if (PRE_LOADED_ENC) {
            // Si GHL ya envió el contexto como header, usarlo al instante
            try { startSession(PRE_LOADED_ENC); } catch {}
          } else {
            // Solicitar inmediatamente si no hay header
            requestContext();
          }
        </script>
      </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  }
}


