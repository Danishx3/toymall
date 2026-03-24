/* 
   ToyMall - App Logic v2
   Includes Auth, Realtime DB, and Order Tracking.
*/

// --- 0. Selectors ---
const productGrid = document.getElementById('productGrid');
const pinnedItemsGrid = document.getElementById('pinnedItemsGrid');
const specialOffersSection = document.getElementById('specialOffersSection');
const cartDrawer = document.getElementById('cartDrawer');
const cartDrawerBody = document.getElementById('cartDrawerBody');
const cartBackdrop = document.getElementById('cartBackdrop');
const openCartBtn = document.getElementById('openCart');
const closeCartBtn = document.getElementById('closeCart');
const cartItemsList = document.getElementById('cartItemsList');
const cartFooter = document.getElementById('cartFooter');
const cartCount = document.getElementById('cartCount');
const totalDisplay = document.getElementById('totalDisplay');
const userAddressInput = document.getElementById('userAddress');
const whatsappBtn = document.getElementById('whatsappCheckout');

// Auth Selectors
const userAuthSection = document.getElementById('userAuthSection');
const userInfoSection = document.getElementById('userInfoSection');
const userOrdersList = document.getElementById('userOrdersList');

// Mobile Selectors
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const closeMobileMenuBtn = document.getElementById('closeMobileMenu');
const mobileUserAuthSection = document.getElementById('mobileUserAuthSection');
const mobileUserInfoSection = document.getElementById('mobileUserInfoSection');
const mobileShopSearch = document.getElementById('mobileShopSearch');
const mobileFilterCategory = document.getElementById('mobileFilterCategory');
const mobileFilterGender = document.getElementById('mobileFilterGender');
const mobileFilterAge = document.getElementById('mobileFilterAge');
const mobileClearFiltersBtn = document.getElementById('mobileClearFiltersBtn');

// --- 1. Global State ---
let cart = JSON.parse(localStorage.getItem('toymall_cart')) || [];
let products = [];
let currentUser = null;
let userData = null;

let shopFilters = { q: '', category: '', gender: '', age: '' };
let shopSearchDebounce = null; // Debounce timer for search input
let boostedProductId = null; // Track if a banner click boosted a product
let offersList = [];
let currentOfferIndex = 0;
let offersCarouselTimer = null;
let isLoadingProducts = true;
let isLoadingOffers = true;

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJs(str) {
    return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// --- 2. Auth Implementation ---
// --- 2. Auth Implementation ---
firebase.auth().onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
        if (userAuthSection) {
            userAuthSection.classList.add('d-none');
            userAuthSection.classList.remove('d-lg-flex');
            userAuthSection.style.display = '';
        }
        if (userInfoSection) {
            userInfoSection.classList.add('d-none');
            userInfoSection.classList.add('d-lg-flex');
            userInfoSection.style.display = '';
        }
        if (mobileUserAuthSection) mobileUserAuthSection.style.display = 'none';
        if (mobileUserInfoSection) mobileUserInfoSection.style.display = 'block';

        if (userOrdersList) {
            userOrdersList.innerHTML = `<p class="orders-empty-msg"><i class="fas fa-rocket fa-spin"></i> Loading your orders...</p>`;
        }
        fetchUserData(user.uid);
        fetchUserOrders(user.uid);
    } else {
        if (userAuthSection) {
            userAuthSection.classList.add('d-none');
            userAuthSection.classList.add('d-lg-flex');
            userAuthSection.style.display = '';
        }
        if (userInfoSection) {
            userInfoSection.classList.add('d-none');
            userInfoSection.classList.remove('d-lg-flex');
            userInfoSection.style.display = 'none';
        }
        if (mobileUserAuthSection) mobileUserAuthSection.style.display = 'block';
        if (mobileUserInfoSection) mobileUserInfoSection.style.display = 'none';

        if (userOrdersList) {
            userOrdersList.innerHTML = `<p class="orders-empty-msg">Login to view your orders</p>`;
        }
    }
});

async function fetchUserData(uid) {
    db.ref("users/" + uid).on("value", snapshot => {
        userData = snapshot.val();
        if (userData) {
            document.getElementById('userNameHeader').innerText = userData.name.split(' ')[0];
            document.getElementById('profName').innerText = userData.name;
            document.getElementById('profEmail').innerText = userData.email;
            document.getElementById('profPhone').innerText = userData.phone;
            
            // Show saved address in profile
            const savedAddr = userData.addressDetail || JSON.parse(localStorage.getItem('toymall_saved_addr'));
            if (savedAddr) {
                document.getElementById('profAddr').innerText = `${savedAddr.house}, ${savedAddr.building}, ${savedAddr.pin}`;
                // Also pre-fill cart delivery fields
                if (document.getElementById('shipPincode')) {
                    document.getElementById('shipPincode').value = savedAddr.pin || '';
                    document.getElementById('shipHouseName').value = savedAddr.building || '';
                    document.getElementById('shipHouseNum').value = savedAddr.house || '';
                    lookupPincode(savedAddr.pin);
                }
            }
        }
    });
}

// Profile Edit Logic
function switchProfileToEdit() {
    document.getElementById('profileViewMain').style.display = 'none';
    document.getElementById('profileViewEdit').style.display = 'block';
    const pm = document.getElementById('profileModal');
    if (pm) pm.scrollTop = 0;

    document.getElementById('editName').value = userData.name;
    document.getElementById('editPhone').value = userData.phone;
    
    const savedAddr = userData.addressDetail || JSON.parse(localStorage.getItem('toymall_saved_addr'));
    if (savedAddr) {
        document.getElementById('editPincode').value = savedAddr.pin || '';
        document.getElementById('editAddress').value = `${savedAddr.house}, ${savedAddr.building}`;
    }
}

function cancelProfileEdit() {
    document.getElementById('profileViewMain').style.display = 'block';
    document.getElementById('profileViewEdit').style.display = 'none';
}

