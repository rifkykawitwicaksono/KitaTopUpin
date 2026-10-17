const DATA_URL = new URL("./data.json", import.meta.url);
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const state = {
  data: null, category: "all", search: "", activeGame: null,
  denominationId: null, paymentId: null, validated: false, currentInvoice: null, heroIndex: 0
};

const money = value => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(value || 0);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[char]));
const byId = (items, id) => items.find(item => item.id === id);
const selectedGame = () => state.activeGame;
const selectedDenomination = () => selectedGame()?.denominations.find(item => item.id === state.denominationId);
const selectedPayment = () => byId(state.data.paymentMethods, state.paymentId);
const toast = message => {
  const element = $("#toast");
  element.textContent = message;
  element.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.add("hidden"), 2600);
};
const openModal = id => {
  $("#" + id).classList.remove("hidden");
  document.body.classList.add("modal-open");
};
const closeModal = id => {
  $("#" + id).classList.add("hidden");
  if (!$$(".modal-backdrop").some(el => !el.classList.contains("hidden"))) document.body.classList.remove("modal-open");
};
const formatLabel = id => state.data.categories.find(category => category.id === id)?.label || id;

async function init() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    applyStoreBranding();
    renderHero();
    renderCategories();
    renderCatalog();
    renderPayments();
    bindEvents();
    $("#year").textContent = new Date().getFullYear();
    restoreTheme();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<main class="mx-auto max-w-2xl p-8"><h1 class="text-2xl font-bold">Data tidak bisa dimuat</h1><p class="mt-3">Jalankan website melalui server lokal (misalnya VS Code Live Server), bukan membuka file HTML langsung. Pastikan <code>assets/js/data.json</code> tersedia.</p></main>`;
  }
}

function applyStoreBranding() {
  const { store } = state.data;
  document.title = `${store.name} — Top Up Game & Voucher Digital`;
  $("#store-name").textContent = store.name;
  $("#footer-name").textContent = store.name;
  $("#logo-mark").textContent = store.logoText || store.name.slice(0, 2).toUpperCase();
  $("#announcement").textContent = store.announcement || store.tagline;
}

function renderHero() {
  $("#hero-track").innerHTML = state.data.banners.map((banner, index) => `
    <article class="hero-slide hero-${escapeHtml(banner.theme || "purple")} ${index === 0 ? "is-active" : ""}" data-slide="${index}">
      <div class="hero-copy"><span class="hero-eyebrow">${escapeHtml(banner.eyebrow)}</span>
        <h2>${escapeHtml(banner.title)}</h2><p>${escapeHtml(banner.description)}</p>
        <div class="mt-5 flex flex-wrap items-center gap-3"><span class="hero-pill">${escapeHtml(banner.badge || "Promo")}</span>
        <button class="hero-cta" data-hero-game="${escapeHtml(banner.gameId || "")}">${escapeHtml(banner.cta || "Lihat katalog")} <span>↗</span></button></div>
      </div>
      <div class="hero-visual" aria-hidden="true"><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div><div class="hero-glow"></div><div class="hero-game-mark">${escapeHtml(byId(state.data.games, banner.gameId)?.emoji || "✦")}</div><div class="hero-mini-card">${escapeHtml(byId(state.data.games, banner.gameId)?.shortName || "Digital")}</div></div>
      <div class="hero-number">0${index + 1}</div>
    </article>`).join("");
  $("#hero-dots").innerHTML = state.data.banners.map((_, index) => `<button class="hero-dot ${index === 0 ? "active" : ""}" aria-label="Promo ${index + 1}" data-hero-index="${index}"></button>`).join("");
}

function showHero(index) {
  const count = state.data.banners.length;
  state.heroIndex = (index + count) % count;
  $$(".hero-slide").forEach((slide, i) => slide.classList.toggle("is-active", i === state.heroIndex));
  $$(".hero-dot").forEach((dot, i) => dot.classList.toggle("active", i === state.heroIndex));
}

function renderCategories() {
  $("#category-filters").innerHTML = state.data.categories.map(category => `
    <button class="filter-chip ${state.category === category.id ? "active" : ""}" data-category="${escapeHtml(category.id)}">${escapeHtml(category.label)}</button>`).join("");
}

function renderCatalog() {
  const query = state.search.trim().toLowerCase();
  const products = state.data.games.filter(game => {
    const categoryMatch = state.category === "all" || game.category === state.category;
    const searchMatch = !query || `${game.name} ${game.shortName} ${game.publisher} ${game.currencyName}`.toLowerCase().includes(query);
    return categoryMatch && searchMatch;
  });
  $("#catalog-count").textContent = `${products.length} produk`;
  $("#empty-state").classList.toggle("hidden", products.length > 0);
  $("#catalog-grid").innerHTML = products.map(game => `
    <button class="product-card text-left" data-game-id="${escapeHtml(game.id)}" aria-label="Top-up ${escapeHtml(game.name)}">
      <div class="product-art" style="--game-color:${escapeHtml(game.color)}">
        <span class="product-emoji">${escapeHtml(game.emoji || "✦")}</span>
        ${game.badge ? `<span class="product-badge badge-${escapeHtml(game.badgeType || "hot")}">${escapeHtml(game.badge)}</span>` : ""}
        <span class="art-orb"></span><span class="art-lines"></span>
      </div>
      <div class="p-3.5 sm:p-4"><p class="text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">${escapeHtml(game.publisher)}</p><h3 class="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm font-extrabold leading-5">${escapeHtml(game.name)}</h3><p class="mt-2 text-xs text-slate-500">${escapeHtml(game.currencyName)}</p>
        <div class="mt-3 flex items-center justify-between gap-2"><span class="text-[11px] font-semibold text-brand-600 dark:text-violet-300">Lihat nominal</span><span class="text-lg text-slate-400 transition group-hover:translate-x-1">↗</span></div>
      </div>
    </button>`).join("");
}

function renderAccountFields() {
  const game = selectedGame();
  const voucher = game.type === "voucher";
  $("#account-fields").innerHTML = voucher
    ? `<label class="form-label sm:col-span-2">Email / ID akun (opsional)<input id="account-user" class="field mt-1.5" placeholder="Masukkan email atau ID akun" autocomplete="off"></label>`
    : `<label class="form-label">User ID <span class="text-rose-500">*</span><input id="account-user" class="field mt-1.5" placeholder="Contoh: 123456789" required inputmode="numeric" autocomplete="off"></label>
       <label class="form-label">Zone / Server ID ${["mlbb","genshin","hsr","wuwa","zzz"].includes(game.id) ? '<span class="text-rose-500">*</span>' : '<span class="text-slate-400">(jika ada)</span>'}<input id="account-zone" class="field mt-1.5" placeholder="Contoh: 1234" ${["mlbb","genshin","hsr","wuwa","zzz"].includes(game.id) ? "required" : ""} autocomplete="off"></label>`;
}

function renderDenominations() {
  $("#denomination-grid").innerHTML = selectedGame().denominations.map((item, index) => `
    <button type="button" class="denom-card ${state.denominationId === item.id ? "selected" : ""}" data-denomination="${escapeHtml(item.id)}">
      ${item.tag ? `<span class="denom-tag">${escapeHtml(item.tag)}</span>` : ""}
      <span class="block text-sm font-extrabold">${escapeHtml(item.label)}</span><span class="mt-2 block text-sm font-bold text-brand-600 dark:text-violet-300">${money(item.price)}</span>
    </button>`).join("");
}

function renderPayments() {
  const groups = [...new Set(state.data.paymentMethods.map(payment => payment.group))];
  $("#payment-groups").innerHTML = groups.map(group => `
    <div><p class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">${escapeHtml(group)}</p><div class="grid grid-cols-2 gap-2">
      ${state.data.paymentMethods.filter(payment => payment.group === group).map(payment => `
        <button type="button" class="payment-card ${state.paymentId === payment.id ? "selected" : ""}" data-payment="${escapeHtml(payment.id)}">
          <span class="payment-icon">${escapeHtml(payment.icon || "¤")}</span><span class="min-w-0 flex-1"><span class="block text-xs font-extrabold leading-4">${escapeHtml(payment.name)}</span><span class="mt-1 block text-[10px] text-slate-500">${payment.fee ? `Admin ${money(payment.fee)}` : "Tanpa biaya admin"}</span></span><span class="payment-check">✓</span>
        </button>`).join("")}
      </div></div>`).join("");
}

function calculateTotals() {
  const denomination = selectedDenomination();
  const payment = selectedPayment();
  const price = denomination?.price || 0;
  const fee = payment?.fee || 0;
  const promo = state.data.promos.find(item => item.active && item.id === "welcome");
  const discount = price && promo ? Math.round(price * promo.value / 100) : 0;
  return { price, fee, discount, total: Math.max(0, price + fee - discount) };
}

function updateSummary() {
  const game = selectedGame();
  const denomination = selectedDenomination();
  const totals = calculateTotals();
  $("#summary-product").textContent = game?.shortName || "—";
  $("#summary-denomination").textContent = denomination?.label || "Pilih nominal";
  $("#summary-price").textContent = money(totals.price);
  $("#summary-fee").textContent = money(totals.fee);
  $("#summary-discount").textContent = `−${money(totals.discount)}`;
  $("#summary-total").textContent = money(totals.total);
  $("#button-total").textContent = `• ${money(totals.total)}`;
}

function openCheckout(gameId) {
  const game = byId(state.data.games, gameId);
  if (!game) return;
  state.activeGame = game;
  state.denominationId = null;
  state.paymentId = null;
  state.validated = false;
  $("#checkout-title").textContent = game.name;
  $("#checkout-subtitle").textContent = `${game.publisher} · ${game.currencyName}`;
  $("#checkout-art").style.setProperty("--game-color", game.color);
  $("#checkout-art").innerHTML = `<span>${escapeHtml(game.emoji || "✦")}</span>`;
  $("#validation-message").classList.add("hidden");
  renderAccountFields();
  renderDenominations();
  renderPayments();
  updateSummary();
  openModal("checkout-modal");
}

function validateAccount() {
  const game = selectedGame();
  const user = $("#account-user")?.value.trim() || "";
  const zone = $("#account-zone")?.value.trim() || "";
  const needsZone = ["mlbb","genshin","hsr","wuwa","zzz"].includes(game.id);
  const valid = game.type === "voucher" ? true : user.length >= 4 && (!needsZone || zone.length >= 2);
  const message = $("#validation-message");
  message.classList.remove("hidden", "text-emerald-600", "text-rose-600");
  message.classList.add(valid ? "text-emerald-600" : "text-rose-600");
  message.textContent = valid
    ? `ID demo terbaca. Nama akun: ${game.type === "voucher" ? "Pelanggan Demo" : "Player " + user.slice(-4)} (hasil simulasi, bukan verifikasi server).`
    : `ID belum memenuhi format demo. ${needsZone ? "Isi User ID minimal 4 karakter dan Zone/Server ID minimal 2 karakter." : "Isi User ID minimal 4 karakter."}`;
  state.validated = valid;
  return valid;
}

function createInvoice(event) {
  event.preventDefault();
  if (!selectedDenomination()) return toast("Pilih nominal terlebih dahulu.");
  if (!selectedPayment()) return toast("Pilih metode pembayaran.");
  if (!validateAccount()) return toast("Periksa kembali data akun.");
  const game = selectedGame(), denomination = selectedDenomination(), payment = selectedPayment();
  const totals = calculateTotals();
  const orderId = `TK${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const user = $("#account-user")?.value.trim() || "Tidak diisi";
  const zone = $("#account-zone")?.value.trim() || "";
  const contactEmail = $("#contact-email").value.trim();
  const contactPhone = $("#contact-phone").value.trim();
  state.currentInvoice = { orderId, createdAt: new Date().toLocaleString("id-ID"), game: game.name, denomination: denomination.label, user, zone, payment: payment.name, paymentId: payment.id, ...totals, contactEmail, contactPhone };
  $("#invoice-id").textContent = orderId;
  $("#invoice-details").innerHTML = [
    ["Produk", game.name], ["Nominal", denomination.label], ["User ID", user], ...(zone ? [["Zone / Server ID", zone]] : []),
    ["Pembayaran", payment.name], ["Harga", money(totals.price)], ["Biaya admin", money(totals.fee)], ["Diskon demo", `−${money(totals.discount)}`]
  ].map(([label, value]) => `<div class="flex justify-between gap-4 text-sm"><span class="text-slate-500">${escapeHtml(label)}</span><span class="max-w-[65%] text-right font-semibold">${escapeHtml(value)}</span></div>`).join("") +
  `<div class="flex justify-between gap-4 border-t border-slate-200 pt-3 text-base dark:border-slate-700"><span class="font-bold">Total</span><span class="font-extrabold text-brand-600">${money(totals.total)}</span></div>`;
  const code = payment.category === "va" ? `880${Math.floor(1000000000 + Math.random() * 8999999999)}` : payment.id === "qris" ? "QRIS-DEMO-TK-" + orderId : `PAY-DEMO-${orderId}`;
  $("#payment-code").textContent = code;
  $("#payment-instruction").textContent = payment.id === "qris"
    ? "Kode QRIS berikut hanya teks simulasi. Tidak ada QR pembayaran valid yang dibuat."
    : payment.category === "va" ? `Nomor VA dummy untuk ${payment.name}. Jangan transfer uang ke nomor ini.`
    : payment.category === "retail" ? `Tunjukkan kode demo ini di kasir hanya untuk melihat alur UI. Kode tidak dapat digunakan untuk membayar.`
    : `Buka aplikasi ${payment.name} untuk pembayaran sungguhan hanya pada layanan resmi. Kode ini adalah placeholder demo dan tidak dapat dibayar.`;
  closeModal("checkout-modal");
  openModal("invoice-modal");
}

