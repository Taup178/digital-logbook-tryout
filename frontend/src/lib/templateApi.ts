import { getSupabase } from '@/lib/supabase';

const API_BASE =
  (import.meta.env.VITE_API_GATEWAY_URL || 'https://api-gateway.onrender.com') + '/api/project';

export interface Template {
  id: string;
  name: string;
  description?: string;
  fields: any[];
  scope: 'built_in' | 'personal' | 'global';
  version: number;
  is_fork: boolean;
  forked_from?: string;
  created_at?: string;
  updated_at?: string;
}

export async function listTemplates(
  scope: 'all' | 'built_in' | 'personal' | 'global' = 'all'
): Promise<Template[]> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Please sign in to load templates.');

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/service/templates?scope=${scope}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    throw new Error('Unable to reach the template service. Please try again.');
  }

  if (response.status === 401) throw new Error('Please sign in to load templates.');
  if (response.status === 404) {
    throw new Error('The template endpoint is unavailable (404). Please try again later.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const backendError = data?.error;
    if (
      [400, 403, 503].includes(response.status) &&
      typeof backendError === 'string' &&
      backendError.trim() &&
      !/[<>]/.test(backendError)
    ) {
      throw new Error(backendError.trim());
    }
    if (response.status === 400) throw new Error('Invalid template request.');
    if (response.status === 403)
      throw new Error('You do not have permission to load these templates.');
    if (response.status === 503) {
      throw new Error('The template service is unavailable. Please try again later.');
    }
    throw new Error(`Failed to load templates (HTTP ${response.status}). Please try again.`);
  }
  if (!Array.isArray(data?.templates)) {
    throw new Error('The template service returned an invalid response. Please try again.');
  }
  return data.templates;
}

export async function getTemplate(templateId: string): Promise<Template> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/templates/${templateId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error('Template not found');
  const data = await response.json();
  return data.template;
}

export async function createTemplate(input: {
  name: string;
  description?: string;
  fields: any[];
  scope?: 'personal' | 'global';
  forked_from?: string;
}): Promise<Template> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }
  const data = await response.json();
  return data.template;
}

export async function updateTemplate(
  templateId: string,
  input: {
    name?: string;
    description?: string;
    fields?: any[];
  }
): Promise<Template> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/templates/${templateId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update template');
  }
  const data = await response.json();
  return data.template;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/templates/${templateId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error('Failed to delete template');
}
