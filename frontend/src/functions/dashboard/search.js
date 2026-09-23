import { DASHBOARD_URL as url } from '../../lib/api';

async function safeFetch(endpoint, body) {
  let res;
  try {
    res = await fetch(url + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[API] Network error calling ${endpoint}:`, err);
    return { success: false, message: `Network error: ${err.message}` };
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(`[API] Invalid JSON from ${endpoint}:`, text.slice(0, 200));
    return { success: false, message: `Server returned status ${res.status}` };
  }

  if (!res.ok) {
    console.error(`[API] HTTP ${res.status} from ${endpoint}:`, data);
    return { success: false, message: data?.error || data?.message || `HTTP ${res.status}` };
  }

  return data;
}

export async function searchAll(user_email, keyword) {
  return safeFetch('/service/search', { function: 'searchAll', values: { user_email, keyword } });
}

export async function searchProject(user_email, project_name, keyword) {
  return safeFetch('/service/search', {
    function: 'searchProject',
    values: { user_email, project_name, keyword },
  });
}

export async function searchProjects(user_email, keyword) {
  return safeFetch('/service/search', {
    function: 'searchProjects',
    values: { user_email, keyword },
  });
}
