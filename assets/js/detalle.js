/* ── Leemos los parámetros que vienen en la URL (nombre y tipo del recurso) ── */
const params = new URLSearchParams(window.location.search);
const NAME   = params.get('name') || '';
const TYPE   = params.get('type') || '';

// Referencia al contenedor donde inyectaremos todo el HTML del detalle
const container = document.getElementById('detailContainer');

/* ══════════════════════════════════════════════════
    HELPERS DE TEXTO
   ══════════════════════════════════════════════════ */

// Devuelve la descripción en español de la pokédex; si no hay, usa inglés
function getDescription(species) {
    if (!species?.flavor_text_entries?.length) return 'Sin descripción disponible.';

    const es = species.flavor_text_entries.find(e => e.language.name === 'es');
    if (es) return es.flavor_text.replace(/\f/g, ' ');

    const en = species.flavor_text_entries.find(e => e.language.name === 'en');
    return en ? en.flavor_text.replace(/\f/g, ' ') : 'Sin descripción disponible.';
}

/* ══════════════════════════════════════════════════
    RENDER POKÉMON
   ══════════════════════════════════════════════════ */

// Construye y muestra todo el HTML del detalle de un pokémon
function renderPokemon(pokemon, species) {
    // Actualizamos el título de la pestaña del navegador
    document.title = `${pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)} — PokeApi`;

    // ── Sprites ──
    // Artwork oficial como imagen principal; si no existe, usamos el sprite clásico
    const mainSprite  = getSprite(pokemon.sprites);
    const shinySprite = pokemon.sprites?.other?.['official-artwork']?.front_shiny
                        || pokemon.sprites?.front_shiny || '';
    const backSprite  = pokemon.sprites?.back_default || '';

    // ── Tipos ──
    // typeBadge viene de api.js y devuelve un <span> con el color del tipo
    const typesHTML = (pokemon.types || [])
        .map(t => typeBadge(t.type.name)).join('');

    // ── Descripción y generación ──
    const description = getDescription(species);
    const generation  = species?.generation?.name
        ?.replace('generation-', 'Gen ').toUpperCase() || '—';

    // ── Estadísticas base con barras de color ──
    // Cada stat se convierte en una fila con nombre, número y barra de progreso
    const statsHTML = (pokemon.stats || []).map(s => {
        const val  = s.base_stat;
        const pct  = Math.min((val / 255) * 100, 100).toFixed(1); // porcentaje sobre 255
        const col  = statColor(val); // color según si el valor es alto/medio/bajo

        // Hacemos los nombres más legibles para el usuario
        const name = s.stat.name
            .replace('special-attack',  'sp. atk')
            .replace('special-defense', 'sp. def')
            .replace('hp',              'HP');

        return `
            <div class="stat-row">
                <span class="stat-name">${name}</span>
                <span class="stat-val">${val}</span>
                <div class="stat-bar-bg">
                    <div class="stat-bar" style="width:${pct}%; background:${col}"></div>
                </div>
            </div>`;
    }).join('');

    // ── Habilidades ──
    // Marcamos las habilidades ocultas con un texto adicional
    const abilitiesHTML = (pokemon.abilities || [])
        .map(a => {
            const hidden = a.is_hidden ? ' <small style="color:var(--muted)">(oculta)</small>' : '';
            return `<span class="move-badge">${a.ability.name}${hidden}</span>`;
        }).join('');

    // ── Movimientos ──
    // Solo mostramos los primeros 20 para no saturar la pantalla
    const movesHTML = (pokemon.moves || [])
        .slice(0, 20)
        .map(m => `<span class="move-badge">${m.move.name}</span>`)
        .join('');

    // ── Inyectamos todo el HTML en el contenedor ──
    container.innerHTML = `
        <div class="detail-layout">

            <!-- Columna izquierda: imagen principal y sprites alternativos -->
            <section class="detail-panel-left">
                <span class="detail-id">#${String(pokemon.id).padStart(3, '0')}</span>
                <img id="mainSprite" src="${mainSprite}" alt="${pokemon.name}">
                <h2 class="detail-name">${pokemon.name}</h2>
                <p class="poke-types">${typesHTML}</p>

                <!-- Miniaturas clicables para cambiar el sprite principal -->
                <div class="sprite-row">
                    ${shinySprite ? `<img class="sprite-mini" src="${shinySprite}" alt="Shiny" title="Shiny" onclick="swapSprite('${shinySprite}')">` : ''}
                    ${backSprite  ? `<img class="sprite-mini" src="${backSprite}"  alt="Espalda" title="Sprite clásico (espalda)" onclick="swapSprite('${backSprite}')">` : ''}
                    ${mainSprite  ? `<img class="sprite-mini" src="${mainSprite}"  alt="Normal"  title="Artwork oficial" onclick="swapSprite('${mainSprite}')">` : ''}
                </div>
            </section>

            <!-- Columna derecha: datos, stats y movimientos -->
            <div class="detail-panel-right">

                <!-- Descripción de la pokédex -->
                <section class="detail-section">
                    <h3>Descripción</h3>
                    <p style="font-size:.95rem; line-height:1.6">${description}</p>
                </section>

                <!-- Datos básicos: altura, peso, generación y habilidades -->
                <section class="detail-section">
                    <h3>Datos básicos</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Altura</span>
                            <span class="value">${(pokemon.height / 10).toFixed(1)} m</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Peso</span>
                            <span class="value">${(pokemon.weight / 10).toFixed(1)} kg</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Exp. base</span>
                            <span class="value">${pokemon.base_experience ?? '—'}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Generación</span>
                            <span class="value">${generation}</span>
                        </div>
                        <div class="info-item" style="grid-column: 1 / -1">
                            <span class="label">Habilidades</span>
                            <div class="moves-grid">${abilitiesHTML}</div>
                        </div>
                    </div>
                </section>

                <!-- Estadísticas con barras de progreso -->
                <section class="detail-section">
                    <h3>Estadísticas base</h3>
                    <div class="stats-list">${statsHTML}</div>
                </section>

                <!-- Primeros 20 movimientos que aprende el pokémon -->
                <section class="detail-section">
                    <h3>Movimientos (primeros 20)</h3>
                    <div class="moves-grid">${movesHTML}</div>
                </section>

            </div>
        </div>`;
}

