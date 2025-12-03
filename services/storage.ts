
import { SoundEffect, GoogleConfig, UserInfo } from '../types';

// Declare global gapi and google types
declare const gapi: any;
declare const google: any;

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'SonicFlow_Library';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// --- Initialization ---

export const initGoogleServices = (config: GoogleConfig, onInit: () => void) => {
  if (!config.apiKey || !config.clientId) return;

  gapi.load('client', async () => {
    await gapi.client.init({
      apiKey: config.apiKey,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited = true;
    if (gisInited) onInit();
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: config.clientId,
    scope: SCOPES,
    callback: '', // defined at request time
  });
  gisInited = true;
  if (gapiInited) onInit();
};

export const handleLogin = (): Promise<UserInfo> => {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
      }
      // Fetch User Info manually via Drive 'about' or Oauth2 userinfo endpoint if scope allowed.
      // For simplicity, we just return a mock user or use the email if we had 'email' scope.
      // But Drive.File scope doesn't give email profile directly easily without extra permission.
      // We will assume success and use a generic user for now, or request 'profile' scope.
      
      resolve({
        name: 'Editor', // Placeholder, real app would fetch from People API
        email: 'Google Drive User',
        picture: 'https://ui-avatars.com/api/?name=Editor&background=0D8ABC&color=fff'
      });
    };

    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const handleLogout = () => {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
  }
};

// --- Drive Operations ---

async function getOrCreateFolder(): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
  const response = await gapi.client.drive.files.list({
    q: q,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (response.result.files.length > 0) {
    return response.result.files[0].id;
  } else {
    const fileMetadata = {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    };
    const folder = await gapi.client.drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });
    return folder.result.id;
  }
}

export const saveSoundToDrive = async (sound: SoundEffect, blob: Blob): Promise<SoundEffect> => {
  const folderId = await getOrCreateFolder();
  
  // Store metadata in the file description field as JSON string
  const { url, ...metaToStore } = sound;
  const description = JSON.stringify(metaToStore);

  const metadata = {
    name: sound.name + (sound.url.endsWith('.wav') ? '.wav' : '.mp3'),
    description: description,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const accessToken = gapi.client.getToken().access_token;
  
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });
  
  const data = await res.json();
  
  // Return updated sound with Drive ID
  return { ...sound, driveId: data.id };
};

export const loadLibraryFromDrive = async (): Promise<SoundEffect[]> => {
  const folderId = await getOrCreateFolder();
  
  // List files in the folder
  // We request 'description' because that's where we hid the metadata
  const response = await gapi.client.drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, description, webContentLink, size)',
    pageSize: 100,
  });

  const files = response.result.files;
  const library: SoundEffect[] = [];

  for (const file of files) {
    try {
      if (file.description) {
        const meta = JSON.parse(file.description);
        
        // IMPORTANT: For audio playback to work smoothly without public sharing,
        // we often need to download the blob via API using the auth token.
        // Direct 'webContentLink' often fails due to CORS or Auth on <audio> tags.
        // So we will lazy-load the blob or pre-load it. For this demo, let's fetch blob.
        
        const blob = await fetchFileBlob(file.id);
        const objectUrl = URL.createObjectURL(blob);

        library.push({
          ...meta,
          id: meta.id || file.id, // Fallback to drive ID if meta ID missing
          driveId: file.id,
          url: objectUrl, // Local playback URL
        });
      }
    } catch (e) {
      console.warn("Skipping file, could not parse SonicFlow metadata", file.name);
    }
  }

  return library;
};

async function fetchFileBlob(fileId: string): Promise<Blob> {
  const accessToken = gapi.client.getToken().access_token;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return await response.blob();
}

export const updateSoundInDrive = async (sound: SoundEffect): Promise<void> => {
  if (!sound.driveId) return;
  
  // We only update the description (metadata)
  const { url, driveId, ...metaToStore } = sound;
  const description = JSON.stringify(metaToStore);

  await gapi.client.drive.files.update({
    fileId: driveId,
    resource: { description: description }
  });
};

export const deleteSoundFromDrive = async (driveId: string): Promise<void> => {
  await gapi.client.drive.files.delete({
    fileId: driveId
  });
};
