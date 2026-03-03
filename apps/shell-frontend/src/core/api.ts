const API_BASE = "http://localhost:8080";

export async function workspacesList() {
  const r = await fetch(`${API_BASE}/api/workspaces`);
  return r.json() as Promise<{ items: string[] }>;
}
export async function workspacesCreate(name: string) {
  const r = await fetch(`${API_BASE}/api/workspaces/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name }),
  });
  return r.json() as Promise<{ ok: boolean }>;
}

export async function wsTree(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/tree?path=${encodeURIComponent(path)}`);
  return r.json() as Promise<{ items: any[] }>;
}

export async function wsMkdir(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path }),
  });
  return r.json();
}

export async function wsTouch(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/touch`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path }),
  });
  return r.json();
}

export async function wsDelete(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path }),
  });
  return r.json();
}

export async function wsRename(project: string, from: string, to: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ from, to }),
  });
  return r.json();
}

export async function wsUpload(project: string, dir: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${API_BASE}/api/workspace/${project}/upload?dir=${encodeURIComponent(dir)}`, {
    method: "POST",
    body: fd,
  });
  return r.json() as Promise<{ ok: boolean; path: string }>;
}

export async function wsList(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/list?path=${encodeURIComponent(path)}`);
  return r.json() as Promise<{ items: string[] }>;
}

export async function wsRead(project: string, path: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/read?path=${encodeURIComponent(path)}`);
  return r.json() as Promise<{ content: string }>;
}

export async function wsWrite(project: string, path: string, content: string) {
  const r = await fetch(`${API_BASE}/api/workspace/${project}/write`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ path, content })
  });
  return r.json() as Promise<{ ok: boolean }>;
}

export async function startCompile(project: string) {
  const r = await fetch(`${API_BASE}/api/build/${project}/start`, { method: "POST" });
  return r.json() as Promise<{ jobId: string }>;
}

export function streamUrl(jobId: string) {
  return `${API_BASE}/api/build/${jobId}/stream`;
}
