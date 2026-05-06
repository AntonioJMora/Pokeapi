/* ============================================================
    api.js — Lógica de comunicación con la PokéAPI
    Usado por: index.html, detalle.html

    Endpoint base: https://pokeapi.co/api/v2
    Documentación: https://pokeapi.co/docs/v2
   ============================================================ */

const BASE_URL = 'https://pokeapi.co/api/v2';

/* Cuántos resultados pedir en los listados generales */
const LIMIT = 24;

/* ── Mapa de colores por tipo de Pokémon ── */
const TYPE_COLORS = {
    fire:     '#f08030',
    water:    '#6890f0',
    grass:    '#78c850',
    electric: '#f8d030',
    ice:      '#98d8d8',
    fighting: '#c03028',
    poison:   '#a040a0',
    ground:   '#e0c068',
    flying:   '#a890f0',
    psychic:  '#f85888',
    bug:      '#a8b820',
    rock:     '#b8a038',
    ghost:    '#705898',
    dragon:   '#7038f8',
    dark:     '#705848',
    steel:    '#b8b8d0',
    fairy:    '#ee99ac',
    normal:   '#a8a878'
};

/* ============================================================
    CACHÉ en localStorage
   ============================================================ */

/**
 * Intenta leer un valor del caché.
 * @param {string} key - Clave única de caché.
 * @returns {any|null} - El valor parseado o null si no existe/falla.
 */
function cacheGet(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Intenta guardar un valor en el caché.
 * El try/catch evita errores por cuota de almacenamiento.
 * @param {string} key
 * @param {any} value
 */
function cacheSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* Sin espacio en localStorage — ignoramos silenciosamente */
    }
}

/* ============================================================
    BÚSQUEDA PRINCIPAL
   ============================================================ */

/**
 * Busca en la PokéAPI según categoría y término.
 *
 * Flujo:
 *  1. Revisa el caché local → devuelve si existe (evita peticiones)
 *  2. Si hay término → busca el recurso directamente por nombre/id
 *  3. Si no hay término → pide el listado general con ?limit=LIMIT
 *     • Para Pokémon: hace una segunda ronda de fetches para obtener
 *       sprites y tipos (la lista general solo devuelve nombre y URL)
 *  4. Guarda en caché y devuelve los resultados
 *
 * @param {string} type  - Categoría de la PokéAPI (pokemon, type, ability…)
 * @param {string} term  - Texto del buscador (puede estar vacío)
 * @returns {Promise<Array>} - Array de objetos con searchType añadido
 * @throws {Error} - Si la petición falla (p.ej. 404 al buscar por nombre)
 */
async function searchPokeAPI(type, term) {
    const normalized = term.toLowerCase().trim();
    const cacheKey   = `poke_${type}_${normalized}`;

    /* 1 — Caché hit */
    const cached = cacheGet(cacheKey);
    if (cached) {
        console.log(`[Caché] ${type} — "${term}"`);
        return cached;
    }

    let results = [];

    if (term.trim() !== '') {
        /* ── 2 — Búsqueda parcial ──
         * Obtenemos todos los nombres del tipo y filtramos localmente.
         * Así el usuario ve resultados mientras escribe, sin necesitar
         * el nombre exacto completo.
         */
        console.log(`[Búsqueda parcial] ${type} — "${term}"`);

        const allNames = await getAllNames(type);
        const matches  = allNames.filter(name => name.includes(normalized));

        if (!matches.length) throw new Error(`No se encontró "${term}"`);

        if (type === 'pokemon') {
            /* Para pokémon necesitamos el detalle (imagen, tipos…) de cada uno */
            const settled = await Promise.allSettled(
                matches.slice(0, LIMIT).map(name =>
                    fetch(`${BASE_URL}/pokemon/${name}`).then(r => r.json())
                )
            );
            results = settled
                .filter(d => d.status === 'fulfilled')
                .map(d => { d.value.searchType = type; return d.value; });
        } else {
            /* Para otras categorías con el nombre es suficiente para mostrar la tarjeta */
            results = matches.slice(0, LIMIT).map(name => ({ name, searchType: type }));
        }

    } else {
        /* ── 3 — Sin texto: mostramos los primeros LIMIT resultados ── */
        console.log(`[Fetch] listado general de ${type}`);

        const res = await fetch(`${BASE_URL}/${type}?limit=${LIMIT}`);
        if (!res.ok) throw new Error(`Error al cargar ${type}`);

        const json = await res.json();

        if (type === 'pokemon') {
            /* La lista solo trae { name, url }, pedimos el detalle en paralelo */
            const settled = await Promise.allSettled(
                json.results.map(p => fetch(p.url).then(r => r.json()))
            );
            results = settled
                .filter(d => d.status === 'fulfilled')
                .map(d => { d.value.searchType = type; return d.value; });
        } else {
            results = (json.results || []).map(item => ({ ...item, searchType: type }));
        }
    }

    /* 4 — Guardar en caché */
    cacheSet(cacheKey, results);

    return results;
}

