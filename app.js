const DEFAULT_API_BASE = "http://localhost:8002";

let apiBase = localStorage.getItem("api_base") || DEFAULT_API_BASE;
let currentUser = null;
let currentSessionId = null;
let authToken = localStorage.getItem("auth_token") || "";

const loginOverlay = document.getElementById("loginOverlay");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const guestBtn = document.getElementById("guestBtn");
const loginOpenBtn = document.getElementById("loginOpenBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");
const apiBaseInput = document.getElementById("apiBaseInput");
const saveApiBtn = document.getElementById("saveApiBtn");
const statusEl = document.getElementById("status");
const sessionsList = document.getElementById("sessionsList");
const refreshSessionsBtn = document.getElementById("refreshSessionsBtn");
const newSessionBtn = document.getElementById("newSessionBtn");
const sessionTitle = document.getElementById("sessionTitle");
const sessionSubtitle = document.getElementById("sessionSubtitle");
const chatContainer = document.getElementById("chatContainer");
const chatForm = document.getElementById("chatForm");
const queryInput = document.getElementById("queryInput");
const sendBtn = document.getElementById("sendBtn");

apiBaseInput.value = apiBase;

function headers(extra = {}) {
  const value = { ...extra };
  if (authToken) value.Authorization = `Bearer ${authToken}`;
  return value;
}

function roleLabel(role) {
  return {
    mahasiswa: "Mahasiswa",
    admin: "Admin",
    public: "Tamu",
  }[role] || role || "Tamu";
}

function sessionStorageKey() {
  return currentUser ? `session_id_${currentUser.username}` : "session_id_guest";
}

function setUser(user) {
  currentUser = user;
  if (user) {
    userLabel.textContent = `${user.name} - ${roleLabel(user.role)}`;
    loginOpenBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    currentSessionId = localStorage.getItem(sessionStorageKey()) || null;
    loadSessions();
    return;
  }

  userLabel.textContent = "Tamu";
  loginOpenBtn.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
  currentSessionId = localStorage.getItem(sessionStorageKey()) || null;
  sessionsList.innerHTML = `<div class="empty-state">Login untuk melihat riwayat.</div>`;
}

function showLogin() {
  loginOverlay.classList.remove("hidden");
}