document.getElementById('editProfileForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const name = document.getElementById('editName').value;
    const phone = document.getElementById('editPhone').value;
    const pin = document.getElementById('editPincode').value;
    const addrRaw = document.getElementById('editAddress').value;
    
    // Split addrRaw simple logic (House, Building)
    const parts = addrRaw.split(',');
    const house = parts[0] ? parts[0].trim() : '';
    const building = parts[1] ? parts[1].trim() : '';
    
    const addressDetail = { house, building, pin };
    
    try {
        await db.ref("users/" + currentUser.uid).update({ 
            name, phone, addressDetail 
        });
        localStorage.setItem('toymall_saved_addr', JSON.stringify(addressDetail));
        cancelProfileEdit();
    } catch (err) { alert(err.message); }
};



function logout() { 
    if (confirm("Are you sure you want to logout?")) {
        firebase.auth().signOut(); 
        // Optional: Should we clear cart on logout? Usually no, but let's refresh UI
        updateCartUI();
        closeModals();
        closeMobileMenu();
    }
}

function openMobileMenu() {
    if (mobileMenu) {
        mobileMenu.classList.add('active');
    }
}

function closeMobileMenu() {
    if (mobileMenu) {
        mobileMenu.classList.remove('active');
    }
}

// --- 3. Shop Logic ---
init();

function init() {
    updateCartUI();
    fillShopFilterSelects();
    restoreSavedFilters();   // ← restore after options are filled
    fetchProducts();
    fetchOffers();
    setupEventListeners();
    setupOffersCarouselControls();
}

/* Restore saved filters from localStorage and apply to UI */
function restoreSavedFilters() {
    // 1. Restore filter state
    const saved = localStorage.getItem('toymall_filters');
    if (saved) {
        try {
            const f = JSON.parse(saved);
            shopFilters.q        = f.q        || '';
            shopFilters.category = f.category || '';
            shopFilters.gender   = f.gender   || '';
            shopFilters.age      = f.age      || '';
        } catch(e) {}
    }

    // 2. Push values into the select/input elements
    const ids = {
        shopSearch:           shopFilters.q,
        filterCategory:       shopFilters.category,
        filterGender:         shopFilters.gender,
        filterAge:            shopFilters.age,
        mobileShopSearch:     shopFilters.q,
        mobileFilterCategory: shopFilters.category,
        mobileFilterGender:   shopFilters.gender,
        mobileFilterAge:      shopFilters.age,
    };
    Object.entries(ids).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });

    // 3. Load cached products and render immediately (no Firebase wait)
    const cached = localStorage.getItem('toymall_products_cache');
    if (cached) {
        try {
            products = JSON.parse(cached);
            renderProducts(); // instant render with saved filters
        } catch(e) {}
    }

    // 4. Apply teal highlight + show filter chips bar
    updateActiveFiltersBar();
}

function fillShopFilterSelects() {
    if (typeof CATALOG_CATEGORIES === 'undefined') return;
    const fc = document.getElementById('filterCategory');
    const mfc = document.getElementById('mobileFilterCategory');
    const fg = document.getElementById('filterGender');
    const mfg = document.getElementById('mobileFilterGender');
    const fa = document.getElementById('filterAge');
    const mfa = document.getElementById('mobileFilterAge');
    if (fc) {
        fc.innerHTML = '<option value="">All categories</option>';
        CATALOG_CATEGORIES.forEach((c) => {
            fc.innerHTML += `<option value="${escapeAttr(c.id)}">${escapeHtml(c.label)}</option>`;
        });
    }
    if (mfc) {
        mfc.innerHTML = '<option value="">All categories</option>';
        CATALOG_CATEGORIES.forEach((c) => {
            mfc.innerHTML += `<option value="${escapeAttr(c.id)}">${escapeHtml(c.label)}</option>`;
        });
    }
    if (fg) {
        fg.innerHTML = `
            <option value="">All genders</option>
            <option value="boy">Boys</option>
            <option value="girl">Girls</option>
        `;
    }
    if (mfg) {
        mfg.innerHTML = `
            <option value="">All genders</option>
            <option value="boy">Boys</option>
            <option value="girl">Girls</option>
        `;
    }
    if (fa) {
        fa.innerHTML = '<option value="">All ages</option>';
        CATALOG_AGE_GROUPS.forEach((a) => {
            fa.innerHTML += `<option value="${escapeAttr(a.id)}">${escapeHtml(a.label)}</option>`;
        });
    }
    if (mfa) {
        mfa.innerHTML = '<option value="">All ages</option>';
        CATALOG_AGE_GROUPS.forEach((a) => {
            mfa.innerHTML += `<option value="${escapeAttr(a.id)}">${escapeHtml(a.label)}</option>`;
        });
    }
}

function getFilteredProducts() {
    let filtered = products.filter((p) => {
        if (shopFilters.category) {
            const c = p.category || 'general';
            if (c !== shopFilters.category) return false;
        }
        if (shopFilters.gender) {
            const g = (p.gender || 'unisex').toLowerCase();
            if (shopFilters.gender === 'boy' && g !== 'boy' && g !== 'unisex') return false;
            if (shopFilters.gender === 'girl' && g !== 'girl' && g !== 'unisex') return false;
        }
        if (shopFilters.age) {
            if (p.ageGroup && p.ageGroup !== shopFilters.age) return false;
        }
        if (shopFilters.q) {
            const q = shopFilters.q.toLowerCase().trim();
            if (!q) return true;
            const n = (p.name || '').toLowerCase();
            const d = (p.description || '').toLowerCase();
            if (!n.includes(q) && !d.includes(q)) return false;
        }
        return true;
    });

    // If a product is boosted (from banner click), bring it to the top
    if (boostedProductId) {
        const idx = filtered.findIndex(p => p.id === boostedProductId);
        if (idx > -1) {
            const [p] = filtered.splice(idx, 1);
            filtered.unshift(p);
        }
    }
    return filtered;
}

function hideSameCategorySection() {
    const section = document.getElementById('sameCategorySection');
    if (!section) return;
    section.classList.add('is-hidden');
    section.style.display = 'none';
}

function renderSameCategorySection(categoryId, excludeProductId) {
    const section = document.getElementById('sameCategorySection');
    const grid = document.getElementById('sameCategoryGrid');
    const titleEl = document.getElementById('sameCategoryTitle');
    if (!section || !grid || !titleEl) return;

    const cid = categoryId || 'general';
    const related = products.filter(
        (p) => (p.category || 'general') === cid && p.id !== excludeProductId
    );
    if (related.length === 0) {
        hideSameCategorySection();
        return;
    }
    const label = typeof catalogLabel === 'function' ? catalogLabel(CATALOG_CATEGORIES, cid) : cid;
    titleEl.textContent = `More ${label} toys`;
    grid.innerHTML = related.map((p) => createToyCard(p)).join('');
    section.classList.remove('is-hidden');
    section.style.display = 'block';
}

