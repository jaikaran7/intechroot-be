import { createClient } from '@supabase/supabase-js';

// Service-role client — full access, for server-side only (never expose to frontend)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default supabaseAdmin;

// Storage helpers
export const STORAGE_BUCKET = 'intech-documents';

export async function uploadToStorage(buffer, path, mimeType) {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return data.path;
}

export async function getSignedUrl(storagePath, expiresInSeconds = 3600) {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw new Error(`Signed URL generation failed: ${error.message}`);
  return data.signedUrl;
}

export async function deleteFromStorage(storagePath) {
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
