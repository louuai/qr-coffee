(function () {
  const container = document.getElementById('menu-container');
  const statusEl = document.getElementById('menu-status');
  if (!container || !statusEl) return;

  const formatPrice = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
    const price = Number(value);
    return price.toFixed(2).replace('.', ',') + ' DT';
  };

  const createProductCard = (product) => {
    const hasImage = Boolean(product.image);
    return `
      <article class="menu-card menu-card--public">
        <div class="menu-card__media ${hasImage ? '' : 'menu-card__media--placeholder'}">
          ${hasImage ? `<img src="${product.image}" alt="${product.name}" loading="lazy" />` : '<span>?</span>'}
        </div>
        <div class="menu-card__body">
          <h3 class="menu-card__name">${product.name || 'Produit'}</h3>
          ${product.price !== null && product.price !== undefined ? `<p class="menu-card__price">${formatPrice(product.price)}</p>` : '<p class="menu-card__price muted">Prix sur demande</p>'}
        </div>
      </article>
    `;
  };

  const renderMenu = (items) => {
    if (!Array.isArray(items) || !items.length) {
      statusEl.textContent = "Menu indisponible pour le moment.";
      container.innerHTML = '';
      return;
    }

    statusEl.textContent = '';
    const groups = items.reduce((acc, item) => {
      const key = (item.category || 'Autres').trim();
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    container.innerHTML = Object.entries(groups)
      .map(([category, products]) => `
        <section class="menu-section">
          <div class="menu-section__header">
            <h2>${category}</h2>
            <span class="menu-section__count">${products.length} ${products.length > 1 ? 'articles' : 'article'}</span>
          </div>
          <div class="menu-products">
            ${products.map(createProductCard).join('')}
          </div>
        </section>
      `)
      .join('');
  };

  const renderError = (message) => {
    statusEl.textContent = message || "Impossible de charger le menu.";
    container.innerHTML = '';
  };

  const loadMenu = async () => {
    try {
      statusEl.textContent = 'Chargement du menu...';
      const response = await fetch('/api/menu');
      if (!response.ok) throw new Error('Réponse invalide du serveur');
      const data = await response.json();
      renderMenu(data);
    } catch (error) {
      console.error('[menu] fetch failed', error);
      renderError('Menu indisponible. Veuillez réessayer plus tard.');
    }
  };

  document.addEventListener('DOMContentLoaded', loadMenu);
})();