function onOfferBannerClick(productId) {
    if (!productId) return;
    
    const p = products.find((x) => x.id === productId);
    if (!p) return;

    // Filter by product category
    shopFilters.category = p.category || 'general';
    boostedProductId = productId; // Prioritize this product
    
    // Update UI select if it exists
    const fc = document.getElementById('filterCategory');
    if (fc) fc.value = shopFilters.category;

    // Scroll to shop
    const shopEl = document.getElementById('shop');
    if (shopEl) shopEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Refresh products view
    renderProducts();
    
    // Also show related section if desired, but prioritize main grid
    renderSameCategorySection(p.category || 'general', productId);
    
    // Optionally open details after scrolling
    setTimeout(() => {
        showToyDetails(productId);
    }, 800);
}

function fetchOffers() {
    isLoadingOffers = true;
    db.ref('offers').on('value', (snapshot) => {
        const data = snapshot.val();
        offersList = data
            ? Object.keys(data)
                  .map((key) => ({ id: key, ...data[key] }))
                  .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
            : [];
        currentOfferIndex = 0;
        isLoadingOffers = false;
        renderOffersCarousel();
    });
}

function renderOffersCarousel() {
    const section = document.getElementById('offersCarouselSection');
    const track = document.getElementById('offersCarouselTrack');
    const dots = document.getElementById('offersCarouselDots');
    if (!section || !track || !dots) return;

    const isSearchActive = shopFilters.q || shopFilters.category || shopFilters.gender || shopFilters.age;
    if (isSearchActive) {
        section.classList.add('is-hidden');
        return;
    }

    if (offersCarouselTimer) {
        clearInterval(offersCarouselTimer);
        offersCarouselTimer = null;
    }

    if (isLoadingOffers) {
        section.classList.remove('is-hidden');
        track.innerHTML = `
            <div class="offer-slide skeleton" style="background: #f1f5f9;">
                <div class="offer-slide-inner" style="opacity: 0.5;">
                    <div class="skeleton-title skeleton" style="width: 200px; height: 3rem;"></div>
                    <div class="skeleton-text skeleton" style="width: 300px; height: 1.5rem;"></div>
                </div>
            </div>`;
        dots.innerHTML = '';
        return;
    }

    if (offersList.length === 0) {
        section.classList.add('is-hidden');
        track.innerHTML = '';
        dots.innerHTML = '';
        return;
    }

    section.classList.remove('is-hidden');
    currentOfferIndex = Math.min(currentOfferIndex, offersList.length - 1);

    track.innerHTML = offersList
        .map((o) => {
            const title = escapeHtml(o.title || 'Special offer');
            const sub = escapeHtml(o.subtitle || 'Tap to shop this toy');
            const pid = escapeAttr(o.productId || '');
            const bg = o.image ? `background-image:url('${escapeAttr(o.image)}')` : '';
            const tColor = o.titleColor ? `color:${escapeAttr(o.titleColor)};` : '';
            const sColor = o.subtitleColor ? `color:${escapeAttr(o.subtitleColor)};` : '';

            return `
            <div class="offer-slide" data-product-id="${pid}" style="${bg}" role="button" tabindex="0" aria-label="${title}. Shop now.">
                <div class="offer-slide-inner">
                    <span class="offer-slide-kicker">ToyMall picks</span>
                    <h3 class="offer-slide-title" style="${tColor}">${title}</h3>
                    <p class="offer-slide-sub" style="${sColor}">${sub}</p>
                    <span class="offer-slide-cta">Shop now</span>
                </div>
            </div>`;
        })
        .join('');

    dots.innerHTML = offersList
        .map(
            (_, i) =>
                `<button type="button" class="offers-carousel-dot ${i === currentOfferIndex ? 'is-active' : ''}" data-offer-dot="${i}" aria-label="Go to offer ${i + 1}"></button>`
        )
        .join('');

    updateOffersCarouselPosition();
    if (offersList.length > 1) {
        offersCarouselTimer = setInterval(() => {
            currentOfferIndex = (currentOfferIndex + 1) % offersList.length;
            updateOffersCarouselPosition();
        }, 6500);
    }
}

function updateOffersCarouselPosition() {
    const track = document.getElementById('offersCarouselTrack');
    const dots = document.getElementById('offersCarouselDots');
    if (!track) return;
    track.style.transform = `translateX(-${currentOfferIndex * 100}%)`;
    if (dots) {
        dots.querySelectorAll('.offers-carousel-dot').forEach((d, i) => {
            d.classList.toggle('is-active', i === currentOfferIndex);
        });
    }
}

function setupOffersCarouselControls() {
    const prev = document.getElementById('offersPrev');
    const next = document.getElementById('offersNext');
    const wrap = document.getElementById('offersCarousel');
    const dots = document.getElementById('offersCarouselDots');

    if (prev) {
        prev.addEventListener('click', () => {
            if (offersList.length < 2) return;
            currentOfferIndex = (currentOfferIndex - 1 + offersList.length) % offersList.length;
            updateOffersCarouselPosition();
        });
    }
    if (next) {
        next.addEventListener('click', () => {
            if (offersList.length < 2) return;
            currentOfferIndex = (currentOfferIndex + 1) % offersList.length;
            updateOffersCarouselPosition();
        });
    }
    if (dots) {
        dots.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-offer-dot]');
            if (!btn) return;
            const i = Number(btn.getAttribute('data-offer-dot'));
            if (Number.isFinite(i)) {
                currentOfferIndex = i;
                updateOffersCarouselPosition();
            }
        });
    }
    if (wrap) {
        wrap.addEventListener('click', (e) => {
            const slide = e.target.closest('.offer-slide');
            if (!slide) return;
            const id = slide.getAttribute('data-product-id');
            if (id) onOfferBannerClick(id);
        });
        wrap.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const slide = e.target.closest('.offer-slide');
            if (!slide) return;
            e.preventDefault();
            const id = slide.getAttribute('data-product-id');
            if (id) onOfferBannerClick(id);
        });
    }
}

