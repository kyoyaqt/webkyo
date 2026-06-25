const KERANJANG_KEY = "keranjangRestoran";
const MENU_COLLECTION = "menus";
const ORDERS_COLLECTION = "orders";

const gambarMenuTersedia = ["minus.png", "plus.png", "image.jpg"];
const menuDefault = [
    {
        id: "nasi-goreng",
        nama: "Nasi Goreng",
        deskripsi: "Nasi goreng spesial.",
        harga: 20000,
        gambar: "",
        gambarUrl: "",
    },
    {
        id: "sate-ayam",
        nama: "Sate Ayam",
        deskripsi: "Sate ayam dengan bumbu kacang.",
        harga: 25000,
        gambar: "",
        gambarUrl: "",
    },
];

let menuCache = [];
let pesananCache = [];
let unsubMenu = null;
let unsubPesanan = null;

function db() {
    if (!window.firebaseDb) throw new Error("Firebase belum siap.");
    return window.firebaseDb;
}

function formatRupiah(angka) {
    return Number(angka || 0).toLocaleString("id-ID");
}

function getStatusLabel(status) {
    return ({
        pending: "Pending",
        diproses: "Di Proses",
        pengantaran: "Dalam Pengantaran",
        selesai: "Selesai",
    })[status] || "Pending";
}

function getPathGambar(namaFile) {
    return namaFile ? `aset/${namaFile}` : "";
}

function getSumberGambar(item) {
    return item.gambarUrl || getPathGambar(item.gambar);
}

function getMejaAktif() {
    const params = new URLSearchParams(window.location.search);
    const mejaDariUrl = params.get("meja");
    if (mejaDariUrl) localStorage.setItem("mejaAktif", mejaDariUrl);
    return mejaDariUrl || localStorage.getItem("mejaAktif") || "";
}

function renderInfoMeja() {
    const infoMeja = document.getElementById("infoMeja");
    if (!infoMeja) return;
    const meja = getMejaAktif();
    infoMeja.textContent = meja ? `Meja: ${meja}` : "Meja belum dipilih dari QR.";
}

