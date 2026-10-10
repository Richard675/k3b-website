const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const STATIC = document.documentElement.dataset.static === '1';
const BASE = document.documentElement.dataset.base || './';
function toUrl(path) {
    if (!STATIC || !path.startsWith('/') || path.startsWith('//'))
        return path;
    const cut = path.search(/[?#]/);
    let p = (cut === -1 ? path : path.slice(0, cut)).slice(1);
    const rest = cut === -1 ? '' : path.slice(cut);
    if (!p || p.endsWith('/'))
        p += 'index.html';
    else if (!/\.[a-z0-9]+$/i.test(p))
        p += '/index.html';
    return BASE + p + rest;
}
let staticData = null;
function loadStaticData() {
    const embedded = window.K3B_DATA;
    if (embedded)
        return (staticData ?? (staticData = Promise.resolve(embedded)));
    staticData ?? (staticData = Promise.all([
        fetch(toUrl('/data/products.json')).then((r) => r.json()),
        fetch(toUrl('/data/categories.json')).then((r) => r.json()),
    ]).then(([p, c]) => ({ products: p.items, categories: c.items })));
    return staticData;
}
(() => {
    const toggle = $('.menu-toggle');
    const nav = $('#site-nav');
    if (!toggle || !nav)
        return;
    const label = $('.toggle-label', toggle);
    const setOpen = (open) => {
        document.body.classList.toggle('nav-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        if (label)
            label.textContent = open ? 'Close' : 'Menu';
        if (open)
            $('a', nav)?.focus();
    };
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    toggle.addEventListener('click', () => setOpen(!isOpen()));
    nav.addEventListener('click', (e) => { if (e.target.closest('a'))
        setOpen(false); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) {
            setOpen(false);
            toggle.focus();
        }
        if (e.key === 'Tab' && isOpen()) {
            const items = [toggle, ...$$('a', nav)];
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });
    window.matchMedia('(min-width: 1021px)').addEventListener('change', (e) => { if (e.matches)
        setOpen(false); });
})();
(() => {
    const header = $('.site-header');
    if (!header)
        return;
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
})();
(() => {
    const bar = $('.scroll-progress');
    const layers = $$('[data-parallax]');
    let ticking = false;
    const update = () => {
        ticking = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (bar)
            bar.style.setProperty('--progress', String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
        if (!reduceMotion)
            for (const l of layers) {
                const r = l.parentElement.getBoundingClientRect();
                if (r.bottom > 0)
                    l.style.transform = `translate3d(0, ${Math.round(-r.top * 0.18)}px, 0)`;
            }
    };
    window.addEventListener('scroll', () => { if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
    } }, { passive: true });
    update();
    const videos = $$('video[data-ambient]');
    if (!videos.length)
        return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
        videos.forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
        return;
    }
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            const v = e.target;
            if (e.isIntersecting) {
                v.muted = true;
                v.play().catch(() => { });
            }
            else
                v.pause();
        }
    }, { threshold: 0.15 });
    videos.forEach((v) => io.observe(v));
})();
(() => {
    const links = window.K3B_SOCIAL;
    if (!links)
        return;
    for (const el of $$('.si--pending[data-social]')) {
        const url = links[el.dataset.social];
        if (!url || !/^https:\/\//.test(url))
            continue;
        const a = document.createElement('a');
        a.className = el.className.replace('si--pending', '').trim();
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.dataset.social = el.dataset.social;
        a.setAttribute('aria-label', `K3B VENTURES on ${el.dataset.label}`);
        a.append(...Array.from(el.childNodes).filter((n) => !(n instanceof HTMLElement && n.classList.contains('visually-hidden'))));
        el.replaceWith(a);
    }
})();
function observeReveal(root = document) {
    const items = $$('[data-reveal]:not(.is-visible)', root);
    if (reduceMotion || !('IntersectionObserver' in window)) {
        items.forEach((i) => i.classList.add('is-visible'));
        return;
    }
    const io = new IntersectionObserver((entries) => {
        for (const entry of entries)
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                io.unobserve(entry.target);
            }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((i) => io.observe(i));
}
document.documentElement.classList.add('reveal-ready');
observeReveal();
const KEY = 'k3b.quote.v1';
const basket = {
    read() {
        try {
            const data = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(data) ? data.filter((l) => Number.isInteger(l?.id) && l.id > 0 && Number(l.qty) > 0).map((l) => ({ id: l.id, qty: Number(l.qty), note: typeof l.note === 'string' ? l.note.slice(0, 300) : '' })) : [];
        }
        catch {
            return [];
        }
    },
    write(lines) {
        try {
            localStorage.setItem(KEY, JSON.stringify(lines.slice(0, 60)));
        }
        catch { }
        updateCount();
    },
    add(id, qty) {
        const lines = basket.read();
        const found = lines.find((l) => l.id === id);
        if (found)
            found.qty = Math.min(1000000, found.qty + qty);
        else
            lines.push({ id, qty });
        basket.write(lines);
        return found ? found.qty : qty;
    },
};
function updateCount() {
    const count = basket.read().length;
    $$('[data-basket-count]').forEach((el) => { el.textContent = String(count); el.dataset.empty = String(count === 0); });
    $$('.basket-link').forEach((a) => a.setAttribute('aria-label', `Quote basket, ${count} ${count === 1 ? 'product' : 'products'}`));
}
updateCount();
window.addEventListener('storage', (e) => { if (e.key === KEY)
    updateCount(); });
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add-to-quote]');
    if (!btn)
        return;
    const id = Number(btn.dataset.id);
    if (!id)
        return;
    const total = basket.add(id, 1);
    btn.dataset.added = 'true';
    const span = $('span', btn);
    if (span)
        span.textContent = total > 1 ? `In quote (${total})` : 'Added';
    btn.setAttribute('aria-label', `${btn.dataset.name} added to your quote. ${total} in basket.`);
});
const addForm = $('[data-add-form]');
if (addForm) {
    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const qtyInput = $('[data-qty]', addForm);
        const qty = Math.max(1, Math.min(1000000, Math.round(Number(qtyInput.value) || 1)));
        qtyInput.value = String(qty);
        const total = basket.add(Number(addForm.dataset.id), qty);
        const msg = $('[data-added-msg]', addForm);
        if (msg) {
            msg.innerHTML = '';
            msg.append(`Added ${qty} to your quote (${total} in total). `);
            const link = document.createElement('a');
            link.href = toUrl('/quote');
            link.textContent = 'View quote basket';
            msg.append(link);
        }
    });
}
document.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (!step)
        return;
    const input = step.parentElement?.querySelector('input[type="number"]');
    if (!input)
        return;
    const next = Math.max(Number(input.min) || 1, Math.min(Number(input.max) || 1000000, (Number(input.value) || 0) + Number(step.dataset.step)));
    input.value = String(next);
    input.dispatchEvent(new Event('change', { bubbles: true }));
});
const area = $('[data-area]');
if (area) {
    area.addEventListener('input', () => {
        const coverage = Number(area.dataset.coverage);
        const sqm = Number(area.value);
        const out = $('[data-area-result]');
        const qty = $('[data-qty]');
        if (!coverage || !sqm || sqm <= 0 || !out || !qty)
            return;
        const boxes = Math.ceil(sqm / coverage);
        qty.value = String(boxes);
        out.textContent = `${sqm} m² needs about ${boxes} ${boxes === 1 ? 'box' : 'boxes'} (${coverage} m² per box), before cutting allowance. Quantity updated.`;
    });
}
(() => {
    const form = $('#filters');
    const results = $('#results');
    if (!form || !results)
        return;
    const panel = $('[data-filters-panel]');
    if (panel && window.matchMedia('(max-width: 900px)').matches)
        panel.open = false;
    if (STATIC) {
        staticCollections(form, results);
        return;
    }
    let controller = null;
    async function load(url, push) {
        controller?.abort();
        controller = new AbortController();
        results.setAttribute('aria-busy', 'true');
        try {
            const partial = new URL(url, location.origin);
            partial.searchParams.set('partial', '1');
            const res = await fetch(partial, { signal: controller.signal, headers: { Accept: 'text/html' } });
            if (!res.ok)
                throw new Error(String(res.status));
            results.innerHTML = await res.text();
            observeReveal(results);
            if (push)
                history.pushState({ collections: true }, '', url);
            syncForm(new URL(url, location.origin).searchParams);
        }
        catch (err) {
            if (err.name !== 'AbortError')
                location.href = url;
        }
        finally {
            results.removeAttribute('aria-busy');
        }
    }
    const formUrl = () => {
        const params = new URLSearchParams();
        for (const [k, v] of new FormData(form))
            if (typeof v === 'string' && v.trim() !== '' && !(k === 'sort' && v === 'featured'))
                params.set(k, v.trim());
        const sort = $('#sort');
        if (sort && sort.value !== 'featured')
            params.set('sort', sort.value);
        const qs = params.toString();
        return `/collections${qs ? `?${qs}` : ''}`;
    };
    function syncForm(params) {
        for (const el of $$('input[type="radio"]', form))
            el.checked = (params.get(el.name) ?? '') === el.value;
        for (const el of $$('select', form))
            el.value = params.get(el.name) ?? '';
        for (const el of $$('input[type="search"], input[type="number"]', form))
            el.value = params.get(el.name) ?? '';
    }
    form.addEventListener('submit', (e) => { e.preventDefault(); load(formUrl(), true); });
    document.addEventListener('change', (e) => {
        const t = e.target;
        if (t.matches('[data-autosubmit]') && (form.contains(t) || t.getAttribute('form') === 'filters'))
            load(formUrl(), true);
    });
    let timer = 0;
    $('#q', form)?.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => load(formUrl(), true), 450); });
    results.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-filter-link], .pagination a');
        if (!a || e.metaKey || e.ctrlKey)
            return;
        e.preventDefault();
        load(a.href, true);
        if (a.closest('.pagination'))
            results.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
    form.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-filter-link]');
        if (!a)
            return;
        e.preventDefault();
        load(a.href, true);
    });
    window.addEventListener('popstate', () => { if (location.pathname === '/collections')
        load(location.href, false); });
})();
(() => {
    const bar = $('[data-gallery-filters]');
    if (!bar)
        return;
    bar.hidden = false;
    bar.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-filter]');
        if (!chip)
            return;
        const f = chip.dataset.filter;
        $$('[data-filter]', bar).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        $$('[data-group]').forEach((g) => { g.hidden = f !== 'all' && g.dataset.group !== f; });
    });
})();
(() => {
    const dialog = $('#lightbox');
    if (!dialog || typeof dialog.showModal !== 'function')
        return;
    const img = $('img', dialog);
    const caption = $('.lb-caption', dialog);
    const count = $('.lb-count', dialog);
    let items = [];
    let index = 0;
    let opener = null;
    const visibleItems = () => $$('a[data-lightbox]').filter((a) => !a.closest('[hidden]') || a.closest('[data-product-gallery]'));
    function show(i) {
        index = (i + items.length) % items.length;
        const a = items[index];
        img.src = a.dataset.full || a.href;
        img.alt = a.dataset.caption || '';
        caption.textContent = a.dataset.caption || '';
        count.textContent = items.length > 1 ? `${index + 1} of ${items.length}` : '';
        $$('.lb-prev, .lb-next', dialog).forEach((b) => { b.hidden = items.length < 2; });
    }
    function open(a, from) {
        items = visibleItems();
        opener = from;
        show(Math.max(0, items.indexOf(a)));
        dialog.showModal();
        document.body.classList.add('lightbox-open');
    }
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-lightbox]');
        const zoom = e.target.closest('[data-open-main]');
        if (zoom) {
            const main = $('[data-main-link]');
            if (main) {
                e.preventDefault();
                open(main, zoom);
            }
            return;
        }
        if (!a || e.metaKey || e.ctrlKey)
            return;
        e.preventDefault();
        open(a, a);
    });
    dialog.addEventListener('click', (e) => {
        const t = e.target;
        if (t.closest('[data-lb-close]') || t === dialog || t.matches('figure'))
            dialog.close();
        else if (t.closest('[data-lb-prev]'))
            show(index - 1);
        else if (t.closest('[data-lb-next]'))
            show(index + 1);
    });
    dialog.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft')
            show(index - 1);
        if (e.key === 'ArrowRight')
            show(index + 1);
    });
    dialog.addEventListener('close', () => { document.body.classList.remove('lightbox-open'); img.removeAttribute('src'); opener?.focus(); });
})();
(() => {
    const gallery = $('[data-product-gallery]');
    if (!gallery)
        return;
    const mainLink = $('[data-main-link]', gallery);
    const mainImg = mainLink ? $('img', mainLink) : null;
    gallery.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-thumb]');
        if (!btn || !mainLink || !mainImg)
            return;
        mainImg.src = btn.dataset.src;
        if (btn.dataset.srcset)
            mainImg.srcset = btn.dataset.srcset;
        else
            mainImg.removeAttribute('srcset');
        mainLink.href = btn.dataset.href;
        mainLink.dataset.full = btn.dataset.full;
        mainLink.dataset.index = btn.dataset.index;
        $$('[data-thumb]', gallery).forEach((b) => b.setAttribute('aria-current', String(b === btn)));
    });
})();
function showErrors(form, fields = {}) {
    $$('[data-error-for]', form).forEach((el) => { el.hidden = true; el.textContent = ''; });
    $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
    let first = null;
    for (const [name, message] of Object.entries(fields)) {
        const key = name.split('.')[0];
        const err = $(`[data-error-for="${key}"]`, form);
        const control = form.elements.namedItem(key);
        if (err) {
            err.textContent = message;
            err.hidden = false;
        }
        if (control instanceof HTMLElement) {
            control.setAttribute('aria-invalid', 'true');
            first ?? (first = control);
        }
    }
    first?.focus();
}
function setStatus(form, kind, text) {
    const box = $('[data-form-status]', form);
    if (!box)
        return;
    box.hidden = !text;
    box.dataset.kind = kind;
    box.textContent = text;
}
const formJson = (form) => {
    const data = {};
    for (const [k, v] of new FormData(form))
        if (typeof v === 'string')
            data[k] = v;
    return data;
};
$$('[data-inquiry-form]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (STATIC) {
            staticInquiry(form);
            return;
        }
        const btn = $('[data-submit]', form);
        btn?.setAttribute('disabled', '');
        setStatus(form, '', '');
        showErrors(form);
        try {
            const res = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(formJson(form)) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showErrors(form, data.fields);
                setStatus(form, 'error', data.error || 'Sorry, your message could not be sent. Please call or WhatsApp us.');
                return;
            }
            const done = document.createElement('div');
            done.className = 'confirmation';
            done.tabIndex = -1;
            done.innerHTML = '<p class="eyebrow">Message received</p><p>Thank you. Your reference is</p><p class="ref"></p><p>We will reply as soon as we can using the details you gave.</p>';
            $('.ref', done).textContent = data.reference;
            form.replaceWith(done);
            done.focus();
        }
        catch {
            setStatus(form, 'error', 'You appear to be offline. Please check your connection, or call or WhatsApp us.');
        }
        finally {
            btn?.removeAttribute('disabled');
        }
    });
});
(async () => {
    const app = $('[data-basket-app]');
    if (!app)
        return;
    app.hidden = false;
    const list = $('[data-basket-list]', app);
    const empty = $('[data-basket-empty]', app);
    const panel = $('[data-quote-panel]', app);
    const form = $('[data-quote-form]', app);
    const done = $('[data-quote-done]', app);
    const waNumber = (() => { try {
        return JSON.parse($('#wa-number')?.textContent || '{}').wa;
    }
    catch {
        return '';
    } })();
    const units = { piece: ['piece', 'pieces'], box: ['box', 'boxes'], sqm: ['m²', 'm²'], bag: ['bag', 'bags'], set: ['set', 'sets'] };
    const unitWord = (u, n) => (u && units[u] ? units[u][n === 1 ? 0 : 1] : n === 1 ? 'unit' : 'units');
    let products = new Map();
    async function fetchProducts() {
        const ids = basket.read().map((l) => l.id);
        if (!ids.length) {
            products = new Map();
            return;
        }
        try {
            const items = STATIC
                ? (await loadStaticData()).products.filter((p) => ids.includes(p.id))
                : (await (await fetch(`/api/products?ids=${ids.join(',')}&per_page=100`, { headers: { Accept: 'application/json' } })).json()).items;
            products = new Map(items.map((p) => [p.id, p]));
            basket.write(basket.read().filter((l) => products.has(l.id)));
        }
        catch { }
    }
    function render() {
        const lines = basket.read();
        list.innerHTML = '';
        empty.hidden = lines.length > 0;
        panel.hidden = lines.length === 0;
        for (const line of lines) {
            const p = products.get(line.id);
            const li = document.createElement('li');
            li.className = 'basket-item';
            li.innerHTML = `<img alt="" width="96" height="96" loading="lazy">
        <div><h3><a></a></h3><p class="meta"></p>
          <div class="controls">
            <div class="qty" role="group"><button type="button" data-step="-1" aria-label="Decrease quantity">−</button><input type="number" min="1" max="1000000" step="1" inputmode="numeric"><button type="button" data-step="1" aria-label="Increase quantity">+</button></div>
            <span class="small muted unit"></span>
            <button type="button" class="remove-btn">Remove</button>
          </div></div>
        <div class="price-col small"></div>`;
            const img = $('img', li);
            if (p?.image)
                img.src = toUrl(p.image.src);
            else
                img.style.visibility = 'hidden';
            const a = $('h3 a', li);
            a.textContent = p ? p.name : `Product #${line.id}`;
            a.href = toUrl(p ? p.path : '/collections');
            $('.meta', li).textContent = p ? `${p.availability.label}${p.is_demo ? ' · Demo item, not real stock' : ''}` : 'Checking product details…';
            $('.price-col', li).textContent = p ? p.price.label : '';
            const input = $('input', li);
            input.value = String(line.qty);
            input.setAttribute('aria-label', `Quantity for ${a.textContent}`);
            $('.unit', li).textContent = unitWord(p?.selling_unit ?? null, line.qty);
            input.addEventListener('change', () => {
                const qty = Math.max(1, Math.min(1000000, Math.round(Number(input.value) || 1)));
                input.value = String(qty);
                basket.write(basket.read().map((l) => (l.id === line.id ? { ...l, qty } : l)));
                $('.unit', li).textContent = unitWord(p?.selling_unit ?? null, qty);
            });
            $('.remove-btn', li).addEventListener('click', () => {
                basket.write(basket.read().filter((l) => l.id !== line.id));
                render();
                (list.querySelector('input') ?? $('a', empty))?.focus();
            });
            $('.remove-btn', li).setAttribute('aria-label', `Remove ${a.textContent} from quote`);
            list.append(li);
        }
    }
    await fetchProducts();
    render();
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('[data-submit]', form);
        const lines = basket.read();
        setStatus(form, '', '');
        showErrors(form);
        if (!lines.length) {
            setStatus(form, 'error', 'Your quote basket is empty.');
            return;
        }
        if (STATIC) {
            const items = lines.map((l) => {
                const p = products.get(l.id);
                return `- ${p ? p.name : `Product #${l.id}`}: ${l.qty} ${unitWord(p?.selling_unit ?? null, l.qty)}${p ? ` (${p.price.label})` : ''}`;
            });
            const text = composeMessage(form, 'Hello K3B VENTURES, I would like a quote for:', items);
            if (!text)
                return;
            $$(':scope > div:not([data-quote-done])', app).forEach((el) => (el.hidden = true));
            done.replaceChildren(...sendPanel(text, 'Quote request', 'Your quote request is ready', true).childNodes);
            done.hidden = false;
            done.focus();
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
            return;
        }
        btn.disabled = true;
        try {
            const body = { ...formJson(form), items: lines.map((l) => ({ product_id: l.id, quantity: l.qty })) };
            const res = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showErrors(form, data.fields);
                setStatus(form, 'error', data.error || 'Sorry, your request could not be sent. Please try again or WhatsApp us.');
                return;
            }
            const name = String(new FormData(form).get('name') || '');
            const summary = [
                `Hello K3B VENTURES, I have sent quote request ${data.reference}.`,
                ...data.items.map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`),
                name ? `Name: ${name}` : '',
            ].filter(Boolean).join('\n');
            $('[data-ref]', done).textContent = data.reference;
            $('[data-wa-summary]', done).href = `https://wa.me/${waNumber}?text=${encodeURIComponent(summary)}`;
            basket.write([]);
            list.innerHTML = '';
            $$(':scope > div:not([data-quote-done])', app).forEach((el) => (el.hidden = true));
            done.hidden = false;
            done.focus();
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
        catch {
            setStatus(form, 'error', 'You appear to be offline. Your basket is saved on this device; please try again.');
        }
        finally {
            btn.disabled = false;
        }
    });
})();
function staticCollections(form, results) {
    const cards = new Map();
    $$('.product-card', results).forEach((card) => {
        const id = Number($('[data-add-to-quote]', card)?.dataset.id);
        if (id)
            cards.set(id, card);
    });
    const featuredOrder = [...cards.keys()];
    const bar = $('.results-bar', results);
    const h1 = $('.page-hero h1');
    const lead = $('.page-hero .lead');
    const original = { h1: h1?.innerHTML ?? '', lead: lead?.textContent ?? '', title: document.title };
    const ghs = (pesewas) => `GHS ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const availabilityLabels = {};
    $$('input[name="availability"]', form).forEach((i) => { if (i.value)
        availabilityLabels[i.value] = i.parentElement?.textContent?.trim() ?? i.value; });
    $$('select[name="availability"] option', form).forEach((o) => { if (o.value)
        availabilityLabels[o.value] = o.textContent ?? o.value; });
    function syncForm(params) {
        for (const el of $$('input[type="radio"]', form))
            el.checked = (params.get(el.name) ?? '') === el.value;
        for (const el of $$('select', form))
            el.value = params.get(el.name) ?? '';
        const sort = $('#sort');
        if (sort)
            sort.value = params.get('sort') || 'featured';
        for (const el of $$('input[type="search"], input[type="number"]', form))
            el.value = params.get(el.name) ?? '';
    }
    const formParams = () => {
        const params = new URLSearchParams();
        for (const [k, v] of new FormData(form))
            if (typeof v === 'string' && v.trim() !== '')
                params.set(k, v.trim());
        const sort = $('#sort');
        if (sort && sort.value !== 'featured')
            params.set('sort', sort.value);
        else
            params.delete('sort');
        return params;
    };
    async function apply(params, push) {
        const { products, categories } = await loadStaticData();
        const byId = new Map(products.map((p) => [p.id, p]));
        const q = (params.get('q') || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
        const min = params.get('min') ? Number(params.get('min')) * 100 : null;
        const max = params.get('max') ? Number(params.get('max')) * 100 : null;
        let ids = featuredOrder.filter((id) => {
            const p = byId.get(id);
            if (!p)
                return false;
            const hay = [p.name, p.summary, p.description, p.color, p.size, p.finish, p.category?.name].filter(Boolean).join(' ').toLowerCase();
            if (q.some((t) => !hay.includes(t)))
                return false;
            if (params.get('category') && p.category?.slug !== params.get('category'))
                return false;
            for (const key of ['size', 'finish', 'color'])
                if (params.get(key) && p[key] !== params.get(key))
                    return false;
            if (params.get('availability') && p.availability.code !== params.get('availability'))
                return false;
            const price = p.price.amount_pesewas;
            if (params.get('price') === 'listed' && price === null)
                return false;
            if (params.get('price') === 'request' && price !== null)
                return false;
            if (min !== null && (price === null || price < min))
                return false;
            if (max !== null && (price === null || price > max))
                return false;
            return true;
        });
        const sort = params.get('sort') || 'featured';
        const name = (id) => byId.get(id).name;
        const price = (id) => byId.get(id).price.amount_pesewas;
        if (sort === 'name')
            ids.sort((a, b) => name(a).localeCompare(name(b)));
        if (sort === 'newest')
            ids.sort((a, b) => b - a);
        if (sort === 'price_asc' || sort === 'price_desc') {
            const dir = sort === 'price_asc' ? 1 : -1;
            ids = [...ids].sort((a, b) => (price(a) === null ? 1 : 0) - (price(b) === null ? 1 : 0) || ((price(a) ?? 0) - (price(b) ?? 0)) * dir || name(a).localeCompare(name(b)));
        }
        const cat = categories.find((c) => c.slug === params.get('category'));
        if (h1) {
            if (cat)
                h1.textContent = cat.name;
            else
                h1.innerHTML = original.h1;
        }
        if (lead)
            lead.textContent = cat?.description || original.lead;
        document.title = cat ? `${cat.name} | Tiles | K3B VENTURES` : original.title;
        const active = [];
        if (params.get('q'))
            active.push(['q', `“${params.get('q')}”`]);
        if (cat)
            active.push(['category', cat.name]);
        if (params.get('size'))
            active.push(['size', `Size ${params.get('size')}`]);
        if (params.get('finish'))
            active.push(['finish', params.get('finish')]);
        if (params.get('color'))
            active.push(['color', params.get('color')]);
        if (params.get('availability'))
            active.push(['availability', availabilityLabels[params.get('availability')] ?? params.get('availability')]);
        if (params.get('price'))
            active.push(['price', params.get('price') === 'listed' ? 'Price shown' : 'Request Price']);
        if (min !== null)
            active.push(['min', `From ${ghs(min)}`]);
        if (max !== null)
            active.push(['max', `Up to ${ghs(max)}`]);
        const count = $('#results-count', bar);
        if (count)
            count.textContent = `${ids.length === 1 ? '1 product' : `${ids.length} products`}${active.length ? ' match your filters' : ''}`;
        while (bar.nextSibling)
            bar.nextSibling.remove();
        if (active.length) {
            const wrap = document.createElement('div');
            wrap.className = 'active-filters';
            wrap.setAttribute('aria-label', 'Active filters');
            for (const [key, label] of active) {
                const next = new URLSearchParams(params);
                next.delete(key);
                const a = document.createElement('a');
                a.href = `?${next}`;
                a.dataset.filterLink = '';
                a.innerHTML = '<span></span> <span class="visually-hidden">Remove filter</span>';
                a.firstElementChild.textContent = label;
                wrap.append(a);
            }
            const clear = document.createElement('a');
            clear.href = '?';
            clear.dataset.filterLink = '';
            clear.textContent = 'Clear all';
            wrap.append(clear);
            results.append(wrap);
        }
        if (ids.length) {
            const grid = document.createElement('div');
            grid.className = 'product-grid';
            ids.forEach((id) => { const card = cards.get(id); card.classList.add('is-visible'); grid.append(card); });
            results.append(grid);
        }
        else {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = '<h2>No products match yet</h2><p class="muted">Try removing a filter, or tell us what you are looking for and we will check for you.</p><div class="btn-row" style="justify-content:center"><a class="btn btn--ghost" href="?" data-filter-link>Clear filters</a><a class="btn btn--wa" target="_blank" rel="noopener">Ask on WhatsApp</a></div>';
            $('.btn--wa', empty).href = waLink(`Hello K3B VENTURES, I am looking for ${params.get('q') || 'tiles'}. Can you help?`);
            results.append(empty);
        }
        if (push)
            try {
                history.pushState({ collections: true }, '', `${location.pathname}${params.toString() ? `?${params}` : ''}`);
            }
            catch { }
        syncForm(params);
    }
    form.addEventListener('submit', (e) => { e.preventDefault(); apply(formParams(), true); });
    document.addEventListener('change', (e) => {
        const t = e.target;
        if (t.matches('[data-autosubmit]') && (form.contains(t) || t.getAttribute('form') === 'filters'))
            apply(formParams(), true);
    });
    let timer = 0;
    $('#q', form)?.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => apply(formParams(), true), 300); });
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-filter-link]');
        if (!a || e.metaKey || e.ctrlKey || !(results.contains(a) || form.contains(a)))
            return;
        e.preventDefault();
        apply(new URL(a.href, location.href).searchParams, true);
    });
    window.addEventListener('popstate', () => apply(new URLSearchParams(location.search), false));
    if (location.search)
        apply(new URLSearchParams(location.search), false);
}
const waNumberOnPage = () => ($('a[href^="https://wa.me/"]')?.href.match(/wa\.me\/(\d+)/)?.[1] ?? '');
const waLink = (text) => `https://wa.me/${waNumberOnPage()}?text=${encodeURIComponent(text)}`;
const emailOnPage = () => ($('a[href^="mailto:"]')?.getAttribute('href') ?? '').replace(/^mailto:/, '').split('?')[0];
function composeMessage(form, opening, extraLines = []) {
    setStatus(form, '', '');
    showErrors(form);
    const errors = {};
    const value = (name) => String(new FormData(form).get(name) ?? '').trim();
    const labelFor = (el) => (form.querySelector(`label[for="${el.id}"]`)?.textContent ?? el.getAttribute('name') ?? '').replace(/\*|\(optional\)/g, '').trim();
    for (const el of $$('input[required], textarea[required]', form))
        if (!el.value.trim())
            errors[el.name] = `Please fill in “${labelFor(el)}”.`;
    if (value('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email')))
        errors.email = 'Please enter a valid email address.';
    if (value('phone') && value('phone').replace(/\D/g, '').length < 9)
        errors.phone = 'Please enter a valid phone number.';
    if (form.querySelector('[name="phone"]:not([required])') && form.querySelector('[name="email"]') && !value('phone') && !value('email'))
        errors.phone = 'Please give a phone number or an email address.';
    if (Object.keys(errors).length) {
        showErrors(form, errors);
        setStatus(form, 'error', 'Please check the highlighted fields.');
        return '';
    }
    const lines = [opening, ...extraLines, ''];
    for (const el of $$('input, textarea, select', form)) {
        if (!el.name || ['website', 'form_token', 'type', 'product_id'].includes(el.name) || !el.value.trim())
            continue;
        if (el instanceof HTMLInputElement && el.type === 'radio') {
            if (!el.checked)
                continue;
            const legend = el.closest('fieldset')?.querySelector('legend')?.textContent ?? el.name;
            lines.push(`${legend.trim()} ${el.parentElement?.textContent?.trim()}`);
            continue;
        }
        const shown = el instanceof HTMLSelectElement ? el.selectedOptions[0]?.textContent ?? el.value : el.value.trim();
        lines.push(`${labelFor(el)}: ${shown}`);
    }
    return lines.join('\n');
}
function sendPanel(text, subject, heading, offerClear = false) {
    const wa = waLink(text);
    const mail = `mailto:${emailOnPage()}?subject=${encodeURIComponent(`${subject} from the website`)}&body=${encodeURIComponent(text)}`;
    const done = document.createElement('div');
    done.className = 'confirmation';
    done.tabIndex = -1;
    done.innerHTML = `<p class="eyebrow">Almost done</p><h2 style="font-size:var(--t-h3)"></h2>
    <p>Send it to us on WhatsApp, or by email if you prefer. Nothing reaches us until you press send in WhatsApp or your email app.</p>
    <pre class="message-preview" tabindex="0"></pre>
    <div class="btn-row mt-6"><a class="btn btn--wa" target="_blank" rel="noopener">Send on WhatsApp</a><a class="btn btn--ghost">Send by email</a></div>`;
    $('h2', done).textContent = heading;
    $('pre', done).textContent = text;
    $('.btn--wa', done).href = wa;
    $('.btn--ghost', done).href = mail;
    if (offerClear) {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'btn btn--ghost';
        clear.textContent = 'Clear my basket';
        clear.addEventListener('click', () => { basket.write([]); clear.textContent = 'Basket cleared'; clear.disabled = true; });
        $('.btn-row', done).append(clear);
    }
    window.open(wa, '_blank', 'noopener');
    return done;
}
function staticInquiry(form) {
    const type = String(new FormData(form).get('type') || 'contact');
    const opening = type === 'wholesale' ? 'Hello K3B VENTURES, I have a wholesale enquiry.' : 'Hello K3B VENTURES, I have a question.';
    const text = composeMessage(form, opening);
    if (!text)
        return;
    const done = sendPanel(text, type === 'wholesale' ? 'Wholesale enquiry' : 'Message', 'Your message is ready');
    form.replaceWith(done);
    done.focus();
}
(async () => {
    if (!STATIC)
        return;
    const slug = new URLSearchParams(location.search).get('product');
    const form = $('[data-inquiry-form]');
    if (!slug || !form || !form.querySelector('[name="subject"]'))
        return;
    const p = (await loadStaticData()).products.find((x) => x.slug === slug);
    if (!p)
        return;
    const heading = $('h2', form);
    if (heading) {
        heading.textContent = 'Ask about ';
        const em = document.createElement('em');
        em.textContent = p.name;
        heading.append(em);
    }
    const set = (name, v) => { const el = form.elements.namedItem(name); if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
        el.value = v; };
    set('type', 'product');
    set('subject', `Question about ${p.name}`);
    set('message', `I would like to know the price and availability of ${p.name}.`);
})();