function hideLogin() {
  loginOverlay.classList.add("hidden");
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...options,
    headers: headers(options.headers || {}),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

async function checkAuth() {
  if (!authToken) {
    setUser(null);
    return;
  }

  try {
    const user = await requestJson("/api/auth/me");
    setUser(user);
  } catch {
    authToken = "";
    localStorage.removeItem("auth_token");
    setUser(null);
  }
}

async function checkHealth() {
  try {
    const data = await requestJson("/api/health");
    const parts = [
      data.database ? "DB OK" : "DB OFF",
      data.rag_core ? `Layanan ${data.rag_core_status || "OK"}` : "Layanan OFF",
    ];
    statusEl.textContent = parts.join(" - ");
    statusEl.className = `status ${data.status}`;
  } catch (error) {
    statusEl.textContent = `Backend tidak terhubung: ${error.message}`;
    statusEl.className = "status error";
  }
}

async function login(username, password) {
  const data = await requestJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  authToken = data.token;
  localStorage.setItem("auth_token", authToken);
  setUser(data);
  hideLogin();
}

async function logout() {
  try {
    await requestJson("/api/auth/logout", { method: "POST" });
  } catch {
    // Logout lokal tetap dilakukan walau server tidak reachable.
  }
  authToken = "";
  currentSessionId = null;
  localStorage.removeItem("auth_token");
  setUser(null);
  resetChat("Anda sudah keluar. Sesi tamu baru siap digunakan.");
}

function resetChat(message) {
  chatContainer.innerHTML = `
    <div class="message bot-message">
      <div class="message-content">${escapeHtml(message)}</div>
    </div>
  `;
  sessionTitle.textContent = "Chat Akademik";
  sessionSubtitle.textContent = "Tanyakan informasi akademik UNHAS.";
}

function newSession() {
  currentSessionId = null;
  localStorage.removeItem(sessionStorageKey());
  resetChat("Sesi baru dimulai. Ada yang ingin Anda tanyakan?");
  queryInput.focus();
  renderActiveSession();
}

async function loadSessions() {
  if (!currentUser) return;
  sessionsList.innerHTML = `<div class="empty-state">Memuat riwayat...</div>`;

  try {
    const data = await requestJson("/api/sessions");
    if (!data.sessions.length) {
      sessionsList.innerHTML = `<div class="empty-state">Belum ada riwayat chat.</div>`;
      return;
    }

    sessionsList.innerHTML = "";
    data.sessions.forEach((session) => {
      const item = document.createElement("div");
      item.className = `session-item ${session.id === currentSessionId ? "active" : ""}`;
      item.dataset.sessionId = session.id;
      item.innerHTML = `
        <button class="session-open" type="button">
          <span class="session-title">${escapeHtml(session.title || "Tanpa judul")}</span>
          <span class="session-meta">${session.message_count || 0} pesan</span>
        </button>
        <button class="session-delete" type="button" title="Hapus dari riwayat" aria-label="Hapus session ${escapeHtml(session.title || "Tanpa judul")}">Hapus</button>
      `;
      item.querySelector(".session-open").addEventListener("click", () => openSession(session.id));
      item.querySelector(".session-delete").addEventListener("click", () => deleteSession(session.id));
      sessionsList.appendChild(item);
    });
  } catch (error) {
    sessionsList.innerHTML = `<div class="empty-state">Gagal memuat riwayat: ${escapeHtml(error.message)}</div>`;
  }
}

async function openSession(sessionId) {
  if (!currentUser) return;

  try {
    const data = await requestJson(`/api/sessions/${sessionId}`);
    currentSessionId = data.id;
    localStorage.setItem(sessionStorageKey(), data.id);
    sessionTitle.textContent = data.title || "Chat Akademik";
    sessionSubtitle.textContent = `Session ${data.id}`;
    chatContainer.innerHTML = "";

    data.messages.forEach((message) => {
      addMessage(
        message.content,
        message.role === "assistant" ? "bot" : "user",
        message.sources || [],
        message.debug || null,
      );
    });

    renderActiveSession();
  } catch (error) {
    addMessage(`Gagal membuka session: ${error.message}`, "bot");
  }
}

async function deleteSession(sessionId) {
  if (!currentUser) return;
  if (!confirm("Hapus riwayat chat ini dari daftar Anda?")) return;

  try {
    await requestJson(`/api/sessions/${sessionId}`, { method: "DELETE" });

    if (sessionId === currentSessionId) {
      currentSessionId = null;
      localStorage.removeItem(sessionStorageKey());
      resetChat("Riwayat chat sudah dihapus dari daftar Anda. Sesi baru siap digunakan.");
    }

    await loadSessions();
  } catch (error) {
    addMessage(`Gagal menghapus session: ${error.message}`, "bot");
  }
}

function renderActiveSession() {
  document.querySelectorAll(".session-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.sessionId === currentSessionId);
  });
  loadSessions();
}

const MODE_LABELS = {
  rag: "Dokumen",
  rag_low_relevance: "Dokumen (low)",
  cache_hit: "Cache",
  chitchat: "Chitchat",
  out_of_scope: "Out of scope",
  blocked: "Blocked",
  blocked_moderation: "Blocked (mod)",
  clarification_needed: "Klarifikasi",
  get_info_private: "Private API",
};

function formatDebugBar(debug) {
  const mode = MODE_LABELS[debug.mode] || debug.mode || "unknown";
  const time = debug.total_time_s != null ? `${debug.total_time_s}s` : "?s";
  const intent = debug.intent ? ` - Intent: ${debug.intent}` : "";
  const score = debug.top_score != null ? ` - Score: ${debug.top_score}` : "";
  return `${mode} - ${time}${intent}${score}`;
}

function safeMd(text) {
  const escapedYears = String(text || "").replace(/\n\n(\d{4})\. /g, "\n\n$1\\. ");
  if (window.marked) return marked.parse(escapedYears);
  return escapeHtml(escapedYears);
}

function addMessage(content, type, sources = [], debug = null) {
  const message = document.createElement("div");
  message.className = `message ${type}-message`;

  let html = `<div class="message-content">${type === "bot" ? safeMd(content) : escapeHtml(content)}</div>`;

  if (debug) {
    html += `<div class="debug-bar">${escapeHtml(formatDebugBar(debug))}</div>`;
  }

  if (sources && sources.length > 0) {
    html += `<details class="sources"><summary>Sumber (${sources.length})</summary>`;
    sources.forEach((source, index) => {
      const meta = [
        source.page ? `Hal. ${source.page}` : "",
        source.chunk_index != null ? `Chunk #${source.chunk_index}` : "",
        source.element_type ? `[${source.element_type}]` : "",
      ].filter(Boolean).join(" - ");

      html += `
        <div class="source-item">
          <div class="source-header">
            <strong>${index + 1}. ${escapeHtml(source.file_name || "unknown")}</strong>
            <span class="source-score">Score: ${escapeHtml(String(source.score ?? "-"))}</span>
          </div>
          ${meta ? `<div class="source-meta">${escapeHtml(meta)}</div>` : ""}
          <div class="source-preview">${escapeHtml(source.text_preview || "")}</div>
        </div>
      `;
    });
    html += `</details>`;
  }

  message.innerHTML = html;
  chatContainer.appendChild(message);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return message;
}

