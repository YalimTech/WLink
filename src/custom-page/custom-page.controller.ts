import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Controller('app')
export class CustomPageController {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get('whatsapp')
  async getCustomPage(@Res() res: Response) {
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.send(this.generateCustomPageHTML());
  }

  @Post('decrypt-user-data')
  @HttpCode(HttpStatus.OK)
  async decryptUserData(
    @Body() body: { encryptedData: string },
    @Res() res: Response,
  ) {
    try {
      // --- CORRECCIÓN CRÍTICA ---
      // Se usa "GHL_SHARED_SECRET" para que coincida con las variables de entorno.
      const sharedSecret = this.configService.get<string>('GHL_SHARED_SECRET');
      if (!sharedSecret) {
        return res
          .status(400)
          .json({ error: 'Shared secret not configured on the server.' });
      }

      const decrypted = CryptoJS.AES.decrypt(
        body.encryptedData,
        sharedSecret,
      ).toString(CryptoJS.enc.Utf8);
      const userData = JSON.parse(decrypted);

      this.logger.log('Decrypted user data received.');

      const locationId =
        userData.activeLocation || userData.locationId || userData.companyId;

      if (!locationId) {
        return res
          .status(400)
          .json({ error: 'No location ID found in user data', userData });
      }

      const user = await this.prisma.findUser(locationId);

      return res.json({
        success: true,
        locationId,
        userData,
        user: user
          ? { id: user.id, hasTokens: !!(user.accessToken && user.refreshToken) }
          : null,
      });
    } catch (error) {
      this.logger.error('Error decrypting user data:', error);
      return res
        .status(400)
        .json({ error: 'Failed to decrypt user data', details: error.message });
    }
  }