/* applyShopFiltersFromUI — kept for backward compat (called from clear buttons) */
function applyShopFiltersFromUI() {
    // Reads current shopFilters state and applies — do NOT re-read from DOM here.
    // (DOM reads were broken: desktop `||` would ignore mobile element values)
    doApplyFilters();
}

/* Core: render + sync inputs + update bar + save — NO DOM reads */
function doApplyFilters() {
    boostedProductId = null;
    hideSameCategorySection();
    renderProducts();
    syncFilterValues();       // mirrors shopFilters → all inputs
    updateActiveFiltersBar();
    localStorage.setItem('toymall_filters', JSON.stringify(shopFilters));
}


/* ---- Active Filters Bar ---- */
function updateActiveFiltersBar() {
    const bar = document.getElementById('activeFiltersBar');
    const chipsEl = document.getElementById('activeFiltersChips');
    if (!bar || !chipsEl) return;

    const chips = [];

    // Search chip
    if (shopFilters.q) {
        chips.push({ type: 'search', label: `"${shopFilters.q}"`, icon: 'fa-search', key: 'q' });
    }

    // Category chip — find label from CATALOG_CATEGORIES if available
    if (shopFilters.category) {
        let label = shopFilters.category;
        if (typeof CATALOG_CATEGORIES !== 'undefined') {
            const found = CATALOG_CATEGORIES.find(c => c.id === shopFilters.category);
            if (found) label = found.label;
        }
        chips.push({ type: 'filter', label, icon: 'fa-tag', key: 'category' });
    }

    // Gender chip
    if (shopFilters.gender) {
        const gLabel = shopFilters.gender === 'boy' ? 'Boys' : shopFilters.gender === 'girl' ? 'Girls' : shopFilters.gender;
        chips.push({ type: 'filter', label: gLabel, icon: 'fa-venus-mars', key: 'gender' });
    }

    // Age chip
    if (shopFilters.age) {
        let label = shopFilters.age;
        if (typeof CATALOG_AGE_GROUPS !== 'undefined') {
            const found = CATALOG_AGE_GROUPS.find(a => a.id === shopFilters.age);
            if (found) label = found.label;
        }
        chips.push({ type: 'filter', label, icon: 'fa-child', key: 'age' });
    }

    // Show/hide bar
    if (chips.length === 0) {
        bar.style.display = 'none';
        chipsEl.innerHTML = '';
    } else {
        bar.style.display = '';
        // Re-trigger animation
        bar.style.animation = 'none';
        bar.offsetHeight; // reflow
        bar.style.animation = '';
        chipsEl.innerHTML = chips.map(c =>
            `<span class="filter-chip ${c.type === 'search' ? 'chip-search' : ''}">
                <i class="fas ${c.icon} chip-icon"></i>${c.label}
                <button class="filter-chip-remove" onclick="removeFilterChip('${c.key}')" title="Remove filter">
                    <i class="fas fa-times"></i>
                </button>
            </span>`
        ).join('');
    }

    // Highlight active select elements
    ['filterCategory', 'filterGender', 'filterAge'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.value) {
            el.classList.add('filter-active');
        } else {
            el.classList.remove('filter-active');
        }
    });
}

function removeFilterChip(key) {
    // Clear from state
    shopFilters[key] = '';

    // Clear the matching UI inputs
    const idMap = { q: ['shopSearch', 'mobileShopSearch'], category: ['filterCategory', 'mobileFilterCategory'], gender: ['filterGender', 'mobileFilterGender'], age: ['filterAge', 'mobileFilterAge'] };
    (idMap[key] || []).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    boostedProductId = null;
    hideSameCategorySection();
    renderProducts();
    syncFilterValues();
    updateActiveFiltersBar();
    // Persist updated state
    localStorage.setItem('toymall_filters', JSON.stringify(shopFilters));
}



function syncFilterValues() {
    // shopFilters is the source of truth — mirror it into ALL inputs
    // Skip the currently focused element so we never interrupt the user while typing
    const active = document.activeElement;
    const map = [
        ['shopSearch',              shopFilters.q],
        ['mobileShopSearch',        shopFilters.q],
        ['mobileSearchStripInput',  shopFilters.q],
        ['filterCategory',          shopFilters.category],
        ['mobileFilterCategory',    shopFilters.category],
        ['filterGender',            shopFilters.gender],
        ['mobileFilterGender',      shopFilters.gender],
        ['filterAge',               shopFilters.age],
        ['mobileFilterAge',         shopFilters.age],
    ];
    map.forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && el !== active) el.value = val;
    });
}



let initialURLCheckDone = false;

async function fetchProducts() {
    isLoadingProducts = true;
    db.ref('products').on('value', (snapshot) => {
        const data = snapshot.val();
        products = data ? Object.keys(data).map((key) => ({ id: key, ...data[key] })) : [];
        // Cache products locally so next load is instant
        try { localStorage.setItem('toymall_products_cache', JSON.stringify(products)); } catch(e) {}
        isLoadingProducts = false;
        renderProducts();

        // Check for product deep link on first load
        if (!initialURLCheckDone && products.length > 0) {
            initialURLCheckDone = true;
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('product');
            if (productId && products.find(p => p.id === productId)) {
                // slight timeout to allow UI to settle
                setTimeout(() => showToyDetails(productId), 300);
            }
        }
    });
}