async function sendMessage(query) {
  addMessage(query, "user");
  queryInput.value = "";
  sendBtn.disabled = true;

  const botMessage = document.createElement("div");
  botMessage.className = "message bot-message";
  const contentEl = document.createElement("div");
  contentEl.className = "message-content streaming";
  botMessage.appendChild(contentEl);
  chatContainer.appendChild(botMessage);

  const body = { query };
  if (currentSessionId) body.session_id = currentSessionId;

  let rawText = "";

  try {
    const response = await fetch(`${apiBase}/api/chat/stream`, {
      method: "POST",
      credentials: "include",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.detail || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop();

      for (const chunk of chunks) {
        if (!chunk.startsWith("data: ")) continue;
        const event = JSON.parse(chunk.slice(6));

        if (event.type === "session") {
          currentSessionId = event.session_id;
          localStorage.setItem(sessionStorageKey(), currentSessionId);
          sessionSubtitle.textContent = `Session ${currentSessionId}`;
        }

        if (event.type === "token") {
          rawText += event.delta || "";
          contentEl.textContent = rawText;
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        if (event.type === "meta") {
          const finalAnswer = event.answer || rawText;
          contentEl.classList.remove("streaming");
          contentEl.innerHTML = safeMd(finalAnswer);

          if (event.debug) {
            const debugEl = document.createElement("div");
            debugEl.className = "debug-bar";
            debugEl.textContent = formatDebugBar(event.debug);
            botMessage.appendChild(debugEl);
          }

          if (event.sources && event.sources.length) {
            const sourceHolder = document.createElement("div");
            sourceHolder.appendChild(buildSources(event.sources));
            botMessage.appendChild(sourceHolder.firstElementChild);
          }
        }

        if (event.type === "error") {
          contentEl.classList.remove("streaming");
          contentEl.textContent = `Error: ${event.message}`;
        }
      }
    }

    if (currentUser) loadSessions();
  } catch (error) {
    contentEl.classList.remove("streaming");
    contentEl.textContent = `Tidak dapat memproses chat: ${error.message}`;
  } finally {
    sendBtn.disabled = false;
    queryInput.focus();
  }
}

function buildSources(sources) {
  const wrapper = document.createElement("details");
  wrapper.className = "sources";
  wrapper.innerHTML = `<summary>Sumber (${sources.length})</summary>`;
  sources.forEach((source, index) => {
    const item = document.createElement("div");
    item.className = "source-item";
    item.innerHTML = `
      <div class="source-header">
        <strong>${index + 1}. ${escapeHtml(source.file_name || "unknown")}</strong>
        <span class="source-score">Score: ${escapeHtml(String(source.score ?? "-"))}</span>
      </div>
      <div class="source-preview">${escapeHtml(source.text_preview || "")}</div>
    `;
    wrapper.appendChild(item);
  });
  return wrapper;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.classList.add("hidden");
  loginBtn.disabled = true;
  loginBtn.textContent = "Masuk...";

  try {
    await login(
      document.getElementById("usernameInput").value.trim(),
      document.getElementById("passwordInput").value,
    );
  } catch (error) {
    loginError.textContent = error.message;
    loginError.classList.remove("hidden");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Masuk";
  }
});

guestBtn.addEventListener("click", () => {
  authToken = "";
  localStorage.removeItem("auth_token");
  hideLogin();
  setUser(null);
});

loginOpenBtn.addEventListener("click", showLogin);
logoutBtn.addEventListener("click", logout);
newSessionBtn.addEventListener("click", newSession);
refreshSessionsBtn.addEventListener("click", loadSessions);

saveApiBtn.addEventListener("click", () => {
  apiBase = apiBaseInput.value.trim().replace(/\/$/, "") || DEFAULT_API_BASE;
  localStorage.setItem("api_base", apiBase);
  checkHealth();
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (query) sendMessage(query);
});

checkAuth();
checkHealth();
