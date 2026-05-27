const DEFAULT_LANGS = [
  { code: "zh-CN", name: "简体中文", flag: "🇨🇳" },
  { code: "zh-TW", name: "繁體中文", flag: "🇹🇼" },
  { code: "en-US", name: "English",  flag: "🇺🇸" },
  { code: "ja-JP", name: "日本語",   flag: "🇯🇵" },
  { code: "ko-KR", name: "한국어",   flag: "🇰🇷" },
  { code: "fr-FR", name: "Français", flag: "🇫🇷" },
];

const STORAGE_KEY_CUSTOM = "customLangs";
const STORAGE_KEY_CONFIG = "cookieConfig";

let currentTab = null;
let currentCookieValue = null;

async function init() {
  currentTab = await getCurrentTab();
  if (!currentTab?.url) {
    showToast("无法获取当前标签页", "error");
    return;
  }

  await loadConfig();
  currentCookieValue = await detectCurrentLang();
  renderCurrentLang();
  await renderLangList();
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function detectCurrentLang() {
  const config = await getConfig();
  const url = currentTab.url;
  try {
    const cookie = await chrome.cookies.get({ url, name: config.cookieName });
    return cookie?.value || null;
  } catch {
    return null;
  }
}

function renderCurrentLang() {
  const el = document.getElementById("currentLang");
  if (currentCookieValue) {
    el.textContent = currentCookieValue;
  } else {
    el.textContent = "未设置";
    el.style.color = "#999";
  }
}

async function renderLangList() {
  const container = document.getElementById("langList");
  container.innerHTML = "";
  const customLangs = await getCustomLangs();
  const allLangs = [...DEFAULT_LANGS, ...customLangs];

  for (const lang of allLangs) {
    const btn = document.createElement("button");
    btn.className = "lang-btn";
    if (currentCookieValue === lang.code) {
      btn.classList.add("active");
    }

    const isCustom = customLangs.some((c) => c.code === lang.code);

    btn.innerHTML = `
      <span class="flag">${lang.flag}</span>
      <span class="label">
        ${lang.name}
        <span class="code">${lang.code}</span>
      </span>
      ${isCustom ? `<button class="remove-btn" data-code="${lang.code}" title="删除">×</button>` : ""}
    `;

    btn.addEventListener("click", (e) => {
      if (e.target.classList.contains("remove-btn")) return;
      switchLang(lang.code);
    });

    const removeBtn = btn.querySelector(".remove-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeCustomLang(lang.code);
      });
    }

    container.appendChild(btn);
  }
}

async function switchLang(langCode) {
  const config = await getConfig();
  const url = currentTab.url;

  try {
    const urlObj = new URL(url);
    await chrome.cookies.set({
      url: `${urlObj.protocol}//${urlObj.host}`,
      name: config.cookieName,
      value: langCode,
      path: config.cookiePath,
    });

    currentCookieValue = langCode;
    renderCurrentLang();
    await renderLangList();
    showToast(`✅ 已切换至 ${langCode}`);

    if (config.autoReload) {
      chrome.tabs.reload(currentTab.id);
    }
  } catch (err) {
    showToast(`设置 cookie 失败: ${err.message}`, "error");
  }
}

// --- Custom Languages ---

async function getCustomLangs() {
  const data = await chrome.storage.local.get(STORAGE_KEY_CUSTOM);
  return data[STORAGE_KEY_CUSTOM] || [];
}

async function addCustomLang(code) {
  code = code.trim();
  if (!code) return;

  const allCodes = DEFAULT_LANGS.map((l) => l.code);
  const customs = await getCustomLangs();
  const customCodes = customs.map((l) => l.code);

  if (allCodes.includes(code) || customCodes.includes(code)) {
    showToast("该语言已存在", "error");
    return;
  }

  customs.push({ code, name: code, flag: "🏳️" });
  await chrome.storage.local.set({ [STORAGE_KEY_CUSTOM]: customs });
  await renderLangList();
  showToast(`已添加 ${code}`);
}

async function removeCustomLang(code) {
  let customs = await getCustomLangs();
  customs = customs.filter((l) => l.code !== code);
  await chrome.storage.local.set({ [STORAGE_KEY_CUSTOM]: customs });
  await renderLangList();
  showToast(`已删除 ${code}`);
}

// --- Config ---

async function getConfig() {
  const data = await chrome.storage.local.get(STORAGE_KEY_CONFIG);
  return data[STORAGE_KEY_CONFIG] || {
    cookieName: "lang",
    cookiePath: "/",
    autoReload: true,
  };
}

async function saveConfig() {
  const config = {
    cookieName: document.getElementById("cookieName").value || "lang",
    cookiePath: document.getElementById("cookiePath").value || "/",
    autoReload: document.getElementById("autoReload").checked,
  };
  await chrome.storage.local.set({ [STORAGE_KEY_CONFIG]: config });
}

async function loadConfig() {
  const config = await getConfig();
  document.getElementById("cookieName").value = config.cookieName;
  document.getElementById("cookiePath").value = config.cookiePath;
  document.getElementById("autoReload").checked = config.autoReload;
}

// --- Toast ---

function showToast(msg, type = "success") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 1500);
}

// --- Event Bindings ---

document.getElementById("addCustomBtn").addEventListener("click", () => {
  const input = document.getElementById("customLang");
  addCustomLang(input.value);
  input.value = "";
});

document.getElementById("customLang").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const input = document.getElementById("customLang");
    addCustomLang(input.value);
    input.value = "";
  }
});

document.getElementById("cookieName").addEventListener("change", saveConfig);
document.getElementById("cookiePath").addEventListener("change", saveConfig);
document.getElementById("autoReload").addEventListener("change", saveConfig);

init();
