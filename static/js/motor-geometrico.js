// motor-geometrico.js

const MotorGeometrico = {
    config: {
        radioEstacion: 80, // Distancia de la estación central a la primera ficha
        largoFicha: 70, // Largo de una ficha regular
        anchoFicha: 35, // Ancho de ficha (mulas o lado corto)
        separacion: 4   // Espacio en px entre fichas
    },
    
    panZoom: { x: 0, y: 0, scale: 1, isDragging: false, startX: 0, startY: 0 },
    iniciado: false,

    iniciado: false,

    dibujarZonasGuia: function() {
        const container = document.getElementById('vias-contenedor');
        if (!container) return;

        let svg = document.getElementById('vias-fondo-guias');
        if (!svg) {
            svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.id = 'vias-fondo-guias';
            svg.style.position = 'absolute';
            
            // Creamos un lienzo circular centrado en (0,0)
            svg.setAttribute('viewBox', '-1000 -1000 2000 2000');
            svg.style.top = '-1000px';
            svg.style.left = '-1000px';
            svg.style.width = '2000px';
            svg.style.height = '2000px';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '0';
            
            container.insertBefore(svg, container.firstChild);
        }

        // Definimos los ángulos de las fronteras para armar los conos del pastel
        // Nota como cada cono nace en 0,0 y se abre hacia el infinito (1500px)
        svg.innerHTML = `
            <polygon points="0,0 1500,-866 1500,866" fill="rgba(233, 30, 99, 0.04)" transform="rotate(0)" />
            <polygon points="0,0 1500,866 0,1500" fill="rgba(156, 39, 176, 0.04)" transform="rotate(0)" />
            <polygon points="0,0 0,1500 -1500,866" fill="rgba(33, 150, 243, 0.04)" transform="rotate(0)" />
            <polygon points="0,0 -1500,866 -1500,-866" fill="rgba(76, 175, 80, 0.04)" transform="rotate(0)" />
            <polygon points="0,0 -1500,-866 0,-1500" fill="rgba(255, 152, 0, 0.04)" transform="rotate(0)" />
            <polygon points="0,0 0,-1500 1500,-866" fill="rgba(255, 235, 59, 0.04)" transform="rotate(0)" />

            <line x1="0" y1="0" x2="1500" y2="0" stroke="rgba(255,255,255,0.15)" stroke-width="2" transform="rotate(30)" />
            <line x1="0" y1="0" x2="1500" y2="0" stroke="rgba(255,255,255,0.15)" stroke-width="2" transform="rotate(90)" />
            <line x1="0" y1="0" x2="1500" y2="0" stroke="rgba(255,255,255,0.15)" stroke-width="2" transform="rotate(150)" />
            <line x1="0" y1="0" x2="1500" y2="0" stroke="rgba(255,255,255,0.15)" stroke-width="2" transform="rotate(210)" />
            <line x1="0" y1="0" x2="1500" y2="0" stroke="rgba(255,255,255,0.15)" stroke-width="2" transform="rotate(270)" />
            <line x1="0" y1="0" x2="1500" y2="0" stroke="rgba(255,255,255,0.15)" stroke-width="2" transform="rotate(330)" />
        `;
    },

    inicializar: function() {
        if (this.iniciado) return;
        const mesa = document.getElementById('mesa-verde');
        if (!mesa) return;

        // Arrancar arrastre
        mesa.addEventListener('mousedown', (e) => {
            // Ignorar clics en botones o nodos interactivos
            if (e.target.closest('button') || e.target.closest('.nodo-ficha')) return;
            
            this.panZoom.isDragging = true;
            this.panZoom.startX = e.clientX - this.panZoom.x;
            this.panZoom.startY = e.clientY - this.panZoom.y;
            mesa.style.cursor = 'grabbing';
        });

        // Terminar arrastre
        window.addEventListener('mouseup', () => {
            this.panZoom.isDragging = false;
            mesa.style.cursor = 'default';
        });

        // Arrastrar
        window.addEventListener('mousemove', (e) => {
            if (!this.panZoom.isDragging) return;
            this.panZoom.x = e.clientX - this.panZoom.startX;
            this.panZoom.y = e.clientY - this.panZoom.startY;
            this.aplicarTransform();
        });

        // Acercar / Alejar (Zoom)
        mesa.addEventListener('wheel', (e) => {
            if (e.target.closest('#panel-comunicaciones')) return;
            e.preventDefault();
            const zoomAmount = 0.05;
            if (e.deltaY < 0) {
                this.panZoom.scale = Math.min(this.panZoom.scale + zoomAmount, 2.5);
            } else {
                this.panZoom.scale = Math.max(this.panZoom.scale - zoomAmount, 0.3);
            }
            this.aplicarTransform();
        }, { passive: false });

        this.iniciado = true;
        this.aplicarTransform();

        // Ejecutar nuestra prueba visual de fondo
        this.dibujarZonasGuia();

        // INYECCIÓN DE BOTONES DE ZOOM FIJOS (Para Trackpad de Mac)
        if (!document.getElementById('controles-zoom-fijos')) {
            const contenedorBotones = document.createElement('div');
            contenedorBotones.id = 'controles-zoom-fijos';
            
            // Estilos CSS directos para dejarlos flotando elegantemente abajo a la derecha
            contenedorBotones.style.position = 'fixed';
            contenedorBotones.style.bottom = '120px';
            contenedorBotones.style.right = '20px';
            contenedorBotones.style.display = 'flex';
            contenedorBotones.style.flexDirection = 'column';
            contenedorBotones.style.gap = '10px';
            contenedorBotones.style.zIndex = '1000'; // Asegura que queden arriba de las fichas

            contenedorBotones.innerHTML = `
                <button id='btn-zoom-in' style='width: 45px; height: 45px; font-size: 24px; font-weight: bold; background: #222; color: #fff; border: 2px solid #555; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);'>+</button>
                <button id='btn-zoom-out' style='width: 45px; height: 45px; font-size: 24px; font-weight: bold; background: #222; color: #fff; border: 2px solid #555; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);'>-</button>
            `;

            mesa.appendChild(contenedorBotones);

            // Escuchadores de clics conectados a nuestras funciones suaves
            document.getElementById('btn-zoom-in').addEventListener('click', (e) => {
                e.stopPropagation();
                this.zoomInManual();
            });

            document.getElementById('btn-zoom-out').addEventListener('click', (e) => {
                e.stopPropagation();
                this.zoomOutManual();
            });
        }
    },

    // FUNCIONES DE ZOOM SUAVE PARA BOTONES (Ideales para Trackpad en Mac)
    zoomInManual: function() {
        // Incremento sutil de 0.08 por cada clic
        this.panZoom.scale = Math.min(this.panZoom.scale + 0.08, 2.5);
        this.aplicarTransform();
    },

    zoomOutManual: function() {
        // Decremento sutil de 0.08 por cada clic
        this.panZoom.scale = Math.max(this.panZoom.scale - 0.08, 0.3);
        this.aplicarTransform();
    },

    aplicarTransform: function() {
        const viasContainer = document.getElementById('vias-contenedor');
        if (viasContainer) {
            // El contenedor ya está en 50% 50% vía CSS.
            // Le aplicamos el Pan & Zoom encima.
            viasContainer.style.transform = `translate(-50%, -50%) translate(${this.panZoom.x}px, ${this.panZoom.y}px) scale(${this.panZoom.scale})`;
        }
    },

    dibujar: function(layout) {

        this.dibujarZonasGuia();

        this.inicializar();
        const container = document.getElementById('vias-contenedor');
        if (!container) return;

        // Limpiar elementos que ya no están en el layout (Respetando el fondo)
        const nuevosIds = new Set(layout.map(l => l.id));
        Array.from(container.children).forEach(hijo => {
            // SI ES EL SVG DE LAS GUÍAS, NO LO COQUES NI LO ELIMINES
            if (hijo.id === 'vias-fondo-guias') return; 

            if (!nuevosIds.has(hijo.id)) {
                hijo.remove();
            }
        });

        // Crear o actualizar elementos
        layout.forEach(d => {
            let el = document.getElementById(d.id);
            if (!el) {
                el = document.createElement('div');
                el.id = d.id;
                container.appendChild(el);
            }
            
            // Siempre actualizar clases
            el.className = `nodo-ficha ${d.tipo === 'fantasma' ? 'fantasma-geometrico' : 'ficha mesa'}`;
            
            if (d.tipo === 'estacion') {
                el.className = 'nodo-ficha estacion-central';
            }
            if ((d.tipo === 'ficha' || d.tipo === 'fantasma') && d.esMula) {
                el.classList.add('mula-radial');
            }
            
            // Siempre actualizar contenido
            interfaz.dibujarContenidoNativo(el, d);

            // Aplicar Transformaciones (Posición Absoluta + Rotación)
            if (d.tipo === 'estacion') {
                el.style.transform = `translate(-50%, -50%) translate(${d.x}px, ${d.y}px)`;
            } else {
                // Las fichas se rotan basándose en la geometría exacta
                el.style.transform = `translate(-50%, -50%) translate(${d.x}px, ${d.y}px) rotate(${d.rotacion}deg)`;
            }

            // Actualizar estado interactivo (ej: si brilla o no)
            if (d.tipo === 'fantasma') {
                interfaz.actualizarFantasmaNativo(el, d);
            }
        });
    }
};