  private generateCustomPageHTML(): string {
    const primaryColor = '#4A90E2';
    const secondaryColor = '#50E3C2';
    const gradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
    const gradientDarker = `linear-gradient(135deg, #3A7BC8 0%, #40C3A2 100%)`;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>WLink Bridge - Evolution API Integration</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f4f7f9; min-height: 100vh; padding: 20px; line-height: 1.6; }
          .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); overflow: hidden; min-height: calc(100vh - 40px); }
          .header { background: ${gradient}; color: white; padding: 40px 30px; text-align: center; }
          .logo-container { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 20px; }
          .logo { width: 60px; height: 60px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2)); }
          .header h1 { font-size: 2.5rem; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
          .header p { font-size: 1.2rem; opacity: 0.9; margin-top: 10px; }
          .content { padding: 40px; }
          .loading { text-align: center; padding: 80px 40px; color: #666; }
          .spinner { width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid ${primaryColor}; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 30px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .section { background: #f8f9fa; border-radius: 16px; padding: 30px; margin-bottom: 30px; border: 1px solid #e9ecef; }
          .section h2 { color: #2d3436; font-size: 1.5rem; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
          .form-group { margin-bottom: 20px; }
          .form-group label { display: block; font-weight: 600; color: #2d3436; margin-bottom: 8px; }
          .form-group input { width: 100%; padding: 14px 16px; border: 2px solid #e9ecef; border-radius: 10px; font-size: 16px; transition: all 0.3s ease; }
          .form-group input:focus { outline: none; border-color: ${primaryColor}; box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.2); }
          .btn { background: ${gradient}; color: white; padding: 14px 28px; border: none; border-radius: 10px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.3s ease; }
          .btn:hover { background: ${gradientDarker}; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(74, 144, 226, 0.3); }
          .btn:disabled { background: #bdc3c7; cursor: not-allowed; }
          .btn.danger { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); }
          .alert { padding: 16px 20px; border-radius: 10px; margin: 20px 0; font-weight: 500; border: none; }
          .alert.success { background: #d4edda; color: #155724; }
          .alert.error { background: #f8d7da; color: #721c24; }
          .alert.info { background: #d1ecf1; color: #0c5460; }
          .hidden { display: none; }
          .instances-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 25px; margin-top: 25px; }
          .instance-card { background: white; border-radius: 16px; padding: 25px; border: 1px solid #e9ecef; display: flex; flex-direction: column; justify-content: space-between; }
          .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; align-self: flex-start; margin-bottom: 15px; }
          .status-badge.authorized { background: #d4edda; color: #155724; }
          .status-badge.notAuthorized, .status-badge.blocked { background: #f8d7da; color: #721c24; }
          .instance-actions { display: flex; gap: 12px; margin-top: 20px; }
          .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; opacity: 0; visibility: hidden; transition: all 0.3s ease; }
          .modal-overlay.show { opacity: 1; visibility: visible; }
          .modal { background: white; border-radius: 16px; padding: 30px; max-width: 500px; width: 90%; text-align: left; }
          .modal h3 { margin-bottom: 15px; }
          .modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-container">
              <svg class="logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path fill="${primaryColor}" d="M50,2A48,48,0,1,1,2,50,48,48,0,0,1,50,2Z" style="stroke-width:4;stroke:white;"/><path d="M30 50 L70 50 M50 30 L50 70" stroke="white" stroke-width="8" stroke-linecap="round"/></svg>
              <h1>WLink Bridge</h1>
            </div>
            <p>Your Evolution API Integration for GoHighLevel</p>
          </div>
          <div class="content">
            <div id="loadingSection" class="loading"><div class="spinner"></div><p>Connecting to GoHighLevel...</p></div>
            <div id="errorSection" class="section hidden"><h2>❌ Connection Failed</h2><div id="errorMessage" class="alert error"></div></div>
            <div id="mainContent" class="hidden">
              <div class="section"><h2>📊 Connection Status</h2><div id="statusInfo"></div></div>
              <div id="instancesSection" class="section"><h2>📱 Your Evolution API Instances</h2><div id="instancesList" class="instances-grid"></div></div>
              <div class="section"><h2>➕ Add New Instance</h2>
                <form id="instanceForm">
                  <div class="form-group">
                    <label for="instanceId">Instance ID</label>
                    <input type="text" id="instanceId" name="instanceId" placeholder="e.g., 41ef815d-8c..." required>
                  </div>
                  <div class="form-group">
                    <label for="apiToken">API Token</label>
                    <input type="text" id="apiToken" name="apiToken" placeholder="Your Evolution API token" required>
                  </div>
                  <div class="form-group">
                    <label for="instanceName">Instance Nickname (optional)</label>
                    <input type="text" id="instanceName" name="instanceName" placeholder="e.g., Sales Team WhatsApp">
                  </div>
                  <button type="submit" id="submitBtn" class="btn">Add Instance</button>
                </form>
                <div id="formResult"></div>
              </div>
            </div>
          </div>
        </div>

        <div id="customModal" class="modal-overlay">
          <div class="modal">
            <h3 id="modalTitle">Confirmation</h3>
            <p id="modalBody">Are you sure?</p>
            <div class="modal-actions">
              <button id="modalCancel" class="btn danger">Cancel</button>
              <button id="modalConfirm" class="btn">OK</button>
            </div>
          </div>
        </div>

        <script>
          class ModalSystem {
              constructor() {
                  this.modal = document.getElementById('customModal');
                  this.title = document.getElementById('modalTitle');
                  this.body = document.getElementById('modalBody');
                  this.confirmBtn = document.getElementById('modalConfirm');
                  this.cancelBtn = document.getElementById('modalCancel');
                  this.resolvePromise = null;

                  this.confirmBtn.onclick = () => this.handleConfirm(true);
                  this.cancelBtn.onclick = () => this.handleConfirm(false);
                  this.modal.onclick = (e) => { if (e.target === this.modal) this.handleConfirm(false); };
              }

              show(body, title = 'Confirmation') {
                  this.title.textContent = title;
                  this.body.textContent = body;
                  this.modal.classList.add('show');
                  return new Promise(resolve => {
                      this.resolvePromise = resolve;
                  });
              }

              handleConfirm(value) {
                  this.modal.classList.remove('show');
                  if (this.resolvePromise) {
                      this.resolvePromise(value);
                      this.resolvePromise = null;
                  }
              }
          }

          class GHLApp {
            constructor() {
              this.userData = null;
              this.locationId = null;
              this.encryptedUserData = null;
              this.instances = [];
              this.modal = new ModalSystem();
              this.init();
            }

            init() {
              window.addEventListener('message', this.handleGHLMessage.bind(this));
              document.getElementById('instanceForm').addEventListener('submit', this.handleFormSubmit.bind(this));
              window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
              setTimeout(() => { if (!this.userData) this.showError('Timeout: No response from GoHighLevel iframe.'); }, 10000);
            }

            handleGHLMessage(event) {
              if (event.data?.message === 'REQUEST_USER_DATA_RESPONSE') {
                this.processUserData(event.data.payload);
              }
            }

            async processUserData(encryptedData) {
              if (!encryptedData) return this.showError('No encrypted user data received from GHL.');
              this.encryptedUserData = encryptedData;
              try {
                const response = await fetch('/app/decrypt-user-data', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ encryptedData })
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    return this.showError(result.error || 'Failed to process user data.');
                }
                
                this.userData = result.userData;
                this.locationId = result.locationId;
                this.showMainContent(result);

                if (result.user?.hasTokens) {
                  await this.loadInstances();
                }
              } catch (error) {
                this.showError('Network error while decrypting user data: ' + error.message);
              }
            }
            
            async makeApiRequest(url, options = {}) {
              const defaultOptions = {
                headers: {
                  'Content-Type': 'application/json',
                  'X-GHL-Context': this.encryptedUserData
                }
              };
              const mergedOptions = { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...options.headers } };
              const response = await fetch(url, mergedOptions);
              const result = await response.json();
              if (!response.ok) {
                  throw new Error(result.message || \`API request failed with status \${response.status}\`);
              }
              return result;
            }

            showError(message) {
              document.getElementById('loadingSection').classList.add('hidden');
              document.getElementById('errorSection').classList.remove('hidden');
              document.getElementById('errorMessage').textContent = message;
            }

            showMainContent(data) {
              document.getElementById('loadingSection').classList.add('hidden');
              document.getElementById('mainContent').classList.remove('hidden');
              const statusDiv = document.getElementById('statusInfo');
              if (data.user && data.user.hasTokens) {
                  statusDiv.innerHTML = '<div class="alert success">✅ Successfully connected to GoHighLevel.</div>';
              } else {
                  statusDiv.innerHTML = '<div class="alert error">❌ Not connected to GoHighLevel. Please re-install the app.</div>';
              }
            }

            async loadInstances() {
              try {
                const result = await this.makeApiRequest('/api/instances');
                if (result.success) {
                  this.instances = result.instances;
                  this.displayInstances();
                }
              } catch (error) {
                this.modal.show('Failed to load instances: ' + error.message, 'Error');
              }
            }

            displayInstances() {
              const list = document.getElementById('instancesList');
              if (!this.instances || this.instances.length === 0) {
                list.innerHTML = '<p>No instances configured yet. Add one below!</p>';
                return;
              }
              list.innerHTML = this.instances.map(inst => \`
                <div class="instance-card">
                  <div>
                    <div class="status-badge \${inst.state || 'notAuthorized'}">\${inst.state || 'Unknown'}</div>
                    <h4>\${inst.name || 'Unnamed Instance'}</h4>
                    <p>ID: \${inst.id}</p>
                  </div>
                  <div class="instance-actions">
                    <button class="btn danger" onclick="app.deleteInstance('\${inst.id}')">Delete</button>
                  </div>
                </div>
              \`).join('');
            }

            async handleFormSubmit(event) {
              event.preventDefault();
              const form = event.target;
              const submitBtn = form.querySelector('button');
              const resultDiv = document.getElementById('formResult');
              
              const payload = {
                locationId: this.locationId,
                instanceId: form.instanceId.value,
                apiToken: form.apiToken.value,
                name: form.instanceName.value
              };

              submitBtn.disabled = true;
              submitBtn.textContent = 'Adding...';
              resultDiv.innerHTML = '<div class="alert info">Creating instance...</div>';

              try {
                const result = await this.makeApiRequest('/api/instances', {
                  method: 'POST',
                  body: JSON.stringify(payload)
                });
                if (result.success) {
                  resultDiv.innerHTML = '<div class="alert success">✅ Instance added successfully!</div>';
                  form.reset();
                  await this.loadInstances();
                }
              } catch (error) {
                resultDiv.innerHTML = \`<div class="alert error">❌ \${error.message}</div>\`;
              } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Instance';
                setTimeout(() => { resultDiv.innerHTML = ''; }, 5000);
              }
            }
            
            async deleteInstance(instanceId) {
                const confirmed = await this.modal.show(\`Are you sure you want to delete the instance "\${instanceId}"? This action cannot be undone.\`);
                if (!confirmed) return;
                try {
                    await this.makeApiRequest(\`/api/instances/\${instanceId}\`, { method: 'DELETE' });
                    await this.loadInstances();
                } catch(error) {
                    this.modal.show('Failed to delete instance: ' + error.message, 'Error');
                }
            }
          }

          let app;
          document.addEventListener('DOMContentLoaded', () => {
            app = new GHLApp();
          });
        </script>
      </body>
      </html>
    `;
  }
}
