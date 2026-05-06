document.addEventListener("DOMContentLoaded", () => {
    // Recogemos los elementos del HTML que vamos a necesitar
    const searchInput   = document.getElementById("searchInput");
    const entityTypes   = document.getElementById("entityTypes");
    const searchResults = document.getElementById("searchResults");
    const searchState   = document.getElementById("searchState");

    // Si no existe el buscador, estamos en detalle.html → salimos
    if (!searchInput) return;

    // Variable para guardar el temporizador del debounce
    let timeoutId;

    // Cada vez que el usuario escribe, esperamos 300ms antes de buscar
    // (evita mandar una petición por cada letra)
    searchInput.addEventListener("input", (e) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            handleSearch(e.target.value.trim(), entityTypes.value);
        }, 300);
    });

    // Si el usuario cambia la categoría del select, relanzamos la búsqueda
    entityTypes.addEventListener("change", (e) => {
        handleSearch(searchInput.value.trim(), e.target.value);
    });

    // Mostramos resultados iniciales al cargar la página (sin texto de búsqueda)
    handleSearch("", entityTypes.value);

    // ── Función principal: llama a la API y pinta las tarjetas ──
    async function handleSearch(term, type) {
        // Mostramos el mensaje de carga y limpiamos resultados anteriores
        searchState.textContent = "Cargando resultados...";
        searchState.classList.remove("hidden");
        searchResults.innerHTML = "";

        try {
            // searchPokeAPI viene de api.js; devuelve un array con los resultados
            const results = await searchPokeAPI(type, term);

            // Ocultamos el estado de carga cuando ya tenemos datos
            searchState.classList.add("hidden");

            // Si la API no devuelve nada, avisamos al usuario y salimos
            if (!results.length) {
                searchState.textContent = "No se encontraron resultados.";
                searchState.classList.remove("hidden");
                return;
            }

            // Convertimos cada resultado en una tarjeta HTML y la insertamos
            searchResults.innerHTML = results.map(item => renderCard(item, type)).join("");

        } catch (err) {
            // Si la petición falla (404, red caída, etc.) mostramos el error
            searchState.textContent = `❌ ${err.message}`;
        }
    }

    // ── Genera el HTML de una tarjeta según la categoría ──
    function renderCard(item, type) {
        const name = item.name || "—";

        // Enlace a detalle.html con el nombre y tipo del recurso como parámetros
        const url = `detalle.html?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;

        // Tarjeta especial para pokémon: lleva imagen, número y tipos
        if (type === "pokemon") {
            // getSprite y typeBadge son helpers definidos en api.js
            const sprite    = getSprite(item.sprites);
            const typesHTML = (item.types || []).map(t => typeBadge(t.type.name)).join("");

            return `
                <article class="poke-card">
                    <a href="${url}">
                        <img src="${sprite}" alt="${name}" loading="lazy">
                        <span class="poke-id">#${String(item.id).padStart(3, "0")}</span>
                        <h3>${name}</h3>
                        <p class="poke-types">${typesHTML}</p>
                    </a>
                </article>`;
        }

        // Para tipos, habilidades, movimientos, etc. solo mostramos el nombre
        return `
            <article class="generic-card">
                <a href="${url}">
                    <h3>${name}</h3>
                </a>
            </article>`;
    }
});