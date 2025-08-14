// wlink/frontend/src/app/custom-page/page.tsx
'use client';
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';
import Script from 'next/script';

// --- Interfaces de Datos ---
interface Instance {
  id: string;
  instanceName: string;
  token: string;
  state: 'starting' | 'qr_code' | 'authorized' | 'notAuthorized' | 'blocked' | 'yellowCard' | 'disconnected' | string;
  customName?: string;
  createdAt: string;
  instanceId?: string;
}

interface GhlUserData {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  activeLocation?: string;
}

interface DecryptResponse {
  success: boolean;
  locationId?: string;
  userData?: GhlUserData;
  user?: {
    locationId: string;
    hasTokens: boolean;
  };
  message?: string;
}

interface ModalState {
  show: boolean;
  message: string;
  type: 'info' | 'success' | 'error' | 'confirm';
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
}

interface QrApiResponse {
  type: 'qr' | 'code';
  data: string;
}

export default function CustomPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <CustomPageContent />
    </Suspense>
  );
}

// Componente de estado de carga inicial
function LoadingState() {
  return (
    <div className="bg-gray-100 p-4 sm:p-6 min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full text-center">
        <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full text-blue-500" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <style jsx>{`
          .spinner-border {
            border-top-color: #3498db;
            border-right-color: transparent;
            border-bottom-color: transparent;
            border-left-color: transparent;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .visually-hidden {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border-width: 0;
          }
        `}</style>
        <h1 className="text-2xl font-bold text-gray-800 mt-4">Cargando...</h1>
        <p className="text-gray-600">Validando datos del usuario...</p>
      </div>
    </div>
  );
}

// Componente principal que contiene toda la lógica y UI
function CustomPageContent() {
  const searchParams = useSearchParams();
  const locationIdFromUrl = searchParams.get('locationId');


  const [locationId, setLocationId] = useState<string | null>(null);
  const [encrypted, setEncrypted] = useState<string | null>(null); // deprecated: postMessage flow no longer required
  const [instances, setInstances] = useState<Instance[]>([]);
  const [form, setForm] = useState({ instanceName: '', token: '', customName: '' });
  const [qr, setQr] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrDisplayContent, setQrDisplayContent] = useState<React.ReactNode>(null);
  const [modal, setModal] = useState<ModalState>({ show: false, message: '', type: 'info', onConfirm: null, onCancel: null });
  const [ghlUser, setGhlUser] = useState({ name: 'Cargando...', email: 'Cargando...', hasTokens: false });
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editingCustomName, setEditingCustomName] = useState('');
  const [pageStatus, setPageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [pageErrorMessage, setPageErrorMessage] = useState<string | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const mainIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrInstanceIdRef = useRef<string | null>(null);
  

  const showModal = useCallback((message: string, type: 'info' | 'success' | 'error' | 'confirm' = 'info', onConfirm: (() => void) | null = null, onCancel: (() => void) | null = null) => {
    setModal({ show: true, message, type, onConfirm, onCancel });
  }, []);

  const closeModal = useCallback(() => {
    setModal({ show: false, message: '', type: 'info', onConfirm: null, onCancel: null });
  }, []);

  // Nueva función: desencripta datos recibidos desde GHL y establece el estado de la página
  const decryptUserData = useCallback(async ({ encryptedData }: { encryptedData: string }) => {
    console.log('[WLINK_DEBUG] 6a. Enviando datos cifrados al backend para desencriptar...');
    try {
      const response = await axios.post<DecryptResponse>('/api/decrypt-user-data', { encryptedData });
      const data = response.data;
      if (data && data.success && data.locationId) {
        const name = data.userData?.fullName || [data.userData?.firstName, data.userData?.lastName].filter(Boolean).join(' ') || 'Usuario';
        const email = data.userData?.email || 'N/D';
        setLocationId(data.locationId);
        setGhlUser({ name, email, hasTokens: !!data.user?.hasTokens });
        setPageStatus('loaded');
        console.log('[WLINK_DEBUG] 6b. Datos procesados correctamente. locationId:', data.locationId);
      } else {
        setPageStatus('error');
        setPageErrorMessage('Los datos recibidos de GoHighLevel son inválidos.');
      }
    } catch (err: any) {
      console.error('[WLINK_DEBUG] Error desencriptando datos:', err);
      setPageStatus('error');
      setPageErrorMessage('Error al procesar datos de GoHighLevel: ' + (err.message || String(err)));
    }
  }, []);

  // Intenta bootstrap inmediato leyendo el contexto cifrado desde cookie o query param
  const tryBootstrapFromEncryptedData = useCallback(async (encryptedData: string): Promise<boolean> => {
    try {
      if (!encryptedData || encryptedData.length < 8) return false;
      const response = await axios.post<DecryptResponse>('/api/decrypt-user-data', { encryptedData });
      const data = response.data;
      if (data && data.success && data.locationId) {
        const name = data.userData?.fullName || [data.userData?.firstName, data.userData?.lastName].filter(Boolean).join(' ') || 'Usuario';
        const email = data.userData?.email || 'N/D';
        setLocationId(data.locationId);
        setGhlUser({ name, email, hasTokens: !!data.user?.hasTokens });
        setPageStatus('loaded');
        return true;
      }
      return false;
    } catch (e) {
      // Silencioso: si falla, retornamos false para permitir fallback al handshake
      return false;
    }
  }, []);

  const getCookie = useCallback((name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const value = (`; ${document.cookie}`).split(`; ${name}=`).pop();
    if (!value) return null;
    const raw = value.split(';').shift() || '';
    try {
      return decodeURIComponent(raw.replace(/^"|"$/g, ''));
    } catch {
      return raw.replace(/^"|"$/g, '');
    }
  }, []);

  const getEncryptedFromUrl = useCallback((): string | null => {
    const keys = ['encryptedData', 'x-ghl-context', 'ghl_context', 'ghlctx', 'x-lc-context', 'lc_context', 'lcctx', 'context'];
    for (const key of keys) {
      const v = searchParams.get(key);
      if (v) return v;
    }
    return null;
  }, [searchParams]);

  const makeApiRequest = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const baseUrl = '';
    const url = `${baseUrl}${path}${path.includes('?') ? '&' : '?'}locationId=${encodeURIComponent(locationId || '')}`;
    try {
      const response = await axios({
        url: url,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string> || {}),
        },
        data: options.body,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'API request failed';
      throw new Error(errorMessage);
    }
  }, [locationId]);

  const processUser = useCallback(async () => {
    try {
      if (locationIdFromUrl) {
        setPageStatus('loaded');
        setLocationId(locationIdFromUrl);
        setGhlUser((prev) => ({ ...prev, hasTokens: true }));
      }
    } catch (err: any) {
      setPageStatus('error');
      setPageErrorMessage('Falló la carga inicial: ' + err.message);
    }
  }, [locationIdFromUrl]);

  // Reemplazo del useEffect de inicialización: ahora incluye el handshake con GHL vía postMessage + polling
  useEffect(() => {
    // Si viene en la URL, usamos ese flujo y evitamos el handshake
    if (locationIdFromUrl) {
      processUser();
      return () => {
        if (mainIntervalRef.current) clearInterval(mainIntervalRef.current);
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }

    console.log('[WLINK_DEBUG] 1. Proceso de carga iniciado.');
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;

    // 0) Bootstrap: intenta leer el contexto cifrado desde URL o Cookie antes del handshake
    let handshakeStarted = false;
    const startHandshake = () => {
      handshakeStarted = true;
      const processContext = (data: any) => {
        console.log('[WLINK_DEBUG] 6. Contexto recibido, procesando datos...', data);
        if (data && data.encryptedData) {
          decryptUserData({ encryptedData: data.encryptedData });
        } else {
          setPageStatus('error');
          setPageErrorMessage('Los datos recibidos de GoHighLevel son inválidos.');
        }
      };

      const handleMessage = (event: MessageEvent) => {
        console.log('[WLINK_DEBUG] 5. Mensaje recibido:', event);
        const origin = event.origin || '';
        let hostname = '';
        try {
          hostname = new URL(origin).hostname;
        } catch (e) {
          return;
        }

        console.log(`[WLINK_DEBUG] 5a. Origen del mensaje: ${hostname}`);
        const isTrustedOrigin = /(gohighlevel\.com|highlevel\.com|leadconnectorhq\.com|msgsndr\.com|leadconnector\.com|ludicrous\.cloud)$/.test(hostname);

        if (!isTrustedOrigin) {
          console.warn(`[WLINK_DEBUG] 5b. >> MENSAJE IGNORADO: Origen no confiable: ${origin}`);
          return;
        }

        console.log('[WLINK_DEBUG] 5c. Origen CONFIABLE.');
        const payload = (event as MessageEvent).data as any;

        // Aceptar múltiples formatos posibles de mensaje desde GHL
        const candidateEncrypted =
          payload?.encryptedData ||
          payload?.data?.encryptedData ||
          payload?.context ||
          payload?.data?.context ||
          payload?.ghl_context ||
          payload?.data?.ghl_context ||
          payload?.ghlContext ||
          payload?.data?.ghlContext;

        if (candidateEncrypted) {
          console.log('[WLINK_DEBUG] 5d. ¡ÉXITO! Encrypted context detectado en payload.');
          clearTimeout(timeoutId);
          clearInterval(intervalId);
          window.removeEventListener('message', handleMessage);
          processContext({ encryptedData: String(candidateEncrypted) });
          return;
        }

        if (payload && payload.type === 'WLINK_CONTEXT' && payload.data) {
          console.log('[WLINK_DEBUG] 5d. ¡ÉXITO! Contexto recibido. Limpiando tareas...');
          clearTimeout(timeoutId);
          clearInterval(intervalId);
          window.removeEventListener('message', handleMessage);
          processContext(payload.data);
        } else {
          console.log('[WLINK_DEBUG] 5e. Mensaje de origen confiable, pero no es el contexto esperado.');
        }
      };

      timeoutId = setTimeout(() => {
        console.error('[WLINK_DEBUG] 7. ¡TIMEOUT! 15 segundos pasaron. No se recibió el contexto.');
        clearInterval(intervalId);
        window.removeEventListener('message', handleMessage);
        setPageStatus('error');
        setPageErrorMessage('Error de Acceso: No se recibieron datos de GoHighLevel a tiempo. Asegúrese de que la aplicación esté correctamente instalada.');
      }, 15000);
      console.log('[WLINK_DEBUG] 2. Temporizador de 15 segundos activado.');

      window.addEventListener('message', handleMessage);
      console.log('[WLINK_DEBUG] 3. Escuchando mensajes de GHL.');

      intervalId = setInterval(() => {
        console.log('[WLINK_DEBUG] 4. Pidiendo contexto a GHL...');
        try {
          // Enviar varias señales de solicitud de contexto para ser compatibles con distintos envs
          const requestTypes = ['WLINK_REQUEST_CONTEXT', 'GET_CONTEXT', 'REQUEST_CONTEXT', 'GHL_GET_CONTEXT', 'LEADCONNECTOR_GET_CONTEXT'];
          requestTypes.forEach((type) => {
            window.parent?.postMessage({ type }, '*');
          });
        } catch (e) {
          console.error('[WLINK_DEBUG] Error al intentar enviar postMessage:', e);
        }
      }, 1000);

      return () => {
        console.log('[WLINK_DEBUG] 8. Limpiando componente.');
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        window.removeEventListener('message', handleMessage);
        if (mainIntervalRef.current) clearInterval(mainIntervalRef.current);
        if (pollRef.current) clearInterval(pollRef.current);
      };
    };

    (async () => {
      // Prefer URL param first (e.g., if proxy injects it)
      const encFromUrl = getEncryptedFromUrl();
      if (encFromUrl) {
        const ok = await tryBootstrapFromEncryptedData(encFromUrl);
        if (ok) return; // Cargado sin handshake
      }

      // Then try cookie set by proxy from x-ghl-context
      const encFromCookie = getCookie('wlink_ghlctx') || getCookie('wlink_lcctx');
      if (encFromCookie) {
        const ok = await tryBootstrapFromEncryptedData(encFromCookie);
        if (ok) return; // Cargado sin handshake
      }

      // Finally, check if server exposed it via window global
      const encFromWindow = (typeof window !== 'undefined' && (window as any).__WLINK_GHL_ENC__) ? String((window as any).__WLINK_GHL_ENC__) : null;
      if (encFromWindow) {
        const ok = await tryBootstrapFromEncryptedData(encFromWindow);
        if (ok) return;
      }

      // Fallback to postMessage handshake if nothing else worked
      const cleanup = startHandshake();
      // store cleanup in closure via return of effect
      (startHandshake as any).cleanup = cleanup;
    })();

    return () => {
      console.log('[WLINK_DEBUG] 8. Limpiando componente.');
      if (handshakeStarted && (startHandshake as any).cleanup) {
        try { (startHandshake as any).cleanup(); } catch {}
      }
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      if (mainIntervalRef.current) clearInterval(mainIntervalRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [decryptUserData, processUser, locationIdFromUrl, getEncryptedFromUrl, getCookie, tryBootstrapFromEncryptedData]);

  const loadInstances = useCallback(async () => {
    if (!locationId) return;
    try {
      const data: { instances: Instance[] } = await makeApiRequest('/api/instances');
      setInstances(data.instances);

      if (showQr && qrInstanceIdRef.current) {
        const currentInstance = data.instances.find(inst => String(inst.id) === String(qrInstanceIdRef.current));
        if (currentInstance && currentInstance.state !== 'qr_code' && currentInstance.state !== 'starting') {
          console.log('Main polling: Closing QR modal as state is now ' + currentInstance.state + '.');
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setShowQr(false);
          setQr('');
          qrInstanceIdRef.current = null;
          if (currentInstance.state === 'authorized') {
            showModal('Instancia conectada exitosamente!', 'success');
          } else {
            showModal('La conexión de la instancia cambió de estado. Verifique el panel.', 'info');
          }
        } else if (!currentInstance) {
          console.log('Main polling: Closing QR modal as instance no longer exists.');
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setShowQr(false);
          setQr('');
          qrInstanceIdRef.current = null;
          showModal('La instancia ha sido eliminada o no existe.', 'error');
        }
      }
    } catch (e: any) {
      console.error('Failed to load instances in main polling:', e);
    }
  }, [locationId, makeApiRequest, showQr, showModal]);

  const createInstance = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId) {
      showModal('Error: No se ha cargado el Location ID. Intente recargar la página.', 'error');
      return;
    }
    try {
      const payload = {
        locationId,
        instanceName: form.instanceName,
        token: form.token,
        customName: form.customName,
      };
      await makeApiRequest('/api/instances', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showModal('Instancia creada exitosamente!', 'success');
      setForm({ instanceName: '', token: '', customName: '' });
      loadInstances();
    } catch (err: any) {
      console.error('Error creating instance:', err);
      showModal('Error al crear instancia: ' + err.message, 'error');
    }
  }, [form, locationId, makeApiRequest, loadInstances, showModal]);

  const generateQrFromString = useCallback(async (text: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !(window as any).QRCode) {
        console.error('QRCode library not loaded!');
        return reject(new Error('QRCode library not loaded'));
      }
      const container = document.createElement('div');
      new (window as any).QRCode(container, {
        text,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: (window as any).QRCode.CorrectLevel.H
      });
      setTimeout(() => {
        const img = container.querySelector('img') || container.querySelector('canvas');
        if (img) {
          const dataUrl = (img as HTMLCanvasElement).toDataURL ? (img as HTMLCanvasElement).toDataURL('image/png') : (img as HTMLImageElement).src;
          console.log('Generated QR from string successfully.');
          resolve(dataUrl);
        } else {
          console.error('Failed to find QR image/canvas in container after generation.');
          reject(new Error('Failed to generate QR image'));
        }
      }, 100);
    });
  }, []);

  const startPolling = useCallback((instanceId: string) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    qrInstanceIdRef.current = instanceId;
    pollRef.current = setInterval(async () => {
      try {
        const data: { instances: Instance[] } = await makeApiRequest('/api/instances');
        const updatedInstance = data.instances.find(inst => String(inst.id) === String(instanceId));
        setInstances(data.instances);
        if (updatedInstance) {
          if (updatedInstance.state !== 'qr_code' && updatedInstance.state !== 'starting') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setShowQr(false);
            setQr('');
            qrInstanceIdRef.current = null;
            if (updatedInstance.state === 'authorized') {
              showModal('Instancia conectada exitosamente!', 'success');
            } else {
              showModal('La conexión de la instancia cambió de estado. Verifique el panel.', 'info');
            }
          }
        } else {
          if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          setShowQr(false);
          setQr('');
          qrInstanceIdRef.current = null;
          showModal('La instancia ha sido eliminada o no existe.', 'error');
        }
      } catch (error) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setShowQr(false);
        setQr('');
        qrInstanceIdRef.current = null;
        showModal('Error al verificar estado del QR. Intente de nuevo.', 'error');
      }
    }, 2000);
  }, [makeApiRequest, showModal]);

  const connectInstance = useCallback(async (id: string) => {
    setQrLoading(true);
    setQr('');
    setShowQr(true);
    qrInstanceIdRef.current = id;
    try {
      const res: QrApiResponse = await makeApiRequest('/api/qr/' + id);
      if (res.type === 'qr') {
        const finalQrData = res.data.startsWith('data:image') ? res.data : 'data:image/png;base64,' + res.data;
        setQr(finalQrData);
      } else if (res.type === 'code') {
        const qrImage = await generateQrFromString(res.data);
        setQr(qrImage);
      } else {
        throw new Error('Unexpected QR response format. Type was: ' + res.type);
      }
      setQrLoading(false);
      startPolling(id);
    } catch (err: any) {
      setQrLoading(false);
      setQr('');
      setShowQr(false);
      qrInstanceIdRef.current = null;
      showModal('Error obteniendo QR: ' + err.message, 'error');
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [makeApiRequest, generateQrFromString, startPolling, showModal]);

  const logoutInstance = useCallback(async (id: string) => {
    showModal(
      '¿Estás seguro de que quieres desconectar esta instancia? Esto cerrará la sesión de WhatsApp y requerirá un nuevo escaneo de QR para reconectar.',
      'confirm',
      async () => {
        closeModal();
        try {
          await makeApiRequest('/api/instances/' + id + '/logout', { method: 'DELETE' });
          showModal('Comando de desconexión de instancia enviado. El estado se actualizará en breve y requerirá un nuevo escaneo.', 'success');
          loadInstances();
        } catch (err: any) {
          showModal('Error al desconectar: ' + err.message, 'error');
        }
      },
      () => closeModal()
    );
  }, [makeApiRequest, loadInstances, showModal, closeModal]);

  const deleteInstance = useCallback(async (id: string) => {
    showModal(
      '¿Estás seguro de que quieres ELIMINAR esta instancia? Esta acción es permanente y borrará la instancia de Evolution API y de la base de datos.',
      'confirm',
      async () => {
        closeModal();
        try {
          await makeApiRequest('/api/instances/' + id, { method: 'DELETE' });
          showModal('Instancia eliminada exitosamente!', 'success');
          loadInstances();
        } catch (err: any) {
          showModal('Error al eliminar instancia: ' + err.message, 'error');
        }
      },
      () => closeModal()
    );
  }, [makeApiRequest, loadInstances, showModal, closeModal]);

  const startEditingName = useCallback((instanceId: string, currentCustomName: string) => {
    setEditingInstanceId(instanceId);
    setEditingCustomName(currentCustomName);
  }, []);

  const saveEditedName = useCallback(async (instanceId: string) => {
    try {
      await makeApiRequest('/api/instances/' + instanceId, {
        method: 'PATCH',
        body: JSON.stringify({ customName: editingCustomName }),
      });
      showModal('Nombre de instancia actualizado exitosamente!', 'success');
      setEditingInstanceId(null);
      setEditingCustomName('');
      loadInstances();
    } catch (err: any) {
      console.error('Error al actualizar el nombre de la instancia:', err);
      showModal('Error al actualizar el nombre: ' + err.message, 'error');
    }
  }, [editingCustomName, makeApiRequest, loadInstances, showModal]);

  const cancelEditingName = useCallback(() => {
    setEditingInstanceId(null);
    setEditingCustomName('');
  }, []);

  const openConsole = useCallback((instanceId: string) => {
    showModal('Abriendo consola para la instancia: ' + instanceId + '.', 'info');
  }, [showModal]);

  useEffect(() => {
    if (locationId && pageStatus === 'loaded') {
      loadInstances();
      if (mainIntervalRef.current) clearInterval(mainIntervalRef.current);
      mainIntervalRef.current = setInterval(loadInstances, 3000);
    }
  }, [locationId, pageStatus, loadInstances]);

  useEffect(() => {
    console.log('QR useEffect triggered. showQr:', showQr, 'qr data present:', !!qr);
    if (showQr && qr && !qrLoading) {
      if (qr.startsWith('data:image')) {
                setQrDisplayContent(<Image src={qr} alt="QR Code" width={256} height={256} className="mx-auto max-w-full h-auto" />);
        console.log('QR rendered as image.');
      } else {
        console.error('Unexpected QR format in useEffect:', qr);
        setQrDisplayContent(<p className="text-red-500">Formato QR inesperado.</p>);
      }
    } else if (showQr && !qrLoading && !qr) {
      console.log('QR useEffect: showQr is true, but qr data is missing and not loading.');
      setQrDisplayContent(<p className="text-red-500">No se pudo cargar el código QR. Intente de nuevo.</p>);
    } else {
      setQrDisplayContent(null); // Clear content when QR modal is not shown or loading
    }
  }, [showQr, qr, qrLoading]);

  if (pageStatus === 'loading') {
    return (
      <div className="bg-gray-100 p-4 sm:p-6 min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full text-center">
          <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full text-blue-500" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <style jsx>{`
            .spinner-border {
              border-top-color: #3498db;
              border-right-color: transparent;
              border-bottom-color: transparent;
              border-left-color: transparent;
              animation: spin 0.8s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .visually-hidden {
              position: absolute;
              width: 1px;
              height: 1px;
              padding: 0;
              margin: -1px;
              overflow: hidden;
              clip: rect(0, 0, 0, 0);
              white-space: nowrap;
              border-width: 0;
            }
          `}</style>
          <h1 className="text-2xl font-bold text-gray-800 mt-4">Cargando...</h1>
          <p className="text-gray-600">Validando datos del usuario...</p>
        </div>
      </div>
    );
  }

  if (pageStatus === 'error') {
    return (
      <div className="bg-gray-100 p-4 sm:p-6 min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-red-500 text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Error de Acceso</h1>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-gray-700 text-sm">{pageErrorMessage || 'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.'}</p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                <i className="fas fa-info-circle text-blue-500 mr-2"></i>
                ¿Cómo acceder correctamente?
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>Asegúrate de tener instalada la aplicación WLink en tu cuenta de GoHighLevel</li>
                <li>Accede a la aplicación desde el menú de aplicaciones en GoHighLevel</li>
                <li>Si no tienes la aplicación instalada, contacta a tu administrador</li>
              </ol>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                <i className="fas fa-exclamation-triangle text-yellow-500 mr-2"></i>
                Posibles causas
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Acceso directo a la URL sin pasar por GoHighLevel</li>
                <li>Sesión expirada o permisos insuficientes</li>
                <li>Problema de configuración en la aplicación</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
            >
              <i className="fas fa-redo mr-2"></i>
              Reintentar
            </button>
            
            <button
              onClick={() => {
                // Intentar redirigir a GoHighLevel
                window.location.href = 'https://app.gohighlevel.com';
              }}
              className="w-full px-6 py-3 rounded-lg bg-gray-600 text-white font-semibold shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition duration-150 ease-in-out"
            >
              <i className="fas fa-external-link-alt mr-2"></i>
              Ir a GoHighLevel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 space-y-6 border border-gray-200 w-full max-w-3xl mx-auto my-8">
      <Script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js" strategy="lazyOnload" />

      <div className="flex flex-col items-center justify-center mb-6">
                <Image src="/wlink-icon.png" alt="WLink Icono" width={64} height={64} className="h-16 w-16 mb-2" />
        <h1 className="text-3xl font-bold text-center text-gray-800">WhatsApp Integration</h1>
        <p className="text-gray-500 text-center">Manage your instances with ease</p>
      </div>

      <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
          <i className="fas fa-signal text-blue-500 mr-2"></i> Estado de Conexión
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
          <div>
            <p><i className="fas fa-user text-gray-400 mr-2"></i> <strong>Usuario:</strong> {ghlUser.name}</p>
            <p><i className="fas fa-envelope text-gray-400 mr-2"></i> <strong>Email:</strong> {ghlUser.email}</p>
            <p><i className="fas fa-map-marker-alt text-gray-400 mr-2"></i> <strong>Location ID:</strong> {locationId || 'Cargando...'}</p>
          </div>
          <div>
            <p><i className="fas fa-shield-alt text-green-500 mr-2"></i> <strong>Estado OAuth:</strong></p>
            <p className="ml-6">
              {ghlUser.hasTokens ? (
                <><i className="fas fa-check-circle text-green-500 mr-2"></i> Autenticado y listo</>
              ) : (
                <><i className="fas fa-exclamation-triangle text-yellow-500 mr-2"></i> No Autenticado</>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
          <i className="fab fa-whatsapp text-green-500 mr-2"></i> Tus Instancias de WhatsApp
        </h2>
        <div className="space-y-4">
          {instances.length === 0 && <p className="text-gray-500 text-center py-4">Aún no hay instancias. ¡Agrega una arriba!</p>}

          {instances.map((inst) => (
            <div key={inst.id} className="flex flex-col sm:flex-row justify-between items-center p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
              <div className="text-center sm:text-left mb-3 sm:mb-0">
                <p className="text-sm text-gray-500">Instance Name: {inst.instanceName || 'N/A'}</p>
                {inst.instanceId && <p className="text-sm text-gray-500">Instance ID (GUID): {inst.instanceId}</p>}
                {editingInstanceId === inst.id ? (
                  <div className="flex flex-col items-center sm:items-start">
                    <input
                      type="text"
                      value={editingCustomName}
                      onChange={(e) => setEditingCustomName(e.target.value)}
                      className="font-semibold text-lg text-gray-800 border-b border-gray-300 focus:outline-none focus:border-indigo-500 mb-1"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => saveEditedName(inst.id)}
                        className="px-2 py-1 rounded-md bg-indigo-500 text-white text-sm"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={cancelEditingName}
                        className="px-2 py-1 rounded-md bg-gray-300 text-gray-800 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center sm:items-start">
                    <p className="font-semibold text-lg text-gray-800">
                      {inst.customName || 'Instancia Sin Nombre'}
                      <button
                        onClick={() => startEditingName(inst.id, inst.customName || '')}
                        className="ml-2 text-blue-500 hover:text-blue-700 text-sm"
                        title="Editar Nombre de Instancia"
                      >
                        <i className="fas fa-pencil-alt"></i>
                      </button>
                    </p>
                    <p className="text-sm text-gray-500">Creada: {new Date(inst.createdAt).toLocaleDateString()}</p>
                    <span
                      className={
                        "mt-2 inline-block text-xs px-3 py-1 rounded-full font-medium " +
                        (inst.state === 'authorized'
                          ? 'bg-green-100 text-green-800'
                          : inst.state === 'qr_code' || inst.state === 'starting'
                            ? 'bg-yellow-100 text-yellow-800'
                            : inst.state === 'notAuthorized'
                              ? 'bg-red-100 text-red-800'
                              : inst.state === 'yellowCard' || inst.state === 'blocked'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-200 text-gray-800')
                      }
                    >
                      {
                        showQr && String(qrInstanceIdRef.current) === String(inst.id)
                          ? 'Esperando Escaneo'
                          : inst.state === 'authorized'
                            ? 'Conectada'
                            : inst.state === 'notAuthorized'
                              ? 'Desconectada'
                              : inst.state === 'qr_code'
                                ? 'Esperando Escaneo (Fondo)'
                                : inst.state === 'starting'
                                  ? 'Conectando...'
                                  : inst.state === 'yellowCard' || inst.state === 'blocked'
                                    ? 'Error / Bloqueada'
                                    : inst.state || 'Desconocido'
                      }
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                <button
                  onClick={() => openConsole(inst.id)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                >
                  Abrir Consola
                </button>
                {inst.state === 'authorized' ? (
                  <button
                    onClick={() => logoutInstance(inst.id)}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-yellow-500 text-white font-semibold shadow-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition duration-150 ease-in-out"
                  >
                    Cerrar Sesión
                  </button>
                ) : (
                  <button
                    onClick={() => connectInstance(inst.id)}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-green-600 text-white font-semibold shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out"
                  >
                    Conectar
                  </button>
                )}
                <button
                  onClick={() => deleteInstance(inst.id)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-red-600 text-white font-semibold shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-150 ease-in-out"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
          <i className="fas fa-plus-circle text-green-500 mr-2"></i> Añadir Nueva Instancia
        </h2>
        <form onSubmit={createInstance} className="space-y-4">
          <div>
            <label htmlFor="instanceName" className="block text-sm font-medium text-gray-700">Nombre de Instancia (ID Único Evolution API)</label>
            <input
              type="text"
              id="instanceName"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={form.instanceName}
              onChange={(e) => setForm({ ...form, instanceName: e.target.value })}
              placeholder="Ej: 1234567890"
              required
            />
          </div>
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700">API Token</label>
            <input
              type="text"
              id="token"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
              placeholder="Tu token"
              required
            />
          </div>
          <div>
            <label htmlFor="customName" className="block text-sm font-medium text-gray-700">Nombre Personalizado de Instancia</label>
            <input
              type="text"
              id="customName"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={form.customName}
              onChange={(e) => setForm({ ...form, customName: e.target.value })}
              placeholder="Ej: WhatsApp Equipo de Ventas"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out"
          >
            Añadir Instancia
          </button>
        </form>
      </div>

      {showQr && (
        <div className="modal-overlay" onClick={() => {
          console.log('QR Overlay clicked: Closing QR modal.');
          setShowQr(false);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          setQr('');
          qrInstanceIdRef.current = null;
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Escanear Código QR</h2>
            {qrLoading ? (
              <div className="flex flex-col items-center justify-center h-48">
                <div className="spinner"></div>
                <p className="mt-4 text-gray-600 text-lg">Cargando QR...</p>
              </div>
            ) : qr ? (
              <div className="flex justify-center items-center h-64 w-64 mx-auto p-2 border border-gray-300 rounded-md bg-white">
                {qrDisplayContent}
              </div>
            ) : (
              <p className="text-red-500 text-lg">No se pudo cargar el código QR. Intente de nuevo.</p>
            )}
            <button
              onClick={() => {
                console.log('QR Close button clicked: Closing QR modal.');
                setShowQr(false);
                if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                setQr('');
                qrInstanceIdRef.current = null;
              }}
              className="mt-6 px-6 py-2 rounded-lg bg-gray-700 text-white font-semibold shadow-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition duration-150 ease-in-out"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {modal.show && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p className="text-lg font-medium mb-6 text-gray-700">{modal.message}</p>
            <div className="flex justify-center gap-4">
              {modal.type === 'confirm' && (
                <button
                  onClick={modal.onCancel || closeModal}
                  className="px-6 py-2 rounded-lg bg-gray-300 text-gray-800 font-semibold hover:bg-gray-400 transition duration-150 ease-in-out"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={modal.onConfirm || closeModal}
                className={"px-6 py-2 rounded-lg text-white font-semibold shadow-md transition duration-150 ease-in-out " + (
                  modal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                )}
              >
                {modal.type === 'confirm' ? 'Confirmar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


