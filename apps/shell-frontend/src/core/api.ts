const API_BASE = "http://localhost:8080";

async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return { ok: false, error: "Invalid JSON response" };
  }
}

export async function workspacesList() {
  const r = await fetch(`${API_BASE}/api/workspaces`);
  return safeJson(r) as Promise<{ items: string[] }>;
}

export async function workspacesCreate(name: string) {
  const r = await fetch(`${API_BASE}/api/workspaces/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name }),
  });
  return safeJson(r) as Promise<{ ok: boolean }>;
}

export async function wsTree(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/tree?path=${encodeURIComponent(path)}`);
  return safeJson(r) as Promise<{ items: any[] }>;
}

export async function wsMkdir(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path }),
  });
  return safeJson(r);
}

export async function wsTouch(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/touch`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path }),
  });
  return safeJson(r);
}

export async function wsDelete(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path }),
  });
  return safeJson(r);
}

export async function wsRename(project: string, from: string, to: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ from, to }),
  });
  return safeJson(r);
}

export async function wsUpload(project: string, dir: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${API_BASE}/api/workspace/${project}/upload?dir=${encodeURIComponent(dir)}`, {
    method: "POST",
    body: fd,
  });
  return safeJson(r) as Promise<{ ok: boolean; path: string }>;
}

export async function wsList(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/list?path=${encodeURIComponent(path)}`);
  return safeJson(r) as Promise<{ items: string[] }>;
}

export async function wsRead(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/read?path=${encodeURIComponent(path)}`);
  return safeJson(r) as Promise<{ content: string }>;
}

export async function wsWrite(project: string, path: string, content: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/write`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path, content }),
  });
  return safeJson(r) as Promise<{ ok: boolean }>;
}

export async function startCompile(project: string) {
  const r = await fetch(`${API_BASE}/api/build/${project}/start`, { method: "POST" });
  return safeJson(r) as Promise<{ jobId: string }>;
}

export function streamUrl(jobId: string) {
  return `${API_BASE}/api/build/${jobId}/stream`;
}

/**
 * Clone repo (requires backend implementation)
 * Expected response:
 *  { ok: true, files: [{ path: "src/Main.ts", content: "..." }, ...] }
 * or { ok: false, error: "..." }
 */
export async function wsClone(project: string, repoUrl: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/clone`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ repoUrl }),
  });
  return safeJson(r) as Promise<{ ok: boolean; error?: string; files: Array<{ path: string; content: string }> }>;
}

export async function wsGist(project: string, gistUrl: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/gist`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ gistUrl }),
  });
  return r.json() as Promise<{
    ok: boolean;
    error?: string;
    files?: Array<{ path: string; content: string }>;
  }>;
}