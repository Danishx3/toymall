/* 
   ToyMall - Admin Logic v2
   Inventory Control & Order Processing.
*/

// --- 0. Selectors ---
const adminLoginForm = document.getElementById('adminLoginForm');
const loginOverlay = document.getElementById('loginOverlay');
const productTable = document.getElementById('adminProductTable');
const bookingTable = document.getElementById('adminBookingTable');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');

// --- 1. Global State ---
let allProducts = [];
let allBookings = [];
let allOffers = [];
let currentExistingImages = [];

// --- 2. Auth Implementation ---
firebase.auth().onAuthStateChanged((user) => {
    if (user && user.email === 'danishkpmariyad@gmail.com') {
        // Authorized admin
        loginOverlay.style.display = 'none';
        initAdmin();
    } else {
        // Not logged in or unauthorized user
        if (user) {
            alert("Unauthorized! Only the administrator can access this panel.");
            firebase.auth().signOut();
        }
        loginOverlay.style.display = 'flex';
    }
});

adminLoginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const pass = document.getElementById('adminPass').value;
    const btn = document.getElementById('adminLoginBtn');
    const btnText = document.getElementById('adminBtnText');
    const btnLoader = document.getElementById('adminBtnLoader');
    const msg = document.getElementById('adminLoginMessage');
    
    if (email !== 'danishkpmariyad@gmail.com') {
        msg.textContent = 'Access Restricted: Only the HQ admin can sign in هنا.';
        msg.className = 'alert alert-danger d-block text-danger';
        return;
    }

    // Start Loading
    btn.disabled = true;
    btnText.classList.add('d-none');
    btnLoader.classList.remove('d-none');
    msg.className = 'alert d-none';

    try {
        await firebase.auth().signInWithEmailAndPassword(email, pass);
        // Success
        msg.textContent = 'Admin Verified! Welcome back HQ.';
        msg.className = 'alert alert-success d-block text-success';
        // Note: onAuthStateChanged will hide the overlay automatically
    } catch (err) {
        // Failure
        console.error(err);
        msg.textContent = 'Login Access Denied. Check credentials or network.';
        msg.className = 'alert alert-danger d-block text-danger';
        
        // End Loading
        btn.disabled = false;
        btnText.classList.remove('d-none');
        btnLoader.classList.add('d-none');
    }
};

function logout() { firebase.auth().signOut(); }

// --- 3. View Switcher ---
function showView(view) {
    document.getElementById('view-products').style.display = (view === 'products' ? 'block' : 'none');
    document.getElementById('view-offers').style.display = (view === 'offers' ? 'block' : 'none');
    document.getElementById('view-bookings').style.display = (view === 'bookings' ? 'block' : 'none');
    document.querySelectorAll('.sidebar .nav-item[data-view]').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-view') === view);
    });
    document.body.classList.remove('admin-sidebar-open');
}

(function initAdminChrome() {
    const btn = document.getElementById('adminMenuBtn');
    const overlay = document.getElementById('adminSidebarOverlay');
    if (btn) {
        btn.addEventListener('click', () => document.body.classList.toggle('admin-sidebar-open'));
    }
    if (overlay) {
        overlay.addEventListener('click', () => document.body.classList.remove('admin-sidebar-open'));
    }
})();

function fillProductCatalogSelects() {
    if (typeof CATALOG_CATEGORIES === 'undefined') return;
    fillSelect(document.getElementById('pCategory'), CATALOG_CATEGORIES, false);
    fillSelect(document.getElementById('pGender'), CATALOG_GENDERS, false);
    const ageSel = document.getElementById('pAge');
    if (ageSel) {
        ageSel.innerHTML = '<option value="">Not specified</option>';
        CATALOG_AGE_GROUPS.forEach((a) => {
            const o = document.createElement('option');
            o.value = a.id;
            o.textContent = a.label;
            ageSel.appendChild(o);
        });
    }
}

function populateOfferProductSelect() {
    const sel = document.getElementById('offerProductId');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    if (allProducts.length === 0) {
        const o = document.createElement('option');
        o.value = '';
        o.textContent = 'Add a product first';
        sel.appendChild(o);
        return;
    }
    allProducts.forEach((p) => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = `${p.name} — ₹${p.price}`;
        sel.appendChild(o);
    });
    if (cur && [...sel.options].some((opt) => opt.value === cur)) sel.value = cur;
}