function downloadInvoice() {
  const invoice = state.currentInvoice;
  if (!invoice) return;
  const content = [
    "TOPUPKITA — RINGKASAN INVOICE DEMO", `Nomor: ${invoice.orderId}`, `Waktu: ${invoice.createdAt}`,
    `Produk: ${invoice.game}`, `Nominal: ${invoice.denomination}`, `User ID: ${invoice.user}`,
    invoice.zone ? `Zone / Server: ${invoice.zone}` : "", `Pembayaran: ${invoice.payment}`,
    `Harga: ${money(invoice.price)}`, `Biaya admin: ${money(invoice.fee)}`, `Diskon demo: -${money(invoice.discount)}`,
    `TOTAL: ${money(invoice.total)}`, "", "DEMO SAJA — bukan invoice pembayaran sah."
  ].filter(Boolean).join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `${invoice.orderId}-demo.txt`; link.click();
  URL.revokeObjectURL(url);
}

function showUtility(title, html) {
  $("#utility-title").textContent = title;
  $("#utility-content").innerHTML = html;
  openModal("utility-modal");
}

function bindEvents() {
  $("#category-filters").addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    renderCategories(); renderCatalog();
  });
  $("#catalog-grid").addEventListener("click", event => {
    const card = event.target.closest("[data-game-id]");
    if (card) openCheckout(card.dataset.gameId);
  });
  const updateSearch = value => { state.search = value; $("#search").value = value; $("#mobile-search").value = value; renderCatalog(); };
  $("#search").addEventListener("input", event => updateSearch(event.target.value));
  $("#mobile-search").addEventListener("input", event => updateSearch(event.target.value));
  $("#mobile-search-toggle").addEventListener("click", () => {
    $("#mobile-search-wrap").classList.toggle("hidden");
    if (!$("#mobile-search-wrap").classList.contains("hidden")) $("#mobile-search").focus();
  });
  $("#hero-dots").addEventListener("click", event => {
    const dot = event.target.closest("[data-hero-index]");
    if (dot) showHero(Number(dot.dataset.heroIndex));
  });
  $("#hero-track").addEventListener("click", event => {
    const button = event.target.closest("[data-hero-game]");
    if (button?.dataset.heroGame) openCheckout(button.dataset.heroGame);
    else $("#catalog").scrollIntoView({ behavior: "smooth" });
  });
  $("#validate-id").addEventListener("click", validateAccount);
  $("#denomination-grid").addEventListener("click", event => {
    const button = event.target.closest("[data-denomination]");
    if (!button) return;
    state.denominationId = button.dataset.denomination;
    renderDenominations(); updateSummary();
  });
  $("#payment-groups").addEventListener("click", event => {
    const button = event.target.closest("[data-payment]");
    if (!button) return;
    state.paymentId = button.dataset.payment;
    renderPayments(); updateSummary();
  });
  $("#checkout-form").addEventListener("submit", createInvoice);
  $$("[data-close]").forEach(button => button.addEventListener("click", () => closeModal(button.dataset.close)));
  $$(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click", event => {
    if (event.target === backdrop) closeModal(backdrop.id);
  }));
  document.addEventListener("keydown", event => { if (event.key === "Escape") $$(".modal-backdrop").forEach(modal => !modal.classList.contains("hidden") && closeModal(modal.id)); });
  $("#theme-toggle").addEventListener("click", toggleTheme);
  $("#help-link").addEventListener("click", () => showUtility("Pusat Bantuan", `
    <p><strong>Ini adalah website demo.</strong> Belum ada pembayaran, API game, atau pengiriman voucher sungguhan.</p>
    <p class="mt-3">Jangan pernah membagikan password, PIN, atau OTP. Untuk toko produksi, hubungkan payment gateway resmi dan backend yang memverifikasi transaksi.</p>
    <p class="mt-3">Kontak contoh: <strong>${escapeHtml(state.data.store.supportWhatsApp || "Belum diatur")}</strong> (nomor placeholder).</p>`));
  $("#check-transaction").addEventListener("click", () => showUtility("Cek Transaksi", `
    <p>Pencarian transaksi belum terhubung ke database server. Invoice yang dibuat pada demo ini hanya tersedia selama sesi browser berlangsung.</p>
    <p class="mt-3">Untuk demo, buat pesanan dari salah satu produk dan lihat nomor invoice yang dihasilkan.</p>`));
  $("#copy-payment-code").addEventListener("click", async () => {
    const code = $("#payment-code").textContent;
    try { await navigator.clipboard.writeText(code); toast("Kode demo disalin."); }
    catch { const range = document.createRange(); range.selectNodeContents($("#payment-code")); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); toast("Pilih dan salin kode secara manual."); }
  });
  $("#download-invoice").addEventListener("click", downloadInvoice);
  $("#finish-invoice").addEventListener("click", () => { closeModal("invoice-modal"); toast("Selesai. Terima kasih sudah mencoba demo!"); });
}

function restoreTheme() {
  const saved = localStorage.getItem("topupkita-theme");
  if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) document.documentElement.classList.add("dark");
  $("#theme-toggle").textContent = document.documentElement.classList.contains("dark") ? "☾" : "☼";
}
function toggleTheme() {
  document.documentElement.classList.toggle("dark");
  const dark = document.documentElement.classList.contains("dark");
  localStorage.setItem("topupkita-theme", dark ? "dark" : "light");
  $("#theme-toggle").textContent = dark ? "☾" : "☼";
}

init();