function renderProducts() {
    const isSearchActive = shopFilters.q || shopFilters.category || shopFilters.gender || shopFilters.age;
    const hero = document.getElementById('heroSection');
    const banners = document.getElementById('offersCarouselSection');

    if (isSearchActive) {
        if (hero) hero.style.display = 'none';
        if (banners) banners.classList.add('is-hidden');
    } else {
        if (hero) hero.style.display = 'block';
        // Only show banners back if we have actual data (prevents skeleton flash if data not ready)
        if (banners && offersList.length > 0) banners.classList.remove('is-hidden');
    }

    if (isLoadingProducts) {
        // Main Grid Skeletons
        productGrid.innerHTML = Array(6).fill(0).map(() => `
            <div class="skeleton-card">
              <div class="skeleton-img skeleton"></div>
              <div class="skeleton-title skeleton"></div>
              <div class="skeleton-text skeleton"></div>
              <div class="skeleton-text skeleton" style="width: 80%;"></div>
              <div class="skeleton-price skeleton"></div>
              <div class="skeleton-btn skeleton"></div>
            </div>
        `).join('');

        // Special Deals Skeletons
        if (!isSearchActive) {
            specialOffersSection.style.display = 'block';
            pinnedItemsGrid.innerHTML = Array(3).fill(0).map(() => `
                <div class="skeleton-card">
                  <div class="skeleton-img skeleton"></div>
                  <div class="skeleton-title skeleton"></div>
                  <div class="skeleton-price skeleton"></div>
                  <div class="skeleton-btn skeleton"></div>
                </div>
            `).join('');
        } else {
            specialOffersSection.style.display = 'none';
        }
        return;
    }

    const filtered = getFilteredProducts();
    
    // If searching, show all matching items (including pinned) in the main grid.
    // If not searching, only show normal items in the main grid and pinned ones in the special section.
    let itemsToDisplay;
    if (isSearchActive) {
        itemsToDisplay = filtered;
    } else {
        itemsToDisplay = filtered.filter((p) => !p.isPinned);
    }

    if (itemsToDisplay.length > 0) {
        productGrid.innerHTML = itemsToDisplay.map((p) => createToyCard(p, p.isPinned)).join('');
    } else {
        productGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #b2bec3; font-weight: 700;">No toys match your filters — try clearing search or filters.</p>`;
    }

    const pinnedItems = products.filter((p) => p.isPinned);
    if (pinnedItems.length > 0 && !isSearchActive) {
        specialOffersSection.style.display = 'block';
        pinnedItemsGrid.innerHTML = pinnedItems.map((p) => createToyCard(p, true)).join('');
    } else {
        specialOffersSection.style.display = 'none';
    }
}

