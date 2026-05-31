// interfaz.js


window.fichaSeleccionadaParaTirar = null;

const interfaz = {

    marcarAsientoOcupado: function(asiento_id, nombre, esAnfitrion = false) {
        const btn = document.querySelector(`.ui-asiento-btn[data-asiento="${asiento_id}"]`);
        if (btn) {
            btn.classList.add('ocupado');
            btn.disabled = true;
            if (esAnfitrion) {
                btn.classList.add('es-anfitrion');
            }
            
            // Decidimos el nombre a mostrar (Democrático: solo texto)
            let nombreMostrar = esAnfitrion ? `Anfitrión ${nombre}` : nombre;

            btn.innerHTML = `
                <strong>Asiento ${asiento_id}</strong>
                <span>${nombreMostrar}</span>
            `;
        }
    },

    obtenerPuntas: function(viaFichas, estado) {
        let puntas = new Map();
        const valEstacion = estado.estacion_central ? Number(estado.estacion_central.l1) : 12;
        puntas.set("estacion|unica", { padreId: "estacion", rama: "unica", valor: valEstacion });
        
        viaFichas.forEach(f => {
            const pid = f.padre_id || "estacion";
            const rama = f.rama || "unica";
            puntas.delete(`${pid}|${rama}`);
            
            const v1 = Number(f.v1 !== undefined ? f.v1 : f.l1);
            const v2 = Number(f.v2 !== undefined ? f.v2 : f.l2);
            
            if (v1 === v2) {
                puntas.set(`${f.id}|izq`, { padreId: f.id, rama: "izq", valor: v2 });
                puntas.set(`${f.id}|der`, { padreId: f.id, rama: "der", valor: v2 });
            } else {
                puntas.set(`${f.id}|unica`, { padreId: f.id, rama: "unica", valor: v2 });
            }
        });
        
        return Array.from(puntas.values());
    },

    renderizarVias: function(estado) {
        const permisos = estado.permisos_vias_tren; 
        if (!permisos) return;

        const miID = String(window.mi_asiento);
        const fichaSel = window.fichaSeleccionadaParaTirar;
        const coloresVias = { 1: '#e17055', 2: '#0984e3', 3: '#00b894', 4: '#f1c40f', 5: '#6c5ce7', 6: '#d63031' };
        
        const layout = [];
        
        // Estación
        layout.push({
            id: 'estacion', tipo: 'estacion',
            x: 0, y: 0, rotacion: 0,
            ficha: estado.estacion_central
        });

        Object.keys(estado.vias).forEach(idAsiento => {
            const fichas = estado.vias[idAsiento] || [];
            const permiso = permisos[idAsiento];
            const puedoTirarAqui = permiso ? permiso.permiso : false;
            const colorVia = coloresVias[idAsiento] || '#dfe6e9';
            
            let dist = (parseInt(idAsiento) - parseInt(miID) + 6) % 6;
            const anguloSilla = { 0: 90, 1: 150, 2: 210, 3: 270, 4: 330, 5: 30 };
            const grados = anguloSilla[dist];
            const rad = (grados * Math.PI) / 180;
            const nodosCoords = { "estacion": { x: 0, y: 0, anguloBase: grados, esMula: true } };

            fichas.forEach((f) => {
                const padreId = f.padre_id || "estacion";
                const padre = nodosCoords[padreId] || nodosCoords["estacion"];
                // ✅ Ramas PARALELAS: mismo ángulo que la vía, sin divergencia angular
                let angulo = padre.anguloBase;
                
                const rad = (angulo * Math.PI) / 180;
                const esMula = Number(f.v1) === Number(f.v2);
                const padreEsMula = padre.esMula;
                
                const largoPadre = padreEsMula ? MotorGeometrico.config.anchoFicha : MotorGeometrico.config.largoFicha;
                const largoActual = esMula ? MotorGeometrico.config.anchoFicha : MotorGeometrico.config.largoFicha;
                
                let distPaso = (largoPadre / 2) + (largoActual / 2) + MotorGeometrico.config.separacion;
                if (padreId === "estacion") {
                     distPaso = MotorGeometrico.config.radioEstacion; 
                }

                // Desplazamiento lateral para la primera ficha de cada rama
                // Solo se aplica en el nodo directo de la mula (rama izq/der)
                let perpX = 0, perpY = 0;
                if (f.rama === 'izq' || f.rama === 'der') {
                    const perpRad = rad + Math.PI / 2;
                    const perpOffset = MotorGeometrico.config.anchoFicha / 2 + MotorGeometrico.config.separacion;
                    const signPerp = (f.rama === 'izq') ? -1 : 1;
                    perpX = signPerp * Math.cos(perpRad) * perpOffset;
                    perpY = signPerp * Math.sin(perpRad) * perpOffset;
                }

                const px = padre.x + perpX + Math.cos(rad) * distPaso;
                const py = padre.y + perpY + Math.sin(rad) * distPaso;
                
                nodosCoords[f.id] = { x: px, y: py, anguloBase: angulo, esMula: esMula };
                
                layout.push({
                    id: `mesa-ficha-${f.id}`, tipo: 'ficha', esMula: esMula, ficha: f,
                    x: px, y: py, rotacion: angulo
                });
            });

            // Fantasma
            this.obtenerPuntas(fichas, estado).forEach(punta => {
                const fantasmaId = `fantasma-${idAsiento}-${punta.padreId}-${punta.rama}`;
                const fichaSel = window.fichaSeleccionadaParaTirar;
                let iluminada = (puedoTirarAqui && fichaSel && (Number(fichaSel.l1) === Number(punta.valor) || Number(fichaSel.l2) === Number(punta.valor)));
                
                // Fantasma — también con ramas paralelas
                const padreId = punta.padreId || "estacion";
                const padre = nodosCoords[padreId] || nodosCoords["estacion"];
                // ✅ Mismo ángulo que la vía (sin divergencia angular)
                let angulo = padre.anguloBase;
                
                const rad = (angulo * Math.PI) / 180;
                const padreEsMula = padre.esMula;
                
                const largoPadre = padreEsMula ? MotorGeometrico.config.anchoFicha : MotorGeometrico.config.largoFicha;
                const largoActual = MotorGeometrico.config.largoFicha; 
                
                let distPaso = (largoPadre / 2) + (largoActual / 2) + MotorGeometrico.config.separacion;
                if (padreId === "estacion") {
                     distPaso = MotorGeometrico.config.radioEstacion;
                }

                // Desplazamiento lateral para fantasmas de ramas izq/der
                let perpX = 0, perpY = 0;
                if (punta.rama === 'izq' || punta.rama === 'der') {
                    const perpRad = rad + Math.PI / 2;
                    const perpOffset = MotorGeometrico.config.anchoFicha / 2 + MotorGeometrico.config.separacion;
                    const signPerp = (punta.rama === 'izq') ? -1 : 1;
                    perpX = signPerp * Math.cos(perpRad) * perpOffset;
                    perpY = signPerp * Math.sin(perpRad) * perpOffset;
                }

                const px = padre.x + perpX + Math.cos(rad) * distPaso;
                const py = padre.y + perpY + Math.sin(rad) * distPaso;

                layout.push({
                    id: fantasmaId, tipo: 'fantasma', viaId: idAsiento, padreId: punta.padreId, rama: punta.rama,
                    x: px, y: py, rotacion: angulo, iluminada: iluminada, color: colorVia,
                    textoEtiqueta: `Vía ${idAsiento}`,
                    trenPublico: estado.marcadores[idAsiento]
                });
            });
        });

        if (typeof MotorGeometrico !== 'undefined') {
            MotorGeometrico.dibujar(layout);
        }
    },
    
    mostrarMesa: function(estado) {
        const lobby = document.getElementById('lobby-overlay');
        const mesa = document.getElementById('mesa-verde');
        
        if(lobby) lobby.style.setProperty('display', 'none', 'important');
        if(mesa) mesa.style.display = 'flex';
        
    },
 
    renderizarManoLocal: function(misDatos, estado) {
        const contenedorMano = document.getElementById('zona-mano');
        if (!contenedorMano || !misDatos) return;

        contenedorMano.innerHTML = '';
        const miID = String(window.mi_asiento);
        const esMiTurno = String(estado.turno_actual_asiento) === miID;
        const legales = estado.extremos_legales || [];

        misDatos.mano.forEach(ficha => {
            const puedeJugar = legales.some(e => Number(ficha.l1) === Number(e) || Number(ficha.l2) === Number(e));
            let estadoVisual = esMiTurno ? (puedeJugar ? "jugable" : "bloqueada") : "normal";
            
            // Si es la ficha que ya tenemos seleccionada, le ponemos la clase activa
            if (window.fichaSeleccionadaParaTirar && window.fichaSeleccionadaParaTirar.id === ficha.id) {
                estadoVisual += " ficha-activa seleccionada";
            }

            this.dibujarFicha('zona-mano', ficha, estadoVisual);
        });
    },
    
    renderizarPartida: function(estado) {
        if (!window.mi_asiento) {
            window.mi_asiento = localStorage.getItem('mi_asiento_dominio');}

        this.mostrarMesa(estado);

        try {
            this.dibujarJugadores(estado);

            if (estado.estacion_central && !window.mulaAnunciada) {
                const nombreAbridor = estado.jugador_mula_nombre || "Un jugador";
                const nombreSiguiente = estado.jugadores[estado.turno_actual_asiento]?.nombre || "el siguiente";
                this.anunciarMulaMayor(nombreAbridor, estado.estacion_central, nombreSiguiente);
                window.mulaAnunciada = true; 
            }

            this.renderizarVias(estado);

            // --- ACTUALIZACIÓN DEL POZO ---
            const elPozo = document.getElementById('el-pozo');
            const pozoCount = document.getElementById('pozo-count');
            const cantidadFichas = (estado.pozo && Array.isArray(estado.pozo)) ? estado.pozo.length : 0;
            if (elPozo) {
                elPozo.setAttribute('data-cantidad', cantidadFichas);
            }
            if (pozoCount) {
                pozoCount.textContent = cantidadFichas;
            }

                const miID = String(window.mi_asiento); 
                const misDatos = estado.jugadores[miID];
                const coloresVias = { 1: '#e17055', 2: '#0984e3', 3: '#00b894', 4: '#f1c40f', 5: '#6c5ce7', 6: '#d63031' };
                const miColor = coloresVias[miID] || '#dfe6e9';

                // Aplicamos la identidad visual a la zona inferior
                const panelLocal = document.getElementById('info-jugador-local');
                if (panelLocal) {
                    panelLocal.style.borderColor = miColor;
                    panelLocal.style.boxShadow = `0 0 15px ${miColor}44`; // 44 es transparencia
                }

                if (misDatos) {
                    document.getElementById('texto-nombre').textContent = misDatos.nombre;
                    document.getElementById('label-asiento').textContent = `Silla ${miID}`;
                    document.getElementById('conteo-fichas-local').textContent = misDatos.mano.length;

                    // Llamada modular
                    this.renderizarManoLocal(misDatos, estado);
                }

                this.actualizarControlesRobarPasar(estado);
                
            } catch (error) {
                console.error("❌ Error durante el renderizado visual:", error);
        }
    },

    dibujarJugadores: function(estado) {
        const contenedorMesa = document.getElementById('mesa-verde');
        document.querySelectorAll('.jugador-gafete').forEach(g => g.remove());

        const mapaPosicionesRelativas = {
            1: { top: '50%', left: '15px', transform: 'translateY(-50%)' },     
            2: { top: '15px', left: '15px', transform: 'none' },  
            3: { top: '10px', left: '50%', transform: 'translateX(-50%)' },     
            4: { top: '15px', right: '15px', transform: 'none' },  
            5: { top: '50%', right: '15px', transform: 'translateY(-50%)' }     
        };

        const miSilla = parseInt(window.mi_asiento);
        const totalSillas = 6;

        Object.keys(estado.jugadores).forEach((id) => {
            const sillaInvitado = parseInt(id);
            if (sillaInvitado === miSilla) return;

            const jugador = estado.jugadores[id];
            if (!jugador || !jugador.nombre) return; 

            let distancia = (sillaInvitado - miSilla + totalSillas) % totalSillas;
            const div = document.createElement('div');
            div.className = 'jugador-gafete';

            div.id = `jugador-${id}`;
            
            if (id === String(estado.turno_actual_asiento)) div.classList.add('turno-activo');

            if (mapaPosicionesRelativas[distancia]) Object.assign(div.style, mapaPosicionesRelativas[distancia]);

            div.innerHTML = `
                <span class="etiqueta-asiento">Silla ${id}</span> 
                <div class="gafete-info">
                    <strong>${jugador.nombre}</strong>
                    <span class="conteo-fichas">${jugador.mano.length} fichas</span>
                </div>
            `;
            contenedorMesa.appendChild(div);
        });
    },
    
    dibujarFicha: function(contenedor_id, ficha_data, estado_visual = "normal") {
        const contenedor = document.getElementById(contenedor_id);
        if (!contenedor) return;

        const v1 = ficha_data.v1 !== undefined ? ficha_data.v1 : ficha_data.l1;
        const v2 = ficha_data.v2 !== undefined ? ficha_data.v2 : ficha_data.l2;

        const div = document.createElement('div');
        div.className = `ficha ${estado_visual}`; 
        div.id = ficha_data.id;

        // 🚩 Lógica de Mula: Si es mesa y los valores son iguales
        if (estado_visual === "mesa" && v1 === v2) {
            div.classList.add('mula-radial');
        }

        div.innerHTML = `
            <div class="cara-ficha cara-conexion">${v1}</div>
            <div class="cara-ficha cara-punta">${v2}</div>
        `;

        if (estado_visual.includes("jugable")) {
            div.onclick = (event) => {
                // 1. Si ya estaba seleccionada, la deseleccionamos
                if (window.fichaSeleccionadaParaTirar && window.fichaSeleccionadaParaTirar.id === ficha_data.id) {
                    window.fichaSeleccionadaParaTirar = null;
                    console.log("🚫 Selección cancelada");
                } else {

                    window.fichaSeleccionadaParaTirar = {
                        ...ficha_data,
                        v1: v1, 
                        v2: v2
                    };
                    console.log(`🎴 SELECCIÓN FIRME: [${v1}|${v2}]`);
                }

                if (window.estado_actual) {
                    this.renderizarPartida(window.estado_actual);
                } else {
                    console.error("❌ No se puede re-renderizar: window.estado_actual es null");
                }
            };
        }
        
        contenedor.appendChild(div);

    },

    anunciarMulaMayor: function(nombreJugador, fichaMula, siguienteTurnoNombre) {
        const overlay = document.getElementById('anuncio-mula');
        const texto = document.getElementById('texto-mula-jugador');
        const contenedorFicha = document.getElementById('ficha-mula-visual');

        // Seguridad: Si no existe el HTML, detenemos la función
        if (!overlay || !contenedorFicha) return;


        // 1. Preparamos el contenido
        contenedorFicha.innerHTML = '';
        this.dibujarFicha('ficha-mula-visual', fichaMula, "mesa");
        texto.innerHTML = `<strong>${nombreJugador}</strong> inició con la mula.`;
        
        // 2. MOSTRAR: Quitamos oculto y añadimos visible
        overlay.classList.remove('oculto');
        setTimeout(() => {
            overlay.classList.add('visible');
        }, 10);


        setTimeout(() => {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.classList.add('oculto');
                actualizarNoticia(`Turno de: ${siguienteTurnoNombre}`);
            }, 500);
        }, 5000);
    },

    actualizarTurnoVisual: function(asientoActivo) {
        if (!asientoActivo) return;

        const seatStr = String(asientoActivo); // Normalización total
        window.asiento_en_turno = seatStr;

        // 1. Limpiar brillo anterior
        document.querySelectorAll('.jugador-gafete, #info-jugador-local').forEach(el => {
            el.classList.remove('turno-activo');
        });

        // 2. Buscar el nombre en el estado global
        const datosJugador = window.estado_actual.jugadores[seatStr];
        const nombre = datosJugador ? datosJugador.nombre : `Jugador ${seatStr}`;

        // 3. Iluminar local o remoto
        if (seatStr === String(window.mi_asiento)) {
            const local = document.getElementById('info-jugador-local');
            if (local) local.classList.add('turno-activo');
            actualizarNoticia(`🟢 Es TU turno, ${nombre}`);
        } else {
            const elGafete = document.getElementById(`jugador-${seatStr}`);
            if (elGafete) {
                elGafete.classList.add('turno-activo');
                actualizarNoticia(`🚂 Turno de ${nombre}...`);
            }
        }
    },

    actualizarControlesRobarPasar: function(estado) {
        const esMiTurno = String(estado.turno_actual_asiento) === String(window.mi_asiento);
        const yaRobo = estado.ya_robo_en_turno || false;
        const contenedor = document.getElementById('botones-robar-pasar');
        const btnRobar = document.getElementById('btn-robar');
        const btnPasar = document.getElementById('btn-pasar');

        if (!contenedor) return;

        if (esMiTurno) {
            contenedor.style.display = 'flex'; 
            if (!yaRobo) {
                btnRobar.style.display = 'block';
                btnPasar.style.display = 'none'; // El pasar ahora es automático
            } else {
                btnRobar.style.display = 'none';
                btnPasar.style.display = 'none'; // El pasar ahora es automático
            }
        } else {
            contenedor.style.display = 'none';
        }
    },

    agregarMensajeChat: function(nombre, mensaje, esPropio) {
        const contenedor = document.getElementById('mensajes-chat');
        const div = document.createElement('div');
        
        // Le ponemos una clase distinta si es nuestro o de alguien más
        div.className = esPropio ? 'msg-mio' : 'msg-otro';
        div.innerHTML = `<strong>${nombre}:</strong> <span>${mensaje}</span>`;

        contenedor.appendChild(div);
        // Bajamos el scroll para ver el último chisme
        contenedor.scrollTop = contenedor.scrollHeight;
    },

    dibujarContenidoNativo: function(el, datos) {
        if (datos.tipo === 'estacion') {
            const v1 = datos.ficha ? datos.ficha.l1 : '?'; 
            const v2 = datos.ficha ? datos.ficha.l2 : '?';
            el.innerHTML = `
                <div class="estacion-base">
                    <div class="vias-decorativas"></div>
                    <div class="tren-logo">🚂</div>
                    <div class="estacion-texto">MEXICO</div>
                </div>
                <div class="ficha mesa mula-radial estacion-ficha">
                    <div class="cara-ficha cara-conexion">${v1}</div>
                    <div class="cara-ficha cara-punta">${v2}</div>
                </div>
            `;
            return;
        }
        if (datos.tipo === 'ficha') {
            const c1 = (Number(datos.ficha.v1) === 6 || Number(datos.ficha.v1) === 9) ? 'numero-subrayado' : '';
            const c2 = (Number(datos.ficha.v2) === 6 || Number(datos.ficha.v2) === 9) ? 'numero-subrayado' : '';
            
            el.innerHTML = `
                <div class="cara-ficha cara-conexion ${c1}">${datos.ficha.v1}</div>
                <div class="cara-ficha cara-punta ${c2}">${datos.ficha.v2}</div>
            `;
        } else if (datos.tipo === 'fantasma') {
            el.style.color = datos.color;
            const iconoTren = datos.trenPublico ? ' <span style="font-size: 1.2rem; filter: drop-shadow(0 0 5px gold);">🪙</span>' : '';
            el.innerHTML = `
                <div class="fantasma-forma"></div>
                <div class="etiqueta-flotante">${datos.textoEtiqueta}${iconoTren}</div>
            `;
            el.onclick = (event) => {
                event.stopPropagation();
                if (el.dataset.iluminada === 'true') {
                    window.enviarJugadaAlServidor(datos.viaId, datos.padreId, datos.rama); 
                }
            };
        }
    },

    actualizarFantasmaNativo: function(el, datos) {
        const forma = el.querySelector('.fantasma-forma');
        if (!forma) return;
        el.dataset.iluminada = datos.iluminada;
        if (datos.iluminada) {
            forma.style.backgroundColor = `${datos.color}66`;
            forma.style.boxShadow = `0 0 15px ${datos.color}`;
            forma.style.borderColor = datos.color;
            el.style.cursor = "pointer";
            el.classList.add("iluminada");
        } else {
            forma.style.backgroundColor = "rgba(255,255,255,0.05)";
            forma.style.boxShadow = "none";
            forma.style.borderColor = "currentColor";
            el.style.cursor = "default";
            el.classList.remove("iluminada");
        }
    },
    
};




function actualizarNoticia(mensaje) {
    const etiquetaTexto = document.getElementById('texto-noticia');
    if (etiquetaTexto) etiquetaTexto.innerText = mensaje;
}


document.getElementById('burbuja-comms').onclick = () => {
    document.getElementById('panel-comunicaciones').classList.remove('panel-oculto');
};

document.getElementById('btn-cerrar-panel').onclick = () => {
    document.getElementById('panel-comunicaciones').classList.add('panel-oculto');
};