/* ══════════════════════════════════════════════════
    RENDER GENÉRICO (tipos, habilidades, objetos…)
   ══════════════════════════════════════════════════ */

// Para categorías que no son pokémon mostramos los datos que tenga el recurso
function renderGeneric(data) {
    document.title = `${data.name.charAt(0).toUpperCase() + data.name.slice(1)} — PokeApi`;

    // Buscamos descripción en español primero, luego inglés
    const effectEntry =
        (data.effect_entries || []).find(e => e.language.name === 'es') ||
        (data.effect_entries || []).find(e => e.language.name === 'en');

    const flavorEntry =
        (data.flavor_text_entries || []).find(e => e.language?.name === 'es') ||
        (data.flavor_text_entries || []).find(e => e.language?.name === 'en');

    const description = effectEntry?.short_effect
        || effectEntry?.effect
        || flavorEntry?.flavor_text
        || 'Sin descripción disponible.';

    // Algunos recursos (tipos, habilidades) tienen lista de pokémon relacionados
    const pokemonList = data.pokemon || [];
    const pokemonHTML = pokemonList.length
        ? `<section class="detail-section">
                <h3>Pokémon relacionados</h3>
                <div class="moves-grid">
                    ${pokemonList.slice(0, 30).map(p => {
                        const pname = p.pokemon?.name || p.name || '—';
                        return `<a href="detalle.html?name=${pname}&type=pokemon" class="move-badge">${pname}</a>`;
                    }).join('')}
                </div>
            </section>`
        : '';

    container.innerHTML = `
        <article class="card">
            <h2>${data.name}</h2>

            <!-- Descripción del recurso -->
            <section class="detail-section">
                <h3>Descripción</h3>
                <p style="font-size:.95rem; line-height:1.6">${description}</p>
            </section>

            <!-- Información extra que pueda tener el recurso -->
            <section class="detail-section">
                <h3>Información</h3>
                <div class="info-grid">
                    ${data.id             ? `<div class="info-item"><span class="label">ID</span><span class="value">${data.id}</span></div>` : ''}
                    ${data.generation?.name ? `<div class="info-item"><span class="label">Generación</span><span class="value">${data.generation.name}</span></div>` : ''}
                    ${data.move_category?.name ? `<div class="info-item"><span class="label">Categoría</span><span class="value">${data.move_category.name}</span></div>` : ''}
                    ${data.type?.name     ? `<div class="info-item"><span class="label">Tipo</span><span class="value">${typeBadge(data.type.name)}</span></div>` : ''}
                    ${data.cost != null   ? `<div class="info-item"><span class="label">Coste</span><span class="value">${data.cost} ₽</span></div>` : ''}
                </div>
            </section>

            ${pokemonHTML}
        </article>`;
}

/* ══════════════════════════════════════════════════
    SWAP SPRITE
   ══════════════════════════════════════════════════ */

// Cambia la imagen principal al hacer clic en una miniatura
// Necesita ser global (window) porque se llama desde un onclick inline del HTML
window.swapSprite = function(src) {
    const img = document.getElementById('mainSprite');
    if (img) img.src = src;
};

/* ══════════════════════════════════════════════════
    INICIALIZACIÓN
   ══════════════════════════════════════════════════ */

(async function init() {
    // Si no hay parámetros en la URL no podemos mostrar nada → volvemos al buscador
    if (!NAME || !TYPE) {
        window.location.href = 'index.html';
        return;
    }

    try {
        if (TYPE === 'pokemon') {
            // fetchPokemonDetail viene de api.js y devuelve los datos del pokémon y su especie
            const { pokemon, species } = await fetchPokemonDetail(NAME);
            renderPokemon(pokemon, species);

        } else {
            // Para otras categorías hacemos un fetch directo a la API
            // Primero miramos si ya lo tenemos guardado en localStorage (caché)
            const cacheKey = `poke_${TYPE}_detail_${NAME}`;
            let data = null;

            try {
                const raw = localStorage.getItem(cacheKey);
                if (raw) data = JSON.parse(raw);
            } catch {}

            // Si no estaba en caché, hacemos la petición a la API
            if (!data) {
                const res = await fetch(`https://pokeapi.co/api/v2/${TYPE}/${encodeURIComponent(NAME)}`);
                if (!res.ok) throw new Error(`No encontrado: ${NAME}`);
                data = await res.json();

                // Guardamos en caché para no repetir la petición
                try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
            }

            renderGeneric(data);
        }

    } catch (err) {
        // Si algo falla mostramos un mensaje de error con enlace para volver
        container.innerHTML = `
            <p class="detail-error">
                No se pudo cargar "${NAME}".<br>
                <a href="index.html" style="color:var(--amarillo)">← Volver al buscador</a>
            </p>`;
        console.error('[detalle.js]', err);
    }
})();