function generateQrMeja() {
    const input = document.getElementById("namaMeja");
    const hasil = document.getElementById("hasilQrMeja");
    if (!input || !hasil) return;
    const namaMeja = input.value.trim();
    if (!namaMeja) return alert("Isi nama meja terlebih dahulu.");
    
    // Buat URL absolut berdasarkan window.location.origin
    const baseUrl = window.location.origin;
    const urlPelanggan = new URL("Menu.html", baseUrl);
    urlPelanggan.searchParams.set("meja", namaMeja);
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(urlPelanggan.href)}`;
    hasil.innerHTML = `<div class="qr-card"><h3>${namaMeja}</h3><img src="${qrUrl}" alt="QR Code ${namaMeja}"><p>${urlPelanggan.href}</p><button type="button" onclick="printQrMeja()">Print QR</button></div>`;
}

function printQrMeja() {
    const hasil = document.getElementById("hasilQrMeja");
    const printArea = document.getElementById("strukPrint") || document.getElementById("qrPrintArea");
    if (!hasil) return;
    if (printArea) printArea.innerHTML = hasil.innerHTML;
    window.print();
}

function slugify(text) {
    return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function ensureDefaultMenu() {
    const snap = await db().collection(MENU_COLLECTION).get();
    if (!snap.empty) return;
    const batch = db().batch();
    menuDefault.forEach((item) => {
        batch.set(db().collection(MENU_COLLECTION).doc(item.id), item);
    });
    await batch.commit();
}

function startMenuListener() {
    if (unsubMenu) return;
    unsubMenu = db().collection(MENU_COLLECTION).onSnapshot((snapshot) => {
        menuCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderMenuIndex();
        renderMenuAdmin();
        renderKeranjang();
    }, (error) => console.error("Menu listener error:", error));
}

function startPesananListener() {
    if (unsubPesanan) return;
    unsubPesanan = db().collection(ORDERS_COLLECTION).orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        pesananCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderKasir();
        renderSemuaLaporan();
        renderStatusPelanggan();
    }, (error) => console.error("Pesanan listener error:", error));
}

async function initFirestore() {
    if (!window.firebaseDb) {
        alert("Firebase belum terhubung. Cek firebase.js dan file SDK.");
        return;
    }

    try {
        await ensureDefaultMenu();
        startMenuListener();
        startPesananListener();
    } catch (error) {
        console.error("Gagal inisialisasi Firestore:", error);
        alert("Firestore gagal dimulai. Cek rules dan koneksi Firebase.");
    }
}

function getMenu() {
    return [...menuCache];
}

function getKeranjang() {
    return JSON.parse(localStorage.getItem(KERANJANG_KEY) || "{}");
}

function saveKeranjang(keranjang) {
    localStorage.setItem(KERANJANG_KEY, JSON.stringify(keranjang));
}

function initPilihanGambar() {
    const select = document.getElementById("gambar");
    const inputUrl = document.getElementById("gambarUrl");
    if (!select) return;
    gambarMenuTersedia.forEach((namaFile) => {
        const option = document.createElement("option");
        option.value = namaFile;
        option.textContent = namaFile;
        select.appendChild(option);
    });
    select.addEventListener("change", updatePreviewGambar);
    inputUrl?.addEventListener("input", updatePreviewGambar);
    updatePreviewGambar();
}

function updatePreviewGambar() {
    const select = document.getElementById("gambar");
    const inputUrl = document.getElementById("gambarUrl");
    const preview = document.getElementById("previewGambar");
    if (!select || !preview) return;
    const gambar = inputUrl?.value.trim() || getPathGambar(select.value);
    if (!gambar) {
        preview.removeAttribute("src");
        preview.style.display = "none";
        return;
    }
    preview.src = gambar;
    preview.style.display = "block";
}

function renderMenuIndex() {
    const container = document.getElementById("containerMenu");
    if (!container) return;
    const menu = getMenu();
    const keranjang = getKeranjang();
    container.innerHTML = menu.map((item) => {
        const qty = keranjang[item.id] || 0;
        const gambar = getSumberGambar(item);
        return `<div class="card">${gambar ? `<img class="card-image" src="${gambar}" alt="${item.nama}">` : ""}<h2>${item.nama}</h2><p>${item.deskripsi}</p><p class="harga">Rp ${formatRupiah(item.harga)}</p><div class="kontrol"><button onclick="ubahJumlah('${item.id}', -1)"><img src="aset/minus.png" alt="Minus"></button><span id="${item.id}">${qty}</span><button onclick="ubahJumlah('${item.id}', 1)"><img src="aset/plus.png" alt="Plus"></button></div></div>`;
    }).join("");
    renderKeranjang();
}

function renderMenuAdmin() {
    const container = document.getElementById("daftarMenuAdmin");
    if (!container) return;
    const menu = getMenu();
    container.innerHTML = menu.map((item) => `<div class="admin-card">${getSumberGambar(item) ? `<img class="admin-card-image" src="${getSumberGambar(item)}" alt="${item.nama}">` : ""}<strong>${item.nama}</strong><p>${item.deskripsi}</p><span>Rp ${formatRupiah(item.harga)}</span><button class="btn-hapus-menu" onclick="hapusMenu('${item.id}')">Hapus</button></div>`).join("");
}

async function hapusMenu(id) {
    const item = menuCache.find((m) => m.id === id);
    if (!item) return;
    if (!confirm(`Hapus menu "${item.nama}"?`)) return;
    await db().collection(MENU_COLLECTION).doc(id).delete();
}

function initAdminForm() {
    const form = document.getElementById("formMenu");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const nama = document.getElementById("nama").value.trim();
        const deskripsi = document.getElementById("deskripsi").value.trim();
        const harga = Number(document.getElementById("harga").value);
        const gambar = document.getElementById("gambar").value;
        const gambarUrl = document.getElementById("gambarUrl").value.trim();
        if (!nama || !deskripsi || Number.isNaN(harga)) return;
        const idDasar = slugify(nama) || `menu-${Date.now()}`;
        const idUnik = menuCache.some((item) => item.id === idDasar) ? `${idDasar}-${Date.now()}` : idDasar;
        await db().collection(MENU_COLLECTION).doc(idUnik).set({ nama, deskripsi, harga, gambar, gambarUrl });
        form.reset();
        updatePreviewGambar();
    });
}

function renderKeranjang() {
    const daftar = document.getElementById("daftarKeranjang");
    const totalEl = document.getElementById("total");
    const bayarBtn = document.getElementById("btnBayar");
    if (!daftar || !totalEl) return;
    const menu = getMenu();
    const keranjang = getKeranjang();
    let total = 0;
    let adaItem = false;
    daftar.innerHTML = "";
    renderInfoMeja();
    Object.entries(keranjang).forEach(([id, qty]) => {
        const item = menu.find((produk) => produk.id === id);
        if (!item || qty <= 0) return;
        adaItem = true;
        total += item.harga * qty;
        const li = document.createElement("li");
        li.textContent = `${item.nama} (${qty})`;
        daftar.appendChild(li);
    });
    totalEl.textContent = formatRupiah(total);
    if (bayarBtn) bayarBtn.disabled = !adaItem;
    menu.forEach((item) => {
        const qtyElement = document.getElementById(item.id);
        if (qtyElement) qtyElement.textContent = keranjang[item.id] || 0;
    });
    renderStatusPelanggan();
}

async function ubahJumlah(id, perubahan) {
    const item = menuCache.find((produk) => produk.id === id);
    if (!item) return;
    const keranjang = getKeranjang();
    const qtyBaru = (keranjang[id] || 0) + perubahan;
    if (qtyBaru < 0) return;
    keranjang[id] = qtyBaru;
    if (keranjang[id] === 0) delete keranjang[id];
    saveKeranjang(keranjang);
    renderKeranjang();
}

async function bayarKeranjang() {
    const keranjang = getKeranjang();
    const menu = getMenu();
    const items = [];
    let total = 0;
    Object.entries(keranjang).forEach(([id, qty]) => {
        const item = menu.find((produk) => produk.id === id);
        if (!item || qty <= 0) return;
        items.push({ id: item.id, nama: item.nama, qty, harga: item.harga });
        total += item.harga * qty;
    });
    if (items.length === 0) return alert("Keranjang masih kosong.");
    if (!confirm("Yakin ingin membayar pesanan ini?")) return;
    try {
        await db().collection(ORDERS_COLLECTION).add({
            waktu: new Date().toLocaleString("id-ID"),
            meja: getMejaAktif(),
            status: "pending",
            total,
            items,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        saveKeranjang({});
        renderKeranjang();
        alert("Pesanan berhasil dikirim ke kasir.");
    } catch (error) {
        console.error("Gagal kirim pesanan:", error);
        alert("Pesanan gagal dikirim.");
    }
}

function renderStatusPelanggan() {
    const statusContainer = document.getElementById("statusPesananPelanggan");
    if (!statusContainer) return;
    if (pesananCache.length === 0) {
        statusContainer.innerHTML = "";
        return;
    }
    const pesananTerbaru = pesananCache[0];
    statusContainer.innerHTML = `
        <h3>Status Pesanan</h3>
        ${pesananTerbaru.meja ? `<p>Meja: <strong>${pesananTerbaru.meja}</strong></p>` : ""}
        <p>Pesanan terakhir: <strong>${getStatusLabel(pesananTerbaru.status)}</strong></p>
        <p>Total: Rp ${formatRupiah(pesananTerbaru.total)}</p>
    `;
}

function hitungLaporanPesanan() {
    const laporan = {
        totalPesanan: pesananCache.length,
        pendapatanSelesai: 0,
        pesananAktif: 0,
        status: { pending: 0, diproses: 0, pengantaran: 0, selesai: 0 },
    };
    pesananCache.forEach((item) => {
        if (laporan.status[item.status] !== undefined) laporan.status[item.status] += 1;
        if (item.status === "selesai") laporan.pendapatanSelesai += item.total || 0;
        else laporan.pesananAktif += 1;
    });
    return laporan;
}

function renderLaporan(targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;
    const laporan = hitungLaporanPesanan();
    container.innerHTML = `
        <div class="report-grid">
            <div class="report-card"><span>Total Pesanan</span><strong>${laporan.totalPesanan}</strong></div>
            <div class="report-card"><span>Pendapatan Selesai</span><strong>Rp ${formatRupiah(laporan.pendapatanSelesai)}</strong></div>
            <div class="report-card"><span>Pesanan Aktif</span><strong>${laporan.pesananAktif}</strong></div>
        </div>
        <div class="report-status">
            <p><span class="status-badge status-pending">Pending</span> ${laporan.status.pending} pesanan</p>
            <p><span class="status-badge status-diproses">Di Proses</span> ${laporan.status.diproses} pesanan</p>
            <p><span class="status-badge status-pengantaran">Dalam Pengantaran</span> ${laporan.status.pengantaran} pesanan</p>
            <p><span class="status-badge status-selesai">Selesai</span> ${laporan.status.selesai} pesanan</p>
        </div>
    `;
}

function renderSemuaLaporan() {
    renderLaporan("laporanAdmin");
    renderLaporan("laporanKasir");
}

function renderKasir() {
    const container = document.getElementById("daftarPesanan");
    if (!container) return;
    if (pesananCache.length === 0) {
        container.innerHTML = "<p>Belum ada pesanan masuk.</p>";
        return;
    }
    container.innerHTML = pesananCache.map((pesananItem, index) => `
        <div class="order-card">
            <h3>Pesanan ${index + 1}</h3>
            <p><strong>Meja:</strong> ${pesananItem.meja || "-"}</p>
            <p><strong>Waktu:</strong> ${pesananItem.waktu || "-"}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${pesananItem.status}">${getStatusLabel(pesananItem.status)}</span></p>
            <ul>${(pesananItem.items || []).map((item) => `<li>${item.nama} x ${item.qty}</li>`).join("")}</ul>
            <p><strong>Total:</strong> Rp ${formatRupiah(pesananItem.total || 0)}</p>
            <div class="status-actions">
                <button onclick="updateStatus('${pesananItem.id}', 'pending')">Pending</button>
                <button onclick="updateStatus('${pesananItem.id}', 'diproses')">Di Proses</button>
                <button onclick="updateStatus('${pesananItem.id}', 'pengantaran')">Dalam Pengantaran</button>
                <button onclick="updateStatus('${pesananItem.id}', 'selesai')">Selesai</button>
                <button onclick="cetakStruk('${pesananItem.id}')">Cetak Struk</button>
            </div>
        </div>
    `).join("");
}

async function updateStatus(id, statusBaru) {
    try {
        await db().collection(ORDERS_COLLECTION).doc(id).update({ status: statusBaru });
    } catch (error) {
        console.error("Gagal update status:", error);
        alert("Status gagal diperbarui.");
    }
}

function cetakStruk(id) {
    const printArea = document.getElementById("strukPrint");
    if (!printArea) return;
    const target = pesananCache.find((item) => item.id === id);
    if (!target) return;
    printArea.innerHTML = `
        <div class="receipt">
            <h2>Struk Pembayaran</h2>
            <p>Restoran</p>
            <hr>
            <p><strong>No Pesanan:</strong> ${target.id}</p>
            <p><strong>Meja:</strong> ${target.meja || "-"}</p>
            <p><strong>Waktu:</strong> ${target.waktu || "-"}</p>
            <p><strong>Status:</strong> ${getStatusLabel(target.status)}</p>
            <hr>
            <table>
                <thead>
                    <tr>
                        <th>Menu</th><th>Qty</th><th>Harga</th><th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${(target.items || []).map((item) => `
                        <tr>
                            <td>${item.nama}</td>
                            <td>${item.qty}</td>
                            <td>Rp ${formatRupiah(item.harga)}</td>
                            <td>Rp ${formatRupiah(item.harga * item.qty)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            <hr>
            <p class="receipt-total"><strong>Total: Rp ${formatRupiah(target.total || 0)}</strong></p>
            <p class="receipt-footer">Terima kasih sudah memesan.</p>
        </div>
    `;
    window.print();
}

window.ubahJumlah = ubahJumlah;
window.bayarKeranjang = bayarKeranjang;
window.generateQrMeja = generateQrMeja;
window.printQrMeja = printQrMeja;
window.hapusMenu = hapusMenu;
window.updateStatus = updateStatus;
window.cetakStruk = cetakStruk;

document.addEventListener("DOMContentLoaded", async () => {
    await initFirestore();
    if (document.getElementById("containerMenu")) {
        renderInfoMeja();
        renderMenuIndex();
    }
    if (document.getElementById("formMenu")) {
        renderMenuAdmin();
        initPilihanGambar();
        initAdminForm();
    }
    if (document.getElementById("daftarPesanan")) renderKasir();
    renderSemuaLaporan();
    if (document.getElementById("statusPesananPelanggan")) renderStatusPelanggan();
});

window.addEventListener("beforeunload", () => {
    if (typeof unsubMenu === "function") unsubMenu();
    if (typeof unsubPesanan === "function") unsubPesanan();
});