/* ============================================================
    DETALLE DE UN POKÉMON
   ============================================================ */

/**
 * Obtiene los datos completos de un Pokémon por nombre o id.
 * También intenta obtener datos de su especie (descripción, generación…).
 *
 * @param {string|number} nameOrId
 * @returns {Promise<{pokemon: Object, species: Object|null}>}
 * @throws {Error} si el Pokémon no existe
 */
async function fetchPokemonDetail(nameOrId) {
    const cacheKey = `poke_detail_${nameOrId}`;

    const cached = cacheGet(cacheKey);
    if (cached) {
        console.log(`[Caché] detalle de ${nameOrId}`);
        return cached;
    }

    /* Petición principal */
    const res = await fetch(`${BASE_URL}/pokemon/${nameOrId}`);
    if (!res.ok) throw new Error(`Pokémon no encontrado: ${nameOrId}`);
    const pokemon = await res.json();

    /* Petición a species (puede no existir para algunos forms) */
    let species = null;
    try {
        const speciesRes = await fetch(pokemon.species.url);
        if (speciesRes.ok) species = await speciesRes.json();
    } catch {
        /* No bloqueamos si species falla */
    }

    const result = { pokemon, species };
    cacheSet(cacheKey, result);
    return result;
}

/* ============================================================
    HELPERS DE UI (usados por index.html y detalle.html)
   ============================================================ */

/**
 * Genera el HTML de un badge de tipo con su color correspondiente.
 * @param {string} typeName
 * @returns {string} HTML string
 */
function typeBadge(typeName) {
    const bg = TYPE_COLORS[typeName] || '#666';
    return `<span class="type-badge" style="background:${bg}">${typeName}</span>`;
}

/**
 * Devuelve un color para la barra de estadística según el valor.
 * @param {number} val
 * @returns {string} color hex
 */
function statColor(val) {
    if (val >= 100) return '#78c850'; /* verde — alto */
    if (val >= 70)  return '#f8d030'; /* amarillo — medio */
    if (val >= 45)  return '#f08030'; /* naranja — bajo */
    return '#c03028';                  /* rojo — muy bajo */
}

/**
 * Obtiene el sprite principal de un Pokémon.
 * Prioriza el artwork oficial; si no existe, usa el sprite clásico.
 * @param {Object} sprites - El objeto sprites de la PokéAPI
 * @returns {string} URL del sprite
 */
function getSprite(sprites) {
    return sprites?.other?.['official-artwork']?.front_default
        || sprites?.front_default
        || '';
}

/* ============================================================
    LISTA COMPLETA DE NOMBRES (para búsqueda parcial)
   ============================================================ */

// Caché en memoria: más rápido que leer localStorage en cada tecla
const _namesMemory = {};

/**
 * Devuelve todos los nombres de una categoría.
 * Prioridad: memoria → localStorage → fetch a la API.
 * @param {string} type - Categoría de la PokéAPI
 * @returns {Promise<string[]>} - Array con todos los nombres
 */
async function getAllNames(type) {
    // 1. Memoria de sesión (instantáneo, sin JSON.parse)
    if (_namesMemory[type]?.length) return _namesMemory[type];

    // 2. localStorage — usamos !== null para no confundir [] con "no existe"
    const cacheKey = `poke_allnames_${type}`;
    const fromLS   = cacheGet(cacheKey);
    if (fromLS !== null && fromLS.length > 0) {
        _namesMemory[type] = fromLS;
        return fromLS;
    }

    // 3. Fetch a la API con todos los nombres del tipo
    console.log(`[Fetch] todos los nombres de ${type}`);
    const res = await fetch(`${BASE_URL}/${type}?limit=10000`);
    if (!res.ok) throw new Error(`Error al cargar los nombres de ${type}`);

    const json  = await res.json();
    const names = (json.results || []).map(item => item.name);

    if (!names.length) throw new Error(`La API no devolvió nombres para ${type}`);

    // Guardamos en memoria y en localStorage para la próxima visita
    _namesMemory[type] = names;
    cacheSet(cacheKey, names);
    return names;
}