// --- 4. Initialize Data ---
function initAdmin() {
    fillProductCatalogSelects();

    db.ref("products").on("value", snapshot => {
        const data = snapshot.val();
        allProducts = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        renderAdminProducts();
        populateOfferProductSelect();
    });

    db.ref("offers").on("value", snapshot => {
        const data = snapshot.val();
        allOffers = data
            ? Object.keys(data).map(key => ({ id: key, ...data[key] }))
                  .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
            : [];
        renderAdminOffers();
    });

    db.ref("bookings").on("value", snapshot => {
        const data = snapshot.val();
        allBookings = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        allBookings.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
        renderAdminBookings();
    });
}

// --- 5. Product CRUD ---
function renderAdminProducts() {
    productTable.innerHTML = allProducts.map(p => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <img src="${p.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 10px;">
                    <div>
                        <strong>${p.name}</strong><br>
                        <small style="color: #64748b;">${typeof catalogLabel === 'function' ? catalogLabel(CATALOG_CATEGORIES, p.category || 'general') : (p.category || 'general')} · ${p.isPinned === 'true' || p.isPinned === true ? '⭐ Pinned' : 'Normal'}</small>
                    </div>
                </div>
            </td>
            <td>
                <span style="font-weight: 700; color: ${Number(p.quantity) < 10 ? '#ef4444' : '#1e293b'}">${p.quantity || 0}</span>
            </td>
            <td>₹${p.price}</td>
            <td>
                <button class="action-btn edit-btn" onclick="openEditModal('${p.id}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="action-btn delete-btn" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openAddModal() {
    productForm.reset();
    document.getElementById('editId').value = "";
    document.getElementById('modalTitle').innerText = "Add New Toy";
    fillProductCatalogSelects();
    document.getElementById('pCategory').value = 'general';
    document.getElementById('pGender').value = 'unisex';
    document.getElementById('pAge').value = '';
    
    currentExistingImages = [];
    renderExistingImages();
    productModal.style.display = 'flex';
}

function openEditModal(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    fillProductCatalogSelects();
    document.getElementById('editId').value = p.id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pOldPrice').value = p.originalPrice || "";
    document.getElementById('pQuantity').value = p.quantity || 100;
    document.getElementById('pDesc').value = p.description || "";
    document.getElementById('pIsPinned').value = p.isPinned ? "true" : "false";
    document.getElementById('pCategory').value = p.category || 'general';
    document.getElementById('pGender').value = p.gender || 'unisex';
    document.getElementById('pAge').value = p.ageGroup || '';
    document.getElementById('modalTitle').innerText = "Edit Toy";
    
    currentExistingImages = p.images || (p.image ? [p.image] : []);
    renderExistingImages();
    productModal.style.display = 'flex';
}

function renderExistingImages() {
    const container = document.getElementById('existingImages');
    if (!container) return;
    
    if (currentExistingImages.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = currentExistingImages.map((img, idx) => `
        <div class="image-preview-item">
            <img src="${img}" alt="Toy image ${idx + 1}">
            <button type="button" class="delete-img-btn" onclick="removeExistingImage(${idx})" title="Delete image">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function removeExistingImage(index) {
    if (confirm("Remove this image? It will be removed from the product once you Save Toy Details.")) {
        currentExistingImages.splice(index, 1);
        renderExistingImages();
    }
}

function closeProductModal() { productModal.style.display = 'none'; }

productForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveProductBtn');
    btn.disabled = true; btn.innerText = "Processing...";

    const id = document.getElementById('editId').value;
    const name = document.getElementById('pName').value;
    const price = Number(document.getElementById('pPrice').value);
    const originalPrice = Number(document.getElementById('pOldPrice').value) || price;
    const quantity = Number(document.getElementById('pQuantity').value);
    const desc = document.getElementById('pDesc').value;
    const isPinned = document.getElementById('pIsPinned').value === "true";
    const category = document.getElementById('pCategory').value || 'general';
    const gender = document.getElementById('pGender').value || 'unisex';
    const ageGroup = document.getElementById('pAge').value || '';
    const imageFiles = Array.from(document.getElementById('pImage').files);

    try {
        let imageUrls = [...currentExistingImages];
        
        if (imageFiles.length > 0) {
            for (const file of imageFiles) {
                const url = await uploadToImgBB(file);
                imageUrls.push(url);
            }
        }

        const data = {
            name, price, originalPrice, quantity, description: desc, isPinned,
            category, gender, ageGroup,
            images: imageUrls,
            image: imageUrls[0] || "https://via.placeholder.com/300"
        };

        if (id) {
            await db.ref("products/" + id).update(data);
        } else {
            await db.ref("products").push(data);
        }
        closeProductModal();
    } catch (err) { alert(err.message); }
    finally { btn.disabled = false; btn.innerText = "Save Toy Details"; }
};

async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
    const result = await res.json();
    if (result.success) return result.data.url;
    throw new Error(result.error.message);
}

async function deleteProduct(id) {
    if (confirm("Delete this toy?")) await db.ref("products/" + id).remove();
}

// --- 5b. Promo banners ---
function renderAdminOffers() {
    const tbody = document.getElementById('adminOffersTable');
    if (!tbody) return;
    if (allOffers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:1.5rem;color:#64748b;">No banners yet. Add one to show a carousel on the shop homepage.</td></tr>';
        return;
    }
    tbody.innerHTML = allOffers.map((o) => {
        const prod = allProducts.find((x) => x.id === o.productId);
        const pname = prod ? prod.name : '(product missing — pick another in edit)';
        return `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;">
                    <img src="${o.image || ''}" alt="" class="banner-table-img">
                    <div style="min-width: 150px;">
                        <strong style="color:var(--primary);font-size:1.05rem;">${o.title || '—'}</strong><br>
                        <small style="color:#64748b;">${o.subtitle || ''}</small>
                    </div>
                </div>
            </td>
            <td>${pname}</td>
            <td>${o.sortOrder ?? 0}</td>
            <td>
                <button type="button" class="action-btn edit-btn" onclick="openOfferModal('${o.id}')"><i class="fas fa-edit"></i> Edit</button>
                <button type="button" class="action-btn delete-btn" onclick="deleteOffer('${o.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function openOfferModal(editId) {
    const modal = document.getElementById('offerModal');
    const form = document.getElementById('offerForm');
    if (!modal || !form) return;
    form.reset();
    document.getElementById('offerEditId').value = editId || '';
    document.getElementById('offerModalTitle').innerText = editId ? 'Edit promo banner' : 'Add promo banner';
    populateOfferProductSelect();
    if (editId) {
        const o = allOffers.find((x) => x.id === editId);
        if (o) {
            document.getElementById('offerTitle').value = o.title || '';
            document.getElementById('offerSubtitle').value = o.subtitle || '';
            document.getElementById('offerTitleColor').value = o.titleColor || '#f70404';
            document.getElementById('offerSubtitleColor').value = o.subtitleColor || '#475569';
            document.getElementById('offerProductId').value = o.productId || '';
            document.getElementById('offerSort').value = o.sortOrder ?? 0;
            
            const preview = document.getElementById('offerImagePreviewPanel');
            if (preview && o.image) preview.innerHTML = `<img src="${o.image}">`;
        }
    } else {
        document.getElementById('offerSort').value = String(allOffers.length);
        document.getElementById('offerTitleColor').value = '#f70404';
        document.getElementById('offerSubtitleColor').value = '#475569';
        const preview = document.getElementById('offerImagePreviewPanel');
        if (preview) preview.innerHTML = '<span style="color:#94a3b8;font-size:0.9rem;">Upload a new image to see preview</span>';
    }
    modal.style.display = 'flex';
}

function closeOfferModal() {
    const modal = document.getElementById('offerModal');
    if (modal) modal.style.display = 'none';
}

// Add live preview for banner selection
document.getElementById('offerImage')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('offerImagePreviewPanel');
    if (file && preview) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}">`;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('offerForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveOfferBtn');
    btn.disabled = true;
    btn.innerText = 'Saving…';
    const editId = document.getElementById('offerEditId').value;
    const title = document.getElementById('offerTitle').value.trim();
    const subtitle = document.getElementById('offerSubtitle').value.trim();
    const titleColor = document.getElementById('offerTitleColor').value;
    const subtitleColor = document.getElementById('offerSubtitleColor').value;
    const productId = document.getElementById('offerProductId').value;
    const sortOrder = Number(document.getElementById('offerSort').value) || 0;
    const file = document.getElementById('offerImage').files[0];
    try {
        let image = '';
        if (file) image = await uploadToImgBB(file);
        else if (editId) {
            const ex = allOffers.find((x) => x.id === editId);
            image = ex ? ex.image : '';
        }
        if (!image) {
            alert('Please choose a banner image.');
            return;
        }
        if (!productId) {
            alert('Link the banner to a product.');
            return;
        }
        const payload = { title, subtitle, titleColor, subtitleColor, productId, image, sortOrder };
        if (editId) await db.ref('offers/' + editId).update(payload);
        else await db.ref('offers').push(payload);
        closeOfferModal();
    } catch (err) {
        alert(err.message || String(err));
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save banner';
    }
};

async function deleteOffer(id) {
    if (!confirm('Delete this banner from the shop homepage?')) return;
    await db.ref('offers/' + id).remove();
}

// --- 6. Order Processing ---
let _bookingSearchQuery = '';
let _bookingStatusFilter = 'all';

function filterAdminOrders() {
    _bookingSearchQuery = (document.getElementById('orderSearchInput')?.value || '').trim().toLowerCase();
    _bookingStatusFilter = document.getElementById('orderStatusFilter')?.value || 'all';
    renderAdminBookings();
}

function renderAdminBookings() {
    let list = allBookings;

    // First Filter by Status
    if (_bookingStatusFilter !== 'all') {
        if (_bookingStatusFilter === 'paid') {
            // Show orders marked as paid but not yet finished
            list = list.filter(b => b.paymentStatus === 'paid' && b.status !== 'finished' && b.status !== 'cancelled');
        } else {
            list = list.filter(b => b.status === _bookingStatusFilter);
        }
    }

    // Then Filter by Search
    if (_bookingSearchQuery) {
        list = list.filter(b =>
            (b.orderId || b.id).toLowerCase().includes(_bookingSearchQuery) ||
            (b.userName || '').toLowerCase().includes(_bookingSearchQuery) ||
            (b.userPhone || '').includes(_bookingSearchQuery)
        );
    }

    if (list.length === 0) {
        bookingTable.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:#94a3b8;font-weight:600;">No orders found.</td></tr>`;
        return;
    }

    bookingTable.innerHTML = list.map(b => {
        const displayId = b.orderId || ('#' + b.id.substring(0, 8));
        const itemsHtml = b.items.map(i => `
            <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.4rem;">
                <img src="${i.image || ''}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px;border:2px solid #f1f5f9;flex-shrink:0;">
                <span style="font-size:0.85rem;font-weight:700;color:#334155;">${i.name} <span style="color:#4ECDC4;">×${i.quantity}</span> <span style="color:#ef4444;">₹${i.price * i.quantity}</span></span>
            </div>
        `).join('');

        return `
        <tr style="position: relative;">
            <td>
                <div style="font-family:'Fredoka One',cursive;font-size:1.15rem;color:var(--primary);letter-spacing:0.03em;">${displayId}</div>
                <div style="font-weight:700;margin-top:0.2rem;">👤 ${b.userName}</div>
                <div style="margin-top:0.2rem;">
                    <a href="tel:${b.userPhone}" style="color:#0f766e;font-weight:700;font-size:0.88rem;">📞 ${b.userPhone}</a>
                </div>
                <div style="font-size:0.78rem;color:#64748b;max-width:220px;margin-top:0.3rem;">📍 ${b.address}</div>
                <div style="font-size:0.72rem;color:#94a3b8;margin-top:0.2rem;">${new Date(b.timestamp).toLocaleString()}</div>
            </td>
            <td>
                ${itemsHtml}
                <div style="font-weight:800;color:var(--primary);margin-top:0.5rem;font-size:1.05rem;">Total: ₹${b.total}</div>
            </td>
            <td>
                ${b.status !== 'cancelled' ? `<span class="status-badge status-${b.status}">${b.status}</span>` : ''}
                <div style="font-size:0.75rem;color:#1e293b;font-weight:700;margin-top:5px;">
                    Mode: ${b.purchaseMode === 'visit' ? '🏪 Shop Visit' : '🚚 Delivery'}
                </div>
                <div style="font-size:0.7rem;color:#94a3b8;margin-top:5px;">
                    Last: ${b.logs ? new Date(b.logs[b.logs.length-1].date).toLocaleString() : 'N/A'}
                </div>
                ${b.deliveryDate ? `<div style="font-size:0.75rem;color:#15803d;font-weight:700;margin-top:5px;">📅 Est: ${new Date(b.deliveryDate).toLocaleDateString()}</div>` : ''}
            </td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${b.status === 'pending' ? `
                        <button class="action-btn edit-btn" style="background: #15803d; color: #fff;" onclick="processOrder('${b.id}', 'accepted')">Accept Order</button>
                        <button class="action-btn delete-btn" onclick="processOrder('${b.id}', 'rejected')">Reject Order</button>
                    ` : (b.status === 'rejected' || b.status === 'cancelled') ? `
                        <span style="color: #ef4444; font-weight: 800; text-align: center; display: block; border: 2px solid #fee2e2; padding: 0.5rem; border-radius: 8px;">${b.status === 'cancelled' ? 'CANCELLED' : 'CLOSED'}</span>
                    ` : b.status === 'finished' ? `
                        <span style="color: #10b981; font-weight: 800; font-size: 1.1rem; padding: 0.5rem; text-align: center; border: 2px solid #10b981; border-radius: 8px; background: #ecfdf5; display: block;">FINISHED 🎉</span>
                        <div style="text-align: center; margin-top: 0.5rem; font-weight: 700; color: #047857;">Paid ✅</div>
                    ` : `
                        <div style="display: flex; gap: 0.5rem; flex-direction: column;">
                            ${b.paymentStatus === 'paid' ? `
                                <div style="display: flex; gap: 0.4rem; align-items: stretch;">
                                    <div style="font-weight: 800; color: #15803d; flex: 1; display:flex; align-items:center; justify-content:center; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">PAID ✅</div>
                                    <button class="action-btn" style="background: #fff; color: #ef4444; padding: 0.4rem; font-size: 0.75rem; border: 1px solid #f87171;" onclick="updatePaymentStatus('${b.id}', 'unpaid')">Undo</button>
                                </div>
                                <button class="action-btn" style="background: #10b981; color: #fff; margin-top: 0.2rem; border: 2px solid #047857; text-transform: uppercase; font-weight: 800;" onclick="processOrder('${b.id}', 'finished')">Finish Order 📦</button>
                            ` : `
                                <button class="action-btn" style="background: #3b82f6; color: #fff; box-shadow: 0 4px 0 #2563eb;" onclick="updatePaymentStatus('${b.id}', 'paid')">Mark as Paid 💰</button>
                            `}
                            
                            <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 0.4rem 0;">
                            
                            <input type="date" onchange="updateDeliveryDate('${b.id}', this.value)" style="padding: 0.4rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.8rem;" title="Set Delivery Date" value="${b.deliveryDate || ''}">
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                            <button class="action-btn delete-btn" onclick="processOrder('${b.id}', 'cancelled')" style="background: #fff; color: #ef4444; border: 1px solid #fee2e2; flex: 1; padding: 0.5rem;">Cancel</button>
                            <button class="action-btn edit-btn" style="background: #25D366; color: #fff; flex: 1; padding: 0.5rem;" onclick="window.open('https://wa.me/${b.userPhone}?text=${encodeURIComponent('Hello ' + b.userName + ', regarding your ToyMall order ' + (b.orderId || b.id.substring(0,8)) + '...')}', '_blank')"><i class="fab fa-whatsapp"></i> Chat</button>
                        </div>
                    `}
                </div>
            </td>
        </tr>
    `}).join('');
}

async function processOrder(orderId, newStatus) {
    if (!confirm(`Are you sure you want to mark this order as ${newStatus.toUpperCase()}?`)) return;
    
    const order = allBookings.find(b => b.id === orderId);
    if (!order) return;

    if (newStatus === 'accepted') {
        for (const item of order.items) {
            const product = allProducts.find(p => p.id === item.id);
            if (product) {
                const newQty = Math.max(0, Number(product.quantity) - Number(item.quantity));
                await db.ref("products/" + item.id).update({ quantity: newQty });
            }
        }
    }

    if (newStatus === 'cancelled' && (order.status === 'accepted' || order.status === 'paid' || order.status === 'finished')) {
         for (const item of order.items) {
            const product = allProducts.find(p => p.id === item.id);
            if (product) {
                const newQty = Number(product.quantity) + Number(item.quantity);
                await db.ref("products/" + item.id).update({ quantity: newQty });
            }
        }
    }

    const newLogs = [...(order.logs || []), { status: newStatus, date: new Date().toISOString() }];
    await db.ref("bookings/" + orderId).update({ status: newStatus, logs: newLogs });
}

window.updatePaymentStatus = async function(orderId, val) {
    await db.ref("bookings/" + orderId).update({ paymentStatus: val });
}

async function updateBookingStatus(orderId, newStatus) {
    if (!newStatus) return;
    const order = allBookings.find(b => b.id === orderId);
    if (!order) return;
    
    const newLogs = [...(order.logs || []), { status: newStatus, date: new Date().toISOString() }];
    await db.ref("bookings/" + orderId).update({ status: newStatus, logs: newLogs });
}

async function updateDeliveryDate(orderId, date) {
    if (!date) return;
    await db.ref("bookings/" + orderId).update({ deliveryDate: date });
}