function createToyCard(toy, isPinned = false) {
    const discount = toy.originalPrice > toy.price ? Math.round(((toy.originalPrice - toy.price) / toy.originalPrice) * 100) : 0;
    const stock = Number(toy.quantity) || 0;
    const isOutOfStock = stock <= 0;
    const idJs = escapeJs(toy.id);
    const nameSafe = escapeHtml(toy.name);
    const descSafe = escapeHtml(toy.description || 'A wonderful magical toy.');
    const imgSrc = escapeAttr(toy.image || 'https://via.placeholder.com/300');

    return `
        <div class="toy-card">
            ${isPinned ? '<div class="toy-badge"><i class="fas fa-star"></i> Pinned</div>' : ''}
            <div class="toy-stock" style="${stock < 5 ? 'color: #ef4444;' : ''}">
                ${isOutOfStock ? 'OUT OF STOCK' : `Stock: ${stock}`}
            </div>
            <div class="toy-img-wrapper" onclick="showToyDetails('${idJs}')" style="cursor: pointer;">
                ${discount > 0 ? `<span class="toy-discount-pill" aria-label="${discount} percent off">${discount}% OFF</span>` : ''}
                <img src="${imgSrc}" alt="${nameSafe}" class="toy-img">
            </div>
            <div class="toy-content">
                <h3 style="font-size: 1.15rem; font-weight: 700; line-height: 1.3; margin-bottom: 0.4rem; color: #2d3436; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${nameSafe}</h3>
                <div class="toy-price">
                    <span>₹${toy.price}</span>
                    ${toy.originalPrice > toy.price ? `<del>₹${toy.originalPrice}</del>` : ''}
                </div>
                <div class="card-action-row" style="margin-top: auto; padding-top: 1.2rem; display: flex; gap: 0.5rem;">
                    <button type="button" class="add-btn" style="flex: 1; margin: 0;" onclick="addToCart('${idJs}', event)" ${isOutOfStock ? 'disabled style="background: #dfe6e9; cursor: not-allowed;"' : ''}>
                        ${isOutOfStock ? '<i class="fas fa-times"></i> Out of Stock' : '<i class="fas fa-cart-plus"></i> Add to Basket'}
                    </button>
                    <button type="button" class="add-btn" style="flex: none; margin: 0; width: 44px; padding: 0; display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 12px;" onclick="shareProduct('${idJs}', event)" aria-label="Share ${nameSafe}" title="Share ${nameSafe}">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function shareProduct(id, event) {
    if (event) event.stopPropagation();
    const toy = products.find(p => p.id === id);
    if (!toy) return;

    // Build absolute URL for the item
    const url = window.location.origin + window.location.pathname + '?product=' + encodeURIComponent(id);
    const shareData = {
        title: `ToyMall: ${toy.name}`,
        text: `Look at this awesome toy I found on ToyMall: ${toy.name} for ₹${toy.price}!`,
        url: url
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Share failed:', err);
        }
    } else {
        // Fallback to clipboard
        try {
            await navigator.clipboard.writeText(url);
            alert("Link copied to clipboard! You can paste it to share.");
        } catch (err) {
            prompt("Copy this link to share:", url);
        }
    }
}

// --- 4. Cart Logic ---
/** Animate a product thumbnail flying from `origin` (element or DOMRect) to the basket button. */
function flyItemToCart(origin, imageSrc) {
    if (!openCartBtn || !imageSrc) return;
    const start = origin instanceof HTMLElement ? origin.getBoundingClientRect() : origin;
    if (!start || start.width < 1 && start.height < 1) return;

    const end = openCartBtn.getBoundingClientRect();
    const size = 52;
    const el = document.createElement('div');
    el.className = 'cart-fly-ghost';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;left:${start.left + start.width / 2 - size / 2}px;top:${start.top + start.height / 2 - size / 2}px;width:${size}px;height:${size}px;z-index:10050;pointer-events:none;border-radius:14px;background-size:cover;background-position:center;box-shadow:0 10px 28px rgba(0,0,0,.18);`;
    el.style.backgroundImage = `url(${JSON.stringify(String(imageSrc))})`;
    document.body.appendChild(el);

    const x0 = start.left + start.width / 2 - size / 2;
    const y0 = start.top + start.height / 2 - size / 2;
    const x1 = end.left + end.width / 2 - size / 2;
    const y1 = end.top + end.height / 2 - size / 2;

    el.animate(
        [
            { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
            { transform: `translate(${x1 - x0}px, ${y1 - y0}px) scale(0.28) rotate(-12deg)`, opacity: 0.92 }
        ],
        { duration: 680, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    ).onfinish = () => el.remove();
}

function addToCart(id, evt, flyFromModal) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const existing = cart.find(item => item.id === id);
    if (existing) {
        if (existing.quantity >= product.quantity) {
            alert("No more items left in stock!");
            return;
        }
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    const imgSrc = product.image || 'https://via.placeholder.com/300';
    if (flyFromModal && flyFromModal.flyRect) {
        flyItemToCart(flyFromModal.flyRect, flyFromModal.flyImage || imgSrc);
    } else if (evt && evt.currentTarget) {
        const card = evt.currentTarget.closest('.toy-card');
        const imgEl = card && card.querySelector('.toy-img');
        flyItemToCart(imgEl || evt.currentTarget, imgSrc);
    }

    saveCart(); updateCartUI(); openCart();

    const btn = document.getElementById('openCart');
    btn.classList.remove('cart-bounce');
    void btn.offsetWidth;
    btn.classList.add('cart-bounce');
    setTimeout(() => btn.classList.remove('cart-bounce'), 400);
}

function updateQuantity(id, delta) {
    const item = cart.find(i => i.id === id);
    const prod = products.find(p => p.id === id);
    if (item) {
        if (delta === -1000) {
            if (!confirm(`Remove ${item.name} from basket?`)) return;
            cart = cart.filter(i => i.id !== id);
        } else {
            if (delta > 0 && prod && item.quantity >= prod.quantity) {
                 alert("No more items in stock!"); return;
            }
            item.quantity += delta;
            if (item.quantity < 1) {
                if (!confirm(`Remove ${item.name} from basket?`)) {
                    item.quantity = 1; 
                } else {
                    cart = cart.filter(i => i.id !== id);
                }
            }
        }
        saveCart(); updateCartUI();
    }
}

function saveCart() { localStorage.setItem('toymall_cart', JSON.stringify(cart)); }

function updateCartUI() {
    const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    cartCount.innerText = totalCount;

    if (cart.length === 0) {
        cartItemsList.innerHTML = `<p class="cart-empty-msg">Your basket is empty — fill it with fun!</p>`;
        cartFooter.style.display = 'none'; return;
    }

    cartFooter.style.display = 'block';
    let total = 0;
    cartItemsList.innerHTML = cart.map(item => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        total += price * qty;
        const name = escapeHtml(item.name || 'Lovely Toy');
        const idAttr = escapeAttr(item.id);
        const imgSrc = escapeAttr(item.image || 'https://via.placeholder.com/100');
        return `
            <div class="cart-item-row" data-cart-id="${idAttr}">
                <img class="cart-item-thumb" src="${imgSrc}" alt="">
                <div class="cart-item-meta">
                    <h4 class="cart-item-title">${name}</h4>
                    <p class="cart-item-price">₹${price}</p>
                    <div class="cart-item-qty">
                        <button type="button" class="cart-qty-btn" data-cart-delta="-1" aria-label="Decrease quantity">−</button>
                        <span class="cart-qty-val">${qty}</span>
                        <button type="button" class="cart-qty-btn" data-cart-delta="1" aria-label="Increase quantity">+</button>
                    </div>
                </div>
                <button type="button" class="cart-remove-btn" data-cart-remove="1" title="Remove"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
            </div>
        `;
    }).join('');
    totalDisplay.innerText = `₹${total}`;
}

// --- 5. Order Logic ---
// Purchase Mode & Address Logic
let purchaseMode = 'delivery';

function setPurchaseMode(mode) {
    purchaseMode = mode;
    document.getElementById('mode-delivery').classList.toggle('active', mode === 'delivery');
    document.getElementById('mode-visit').classList.toggle('active', mode === 'visit');
    document.getElementById('deliveryFields').style.display = (mode === 'delivery' ? 'block' : 'none');
}

async function lookupPincode(pin) {
    if (pin.length < 6) return;
    try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        if (data[0].Status === "Success") {
            const info = data[0].PostOffice[0];
            document.getElementById('shipState').value = info.State;
            document.getElementById('shipDistrict').value = info.District;
            document.getElementById('shipCity').value = info.Block;
        }
    } catch (e) { console.error("Pincode lookup failed", e); }
}

