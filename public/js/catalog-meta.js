/**
 * Shared toy catalog options for shop filters & admin product form.
 * Values are stored on each product in Firebase (category, gender, ageGroup).
 */
const CATALOG_CATEGORIES = [
  { id: 'action-figures', label: 'Action Figures & Heroes' },
  { id: 'dolls-playsets', label: 'Dolls & Playsets' },
  { id: 'vehicles-rc', label: 'Cars, RC & Vehicles' },
  { id: 'building-blocks', label: 'Building Blocks & LEGO-style' },
  { id: 'plush-soft', label: 'Plush & Soft Toys' },
  { id: 'educational', label: 'Educational & STEM' },
  { id: 'arts-crafts', label: 'Arts & Crafts' },
  { id: 'outdoor-sports', label: 'Outdoor & Sports' },
  { id: 'board-games', label: 'Board Games & Puzzles' },
  { id: 'baby-toddler', label: 'Baby & Toddler' },
  { id: 'collectibles', label: 'Collectibles' },
];

const CATALOG_GENDERS = [
  { id: 'unisex', label: 'Unisex (any child)' },
  { id: 'boy', label: 'Mostly for boys' },
  { id: 'girl', label: 'Mostly for girls' },
];

const CATALOG_AGE_GROUPS = [
  { id: '0-2', label: '0–2 years' },
  { id: '3-5', label: '3–5 years' },
  { id: '6-8', label: '6–8 years' },
  { id: '9-11', label: '9–11 years' },
  { id: '12-plus', label: '12+ years' },
];

function catalogLabel(list, id) {
  const row = list.find((x) => x.id === id);
  return row ? row.label : id || '—';
}

function fillSelect(selectEl, list, includeAll) {
  if (!selectEl) return;
  const cur = selectEl.value;
  selectEl.innerHTML = '';
  if (includeAll) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'All';
    selectEl.appendChild(o);
  }
  list.forEach((item) => {
    const o = document.createElement('option');
    o.value = item.id;
    o.textContent = item.label;
    selectEl.appendChild(o);
  });
  if (cur && [...selectEl.options].some((opt) => opt.value === cur)) selectEl.value = cur;
}
