import { getSupabase } from '@/lib/supabase';

import { PROJECT_URL as API_BASE } from './api';

export interface AttachmentLease {
  id: string;
  storage_key: string;
  upload_token: string;
  lease_until: string;
  name: string;
  mime_type: string;
  expected_size: number;
}

export interface Attachment {
  id: string;
  storage_key: string;
  name: string;
  mime_type: string;
  size?: number;
  expected_size: number;
  status: 'pending' | 'finalized' | 'cleanup_pending';
  entry_id?: string;
  field_id: string;
  project_id: number;
}

export async function createAttachmentLease(
  projectId: number,
  fieldId: string,
  file: File
): Promise<AttachmentLease> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(
    `${API_BASE}/service/attachments/projects/${projectId}/fields/${fieldId}/leases`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: file.name,
        mime_type: file.type,
        expected_size: file.size,
      }),
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create attachment lease');
  }
  return response.json();
}

export async function uploadAttachment(lease: AttachmentLease, file: File): Promise<void> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await getSupabase()
    .storage.from('field-attachments')
    .upload(lease.storage_key, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: lease.mime_type,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

export async function finalizeAttachment(
  attachmentId: string,
  entryId: string,
  uploadToken: string
): Promise<Attachment> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/attachments/${attachmentId}/finalize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ entryId, upload_token: uploadToken }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to finalize attachment');
  }
  return response.json();
}

export async function getAttachment(attachmentId: string): Promise<Attachment> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error('Attachment not found');
  return response.json();
}

export function getAttachmentDownloadUrl(storageKey: string): string {
  const { data } = getSupabase().storage.from('field-attachments').getPublicUrl(storageKey);
  return data.publicUrl;
}

export async function uploadAndFinalize(
  projectId: number,
  fieldId: string,
  entryId: string,
  file: File
): Promise<{ attachmentId: string }> {
  const lease = await createAttachmentLease(projectId, fieldId, file);
  await uploadAttachment(lease, file);
  const attachment = await finalizeAttachment(lease.id, entryId, lease.upload_token);
  return { attachmentId: attachment.id };
}