function setupEventListeners() {
    openCartBtn.onclick = openCart;
    closeCartBtn.onclick = closeCart;
    if (cartBackdrop) cartBackdrop.onclick = closeCart;

    const shopSearch = document.getElementById('shopSearch');
    const filterCategory = document.getElementById('filterCategory');
    const filterGender = document.getElementById('filterGender');
    const filterAge = document.getElementById('filterAge');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    if (shopSearch) {
        shopSearch.addEventListener('input', (e) => {
            shopFilters.q = e.target.value.trim();
            clearTimeout(shopSearchDebounce);
            shopSearchDebounce = setTimeout(() => doApplyFilters(), 220);
        });
    }
    if (filterCategory) filterCategory.addEventListener('change', (e) => { shopFilters.category = e.target.value; doApplyFilters(); });
    if (filterGender)   filterGender.addEventListener('change',   (e) => { shopFilters.gender   = e.target.value; doApplyFilters(); });
    if (filterAge)      filterAge.addEventListener('change',      (e) => { shopFilters.age      = e.target.value; doApplyFilters(); });

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            shopFilters.q = ''; shopFilters.category = ''; shopFilters.gender = ''; shopFilters.age = '';
            doApplyFilters();
        });
    }

    // Mobile event listeners
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', openMobileMenu);
    }
    if (closeMobileMenuBtn) {
        closeMobileMenuBtn.addEventListener('click', closeMobileMenu);
    }
    if (mobileShopSearch) {
        mobileShopSearch.addEventListener('input', (e) => {
            shopFilters.q = e.target.value.trim();
            clearTimeout(shopSearchDebounce);
            shopSearchDebounce = setTimeout(() => doApplyFilters(), 220);
        });
    }
    if (mobileFilterCategory) mobileFilterCategory.addEventListener('change', (e) => { shopFilters.category = e.target.value; doApplyFilters(); });
    if (mobileFilterGender)   mobileFilterGender.addEventListener('change',   (e) => { shopFilters.gender   = e.target.value; doApplyFilters(); });
    if (mobileFilterAge)      mobileFilterAge.addEventListener('change',      (e) => { shopFilters.age      = e.target.value; doApplyFilters(); });

    if (mobileClearFiltersBtn) {
        mobileClearFiltersBtn.addEventListener('click', () => {
            shopFilters.q = ''; shopFilters.category = ''; shopFilters.gender = ''; shopFilters.age = '';
            doApplyFilters();
        });
    }

    // Mobile search strip (below navbar, always visible on mobile)
    const mobileSearchStripInput = document.getElementById('mobileSearchStripInput');
    if (mobileSearchStripInput) {
        mobileSearchStripInput.addEventListener('input', (e) => {
            shopFilters.q = e.target.value.trim();
            clearTimeout(shopSearchDebounce);
            shopSearchDebounce = setTimeout(() => doApplyFilters(), 220);
        });
    }

    // Active filter bar — "Clear all" button
    const activeFiltersClearBtn = document.getElementById('activeFiltersClearBtn');
    if (activeFiltersClearBtn) {
        activeFiltersClearBtn.addEventListener('click', () => {
            shopFilters.q = ''; shopFilters.category = ''; shopFilters.gender = ''; shopFilters.age = '';
            doApplyFilters();
        });
    }


    if (cartDrawerBody) {
        cartDrawerBody.addEventListener('click', (e) => {
            const row = e.target.closest('.cart-item-row');
            if (!row || !row.dataset.cartId) return;
            const id = row.dataset.cartId;
            if (e.target.closest('.cart-remove-btn') || e.target.closest('[data-cart-remove]')) {
                updateQuantity(id, -1000);
                return;
            }
            const qtyBtn = e.target.closest('[data-cart-delta]');
            if (qtyBtn) {
                const d = Number(qtyBtn.getAttribute('data-cart-delta'));
                if (d === 1 || d === -1) updateQuantity(id, d);
            }
        });
    }

    whatsappBtn.onclick = async () => {
        const customerName = (document.getElementById('guestName')?.value || '').trim();
        const customerPhone = (document.getElementById('guestPhone')?.value || '').trim();

        if (!customerName) { alert('Please enter your name!'); return; }
        if (!customerPhone) { alert('Please enter your WhatsApp number!'); return; }

        let address = 'Visit to Shop';
        let detailedAddress = null;

        if (purchaseMode === 'delivery') {
            const house = document.getElementById('shipHouseNum').value;
            const building = document.getElementById('shipHouseName').value;
            const city = document.getElementById('shipCity').value;
            const dist = document.getElementById('shipDistrict').value;
            const state = document.getElementById('shipState').value;
            const pin = document.getElementById('shipPincode').value;

            if (!house || !building || !city || !pin) {
                alert('Please fill all delivery fields!'); return;
            }
            address = `${house}, ${building}, ${city}, ${dist}, ${state} - ${pin}`;
            detailedAddress = { house, building, city, dist, state, pin };
         }

        const total = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);

        // Generate a human-readable order ID
        const orderId = 'TM-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        const orderData = {
            orderId,
            userName: customerName,
            userPhone: customerPhone,
            purchaseMode,
            address,
            detailedAddress,
            items: cart,
            total,
            status: 'pending',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            logs: [{ status: 'pending', date: new Date().toISOString() }]
        };

        try {
            await db.ref('bookings').push(orderData);

            // Build WhatsApp message with Order ID and item list
            const itemLines = cart.map(i => `  • ${i.name} x${i.quantity} — ₹${i.price * i.quantity}`).join('\n');
            const msg =
`🛒 *New ToyMall Order*
📦 Order ID: *${orderId}*
👤 Name: ${customerName}
📞 Phone: ${customerPhone}
${purchaseMode === 'delivery' ? '📍 Address: ' + address : '🏪 Shop Visit'}

${itemLines}

💰 *Total: ₹${total}*

Please confirm my order. Thank you!`;

            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
            cart = []; saveCart(); updateCartUI(); closeCart();
            alert(`Order placed! 🎉\nYour Order ID: ${orderId}\nTrack via WhatsApp.`);
        } catch (e) { alert(e.message); }
    };
}

function fetchUserOrders(uid) {
    db.ref("bookings").orderByChild("userId").equalTo(uid).on("value", snapshot => {
        const data = snapshot.val();
        const orders = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        renderUserOrders(orders);
    });
}

