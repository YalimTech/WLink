// wlink/frontend/src/app/custom-page/page.tsx
'use client';
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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

// Componente principal de la página, ahora envuelto en Suspense
export default function CustomPage() {
  return (
    <Suspense fallback={<LoadingState />}>
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
  const encryptedParam = searchParams.get('data');

  const [locationId, setLocationId] = useState<string | null>(null);
  const [encrypted, setEncrypted] = useState<string | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [form, setForm] = useState({ instanceName: '', token: '', customName: '' });
  const [qr, setQr] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>({ show: false, message: '', type: 'info', onConfirm: null, onCancel: null });
  const [ghlUser, setGhlUser] = useState({ name: 'Cargando...', email: 'Cargando...', hasTokens: false });
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editingCustomName, setEditingCustomName] = useState('');
  const [pageStatus, setPageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [pageErrorMessage, setPageErrorMessage] = useState<string | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const mainIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrInstanceIdRef = useRef<string | null>(null);
  const qrCodeDivRef = useRef<HTMLDivElement>(null);

  const showModal = useCallback((message: string, type: 'info' | 'success' | 'error' | 'confirm' = 'info', onConfirm: (() => void) | null = null, onCancel: (() => void) | null = null) => {
    setModal({ show: true, message, type, onConfirm, onCancel });
  }, []);

  const closeModal = useCallback(() => {
    setModal({ show: false, message: '', type: 'info', onConfirm: null, onCancel: null });
  }, []);

  const makeApiRequest = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    if (!encrypted) {
      throw new Error('No GHL context (encrypted data) available for API request.');
    }
    const baseUrl = '';
    const url = `${baseUrl}${path}`;
    try {
      const response = await axios({
        url: url,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-GHL-Context': encrypted,
          ...options.headers,
        },
        data: options.body,
      });
      console.log(`API request to ${path} successful. Response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`API request to ${path} failed. Status: ${error.response?.status}. Response:`, error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || error.message || 'API request failed';
      throw new Error(errorMessage);
    }
  }, [encrypted]);

  const processUser = useCallback(async (encData: string) => {
    try {
      setPageStatus('loading');
      setPageErrorMessage(null);
      // CORREGIDO: Usar '/api/decrypt-user-data' para coincidir con la configuración de Nginx.
      const res: DecryptResponse = await makeApiRequest('/api/decrypt-user-data', {
        method: 'POST',
        body: JSON.stringify({ encryptedData: encData }),
      });
      if (res.success && res.locationId && res.userData) {
        setEncrypted(encData);
        setLocationId(res.locationId);
        setGhlUser({
          name: res.userData.fullName || `${res.userData.firstName || ''} ${res.userData.lastName || ''}`.trim() || 'Usuario Desconocido',
          email: res.userData.email || 'N/A',
          hasTokens: res.user ? res.user.hasTokens : false,
        });
        setPageStatus('loaded');
        console.log('User data decrypted and locationId set:', res.locationId);
      } else {
        setPageStatus('error');
        setPageErrorMessage(res.message || 'Datos de usuario inválidos recibidos.');
        showModal('Error al cargar datos de usuario: ' + (res.message || 'Datos inválidos.'), 'error');
      }
    } catch (err: any) {
      setPageStatus('error');
      setPageErrorMessage('Falló la carga de datos de usuario: ' + err.message);
      showModal('Falló la carga de datos de usuario. Asegúrate de que la aplicación esté instalada correctamente. ' + err.message, 'error');
      console.error('Error processing user data:', err);
    }
  }, [makeApiRequest, showModal]);

  const loadInstances = useCallback(async () => {
    if (!locationId) return;
    try {
      const data: { instances: Instance[] } = await makeApiRequest('/api/instances');
      setInstances(data.instances);
      console.log('Main polling: Instances loaded:', data.instances);

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
          console.log('QR polling for ' + instanceId + ': Fetched state ' + updatedInstance.state);
          if (updatedInstance.state !== 'qr_code' && updatedInstance.state !== 'starting') {
            console.log('QR polling: State ' + updatedInstance.state + ' detected, closing QR modal.');
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
          console.log('QR polling: Instance ' + instanceId + ' not found in fetched data, stopping polling and closing QR.');
          if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          setShowQr(false);
          setQr('');
          qrInstanceIdRef.current = null;
          showModal('La instancia ha sido eliminada o no existe.', 'error');
        }
      } catch (error) {
        console.error('Error during QR polling:', error);
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
      console.log('Attempting to fetch QR for instance ID: ' + id);
      const res = await makeApiRequest('/api/qr/' + id);
      console.log('QR API response for ' + id + ':', res);
      console.log('QR response type: ' + res.type + ', data starts with: ' + (res.data ? res.data.substring(0, 50) : 'N/A'));
      if (res.type === 'qr') {
        const finalQrData = res.data.startsWith('data:image') ? res.data : 'data:image/png;base64,' + res.data;
        setQr(finalQrData);
        console.log('QR type received. Setting QR data. Starts with data:image: ' + finalQrData.startsWith('data:image'));
      } else if (res.type === 'code') {
        console.log('Code type received. Generating QR from text: ' + res.data);
        const qrImage = await generateQrFromString(res.data);
        setQr(qrImage);
      } else {
        throw new Error('Unexpected QR response format. Type was: ' + res.type);
      }
      setQrLoading(false);
      startPolling(id);
    } catch (err: any) {
      setQrLoading(false);
      console.error('Error obtaining QR:', err);
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
          console.log('Attempting to logout instance ID: ' + id);
          await makeApiRequest('/api/instances/' + id + '/logout', { method: 'DELETE' });
          console.log('Instance ' + id + ' logout command sent successfully. Reloading instances...');
          showModal('Comando de desconexión de instancia enviado. El estado se actualizará en breve y requerirá un nuevo escaneo.', 'success');
          loadInstances();
        } catch (err: any) {
          console.error('Error disconnecting instance:', err);
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
          console.log('Attempting to delete instance ID: ' + id);
          await makeApiRequest('/api/instances/' + id, { method: 'DELETE' });
          console.log('Instance ' + id + ' delete command sent. Reloading instances...');
          showModal('Instancia eliminada exitosamente!', 'success');
          loadInstances();
        } catch (err: any) {
          console.error('Error deleting instance:', err);
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
    showModal('Abriendo consola para la instancia: ' + instanceId + '. (Funcionalidad pendiente de implementación/redirección específica).', 'info');
  }, [showModal]);

  useEffect(() => {
    if (encryptedParam) {
      processUser(encryptedParam);
    } else {
      setPageStatus('error');
      setPageErrorMessage('No se encontraron datos encriptados en la URL. Esta página debe ser accedida a través de GoHighLevel.');
    }
    return () => {
      if (mainIntervalRef.current) clearInterval(mainIntervalRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [encryptedParam, processUser]);

  useEffect(() => {
    if (locationId && pageStatus === 'loaded') {
      loadInstances();
      if (mainIntervalRef.current) clearInterval(mainIntervalRef.current);
      mainIntervalRef.current = setInterval(loadInstances, 3000);
    }
  }, [locationId, pageStatus, loadInstances]);

  useEffect(() => {
    console.log('QR useEffect triggered. showQr:', showQr, 'qr data present:', !!qr, 'qrCodeDivRef.current:', qrCodeDivRef.current);
    if (showQr && qr && qrCodeDivRef.current && !qrLoading) {
      qrCodeDivRef.current.innerHTML = '';
      if (qr.startsWith('data:image')) {
        const img = document.createElement('img');
        img.src = qr;
        img.className = "mx-auto max-w-full h-auto";
        qrCodeDivRef.current.appendChild(img);
        console.log('QR rendered as image.');
      } else {
        console.error('Unexpected QR format in useEffect:', qr);
        if (qrCodeDivRef.current) {
          qrCodeDivRef.current.innerHTML = '<p class="text-red-500">Formato QR inesperado.</p>';
        }
      }
    } else if (showQr && !qrLoading && !qr) {
      console.log('QR useEffect: showQr is true, but qr data is missing and not loading.');
      if (qrCodeDivRef.current) {
        qrCodeDivRef.current.innerHTML = '<p class="text-red-500">No se pudo cargar el código QR. Intente de nuevo.</p>';
      }
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
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full text-center">
          <div className="text-red-500 text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Error al cargar la página</h1>
          <p className="text-gray-600">{pageErrorMessage || 'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 space-y-6 border border-gray-200 w-full max-w-3xl mx-auto my-8">
      <Script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js" strategy="lazyOnload" />

      <div className="flex flex-col items-center justify-center mb-6">
        <img src="/wlink-icon.png" alt="WLink Icono" className="h-16 w-16 mb-2" />
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
                <div ref={qrCodeDivRef} className="w-full h-full flex items-center justify-center"></div>
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