function renderUserOrders(orders) {
    if (orders.length === 0) {
        userOrdersList.innerHTML = `<p class="orders-empty-msg">No orders yet. Start shopping! 🧸</p>`;
        return;
    }

    userOrdersList.innerHTML = orders.reverse().map(order => {
        // Status Filtering: Shop Visit only gets Pending & Accepted
        let statuses = ['pending', 'accepted', 'packing', 'shipped', 'delivered'];
        if (order.purchaseMode === 'visit') {
            statuses = ['pending', 'accepted'];
        }

        const currentIdx = statuses.indexOf(order.status);
        const isRejected = order.status === 'rejected';

        return `
            <div class="order-track-card">
                ${order.status === 'cancelled' ? '<div class="cancelled-stamp">CANCELLED</div>' : ''}
                <div class="order-card-top">
                    <div class="order-card-titles">
                        <h4 class="order-card-id">Order #${order.id.substring(0, 8)}</h4>
                        <p class="order-card-date">${new Date(order.timestamp).toLocaleString()}</p>
                    </div>
                    <div class="order-card-meta">
                        <span class="order-mode-pill">${order.purchaseMode}</span>
                        <span class="order-card-total">₹${order.total}</span>
                    </div>
                </div>

                <div class="order-items-block">
                    ${order.items.map(i => `
                        <div class="order-item-row">
                            <img src="${i.image}" alt="" class="order-item-thumb">
                            <div class="order-item-text">
                                <strong>${i.name}</strong> <span class="order-item-qty">× ${i.quantity}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="status-timeline" role="list" aria-label="Order progress">
                    ${statuses.map((s, idx) => `
                        <div class="status-step ${idx <= currentIdx && !isRejected ? 'active' : ''} ${isRejected ? 'rejected' : ''}" role="listitem">
                            <span class="status-step-marker">
                                <i class="fas fa-${s === 'shipped' ? 'truck' : (s === 'delivered' ? 'gift' : 'check')}" aria-hidden="true"></i>
                            </span>
                            <div class="status-label">${s.toUpperCase()}</div>
                        </div>
                    `).join('')}
                </div>

                ${isRejected ? `<p class="order-rejected-msg">REJECTED</p>` : ''}
                
                ${order.deliveryDate ? `
                    <div class="order-delivery-estimate">
                        <i class="fas fa-calendar-alt" aria-hidden="true"></i> 
                        <strong>Est. Delivery:</strong> ${new Date(order.deliveryDate).toLocaleDateString()}
                    </div>
                ` : ''}

                <div class="order-latest-bar">
                    <div class="order-latest-text">
                        <strong>Latest Update:</strong> ${order.logs ? order.logs[order.logs.length-1].status.toUpperCase() + ' on ' + new Date(order.logs[order.logs.length-1].date).toLocaleDateString() : 'Pending'}
                    </div>
                    ${(order.status === 'pending' || order.status === 'accepted') ? `
                        <button type="button" class="order-cancel-btn" onclick="userCancelOrder('${order.id}')">Cancel</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function userCancelOrder(orderId) {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    
    // We need to fetch the latest order state to check if we need to return stock
    const snapshot = await db.ref("bookings/" + orderId).get();
    const order = snapshot.val();
    if (!order) return;

    if (order.status === 'accepted') {
        // Return items to stock
        for (const item of order.items) {
            const pSnap = await db.ref("products/" + item.id).get();
            const product = pSnap.val();
            if (product) {
                const newQty = (Number(product.quantity) || 0) + (Number(item.quantity) || 1);
                await db.ref("products/" + item.id).update({ quantity: newQty });
            }
        }
    }

    const newLogs = [...(order.logs || []), { status: 'cancelled', date: new Date().toISOString() }];
    await db.ref("bookings/" + orderId).update({ status: 'cancelled', logs: newLogs });
    alert("Order cancelled successfully.");
}

// --- 6. Toy Details & Slider Logic ---
let currentSliderIndex = 0;
let currentSliderImages = [];

function showToyDetails(id) {
    const toy = products.find(p => p.id === id);
    if (!toy) return;

    currentSliderIndex = 0;
    currentSliderImages = toy.images || [toy.image || 'https://via.placeholder.com/300'];

    document.getElementById('detailTitle').innerText = toy.name;
    document.getElementById('detailPrice').innerText = `₹${toy.price}`;

    const discountPct = toy.originalPrice > toy.price
        ? Math.round(((toy.originalPrice - toy.price) / toy.originalPrice) * 100)
        : 0;
    const detailPill = document.getElementById('detailDiscountPill');
    if (detailPill) {
        if (discountPct > 0) {
            detailPill.textContent = `${discountPct}% OFF`;
            detailPill.setAttribute('aria-label', `${discountPct} percent off`);
            detailPill.classList.remove('is-hidden');
        } else {
            detailPill.classList.add('is-hidden');
        }
    }

    const oldPriceEl = document.getElementById('detailOldPrice');
    if (toy.originalPrice > toy.price) {
        oldPriceEl.innerText = `₹${toy.originalPrice}`;
        oldPriceEl.hidden = false;
    } else {
        oldPriceEl.hidden = true;
    }

    document.getElementById('detailDesc').innerText = toy.description || "A wonderful magical toy.";
    const stock = Number(toy.quantity) || 0;
    const stockEl = document.getElementById('detailStock');
    stockEl.innerText = stock <= 0 ? 'OUT OF STOCK' : `Stock: ${stock}`;
    stockEl.classList.toggle('detail-stock--low', stock > 0 && stock < 5);
    stockEl.classList.toggle('detail-stock--out', stock <= 0);

    const addBtn = document.getElementById('detailAddToCartBtn');
    addBtn.onclick = (e) => {
        const flyRect = e.currentTarget.getBoundingClientRect();
        const flyImage = currentSliderImages[currentSliderIndex] || toy.image || 'https://via.placeholder.com/300';
        addToCart(toy.id, null, { flyRect, flyImage });
        closeModals();
    };
    addBtn.disabled = stock <= 0;

    const shareBtn = document.getElementById('detailShareBtn');
    if (shareBtn) {
        shareBtn.onclick = (e) => {
            shareProduct(toy.id, e);
        };
    }

    renderSlider();
    openModal('toyDetailsModal');
}

function renderSlider() {
    const slider = document.getElementById('toySlider');
    const thumbnails = document.getElementById('toyThumbnails');

    slider.innerHTML = currentSliderImages.map(img => `<img src="${img}" alt="Toy image">`).join('');
    thumbnails.innerHTML = currentSliderImages.map((img, idx) => `
        <img src="${img}" class="toy-thumb ${idx === currentSliderIndex ? 'active' : ''}" onclick="setSlide(${idx})">
    `).join('');

    updateSliderPosition();
}

function moveSlider(direction) {
    currentSliderIndex += direction;
    if (currentSliderIndex >= currentSliderImages.length) currentSliderIndex = 0;
    if (currentSliderIndex < 0) currentSliderIndex = currentSliderImages.length - 1;
    updateSliderPosition();
}

function setSlide(index) {
    currentSliderIndex = index;
    updateSliderPosition();
}

function updateSliderPosition() {
    const slider = document.getElementById('toySlider');
    slider.style.transform = `translateX(-${currentSliderIndex * 100}%)`;
    
    // Update thumbnails
    document.querySelectorAll('.toy-thumb').forEach((thumb, idx) => {
        thumb.classList.toggle('active', idx === currentSliderIndex);
    });
}

function openCart() {
    cartDrawer.classList.add('is-open');
    if (cartBackdrop) {
        cartBackdrop.classList.add('is-visible');
        cartBackdrop.setAttribute('aria-hidden', 'false');
    }
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    cartDrawer.classList.remove('is-open');
    if (cartBackdrop) {
        cartBackdrop.classList.remove('is-visible');
        cartBackdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
}
