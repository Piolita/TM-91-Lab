// radio.py

// Al cargar la página, verificamos si venimos de un "refresh"
// radio.js - Carga inicial unificada
window.onload = () => {
    const asientoGuardado = localStorage.getItem('mi_asiento_dominio'); 
    const enPartida = localStorage.getItem('en_partida');

    console.log("Checking reconexión:", { asientoGuardado, enPartida });

    // Si ya estábamos jugando y tenemos asiento, pedimos reconexión directa
    if (asientoGuardado && enPartida === 'true') {
        console.log("🔄 Intentando reconectar al asiento:", asientoGuardado);
        socket.emit('reconectar_jugador', { asiento_id: asientoGuardado });
    } else {
        // Si no estábamos en partida, solo pedimos ver el lobby normal
        socket.emit('solicitar_estado_lobby');
    }
};

// radio.js - Declaración segura del Socket
if (typeof window.socket === 'undefined') {
    window.socket = io();
}
const socket = window.socket;

// Variables de estado local del jugador
let mi_asiento = localStorage.getItem('mi_asiento_dominio') || null;
let soy_anfitrion = false;
let partida_en_curso = localStorage.getItem('en_partida') === 'true'; // Sincronizado con memoria
window.mi_asiento = mi_asiento;
window.fichaSeleccionadaParaTirar = null;



/* ==========================================
   📻 SECCIÓN  ESCUCHAR AL SERVIDOR
   ========================================== */


// Al conectar, pedimos el estado actual del lobby
socket.on('connect', () => {
    if (partida_en_curso) {
        return; 
    }
    socket.emit('solicitar_estado_lobby');
});

// Escuchamos la respuesta con el mapa completo
socket.on('estado_lobby_actualizado', (data) => {
    for (const id in data.jugadores) {
        const p = data.jugadores[id];
        
        if (p && p.nombre) { 
            interfaz.marcarAsientoOcupado(id, p.nombre, p.es_anfitrion);
        }
    }
});

// Manejo inteligente de acceso y reconexión médica - CORREGIDO
socket.on('ticket_acceso', (data) => {
    if (data.autorizado) {        
        console.log("🎫 ¡Ticket de acceso autorizado por el servidor! Asiento asignado:", data.asiento_id);
        
        // Sincronizamos la identidad real que nos da el backend
        window.mi_asiento = data.asiento_id;
        mi_asiento = data.asiento_id;
        soy_anfitrion = data.es_anfitrion;
        
        // Guardamos el asiento real dictado por el servidor, borrando fantasmas viejos
        localStorage.setItem('mi_asiento_dominio', data.asiento_id);

        const estadoJuego = data.estado_completo;
        
        // RECONEXIÓN CRUCIAL: Verificamos si el estado de la partida ya está activo EN EL SERVIDOR
        if (estadoJuego && (estadoJuego.partida_iniciada || estadoJuego.partida_en_curso)) {
            console.log("🎴 La partida está activa en el servidor. Saltando lobby y forzando entrada a la mesa verde...");
            
            localStorage.setItem('en_partida', 'true');
            partida_en_curso = true;
            window.estado_actual = estadoJuego;
            
            // Forzamos el cambio de pantallas en el HTML
            const divLobby = document.getElementById('pantalla-lobby') || document.querySelector('.lobby-contenedor');
            const divMesa = document.getElementById('mesa-verde') || document.getElementById('pantalla-juego');
            
            if (divLobby) {
                const lobbyOverlay = document.getElementById('lobby-overlay');
                if (lobbyOverlay) lobbyOverlay.style.display = 'none';
                else divLobby.style.display = 'none';
            }
            if (divMesa) divMesa.style.display = 'block';

            if (typeof interfaz !== 'undefined' && typeof interfaz.renderizarPartida === "function") {
                interfaz.renderizarPartida(estadoJuego);
            }
            return; 
        }

        // ✨ SOLUCIÓN: Si entramos aquí, significa que el servidor dice que NO hay partida activa.
        // Sincronizamos y limpiamos la memoria del navegador de inmediato.
        partida_en_curso = false;
        localStorage.setItem('en_partida', 'false');

        // Si la partida NO ha iniciado, manejamos el botón del anfitrión en el lobby normal
        const btnInicio = document.getElementById('ui-btn-inicio');
        if (soy_anfitrion) {
            if (btnInicio) {
                console.log("🚂 Eres el jefe de estación. Desplegando botón de iniciar partida...");
                btnInicio.style.display = 'block';
            }
        } else {
            if (btnInicio) {
                btnInicio.style.display = 'none'; // Nos aseguramos de ocultarlo si no es el anfitrión
            }
        }
    } 
    else {
        console.warn("❌ RECHAZADO POR EL SERVIDOR: " + data.mensaje);
        alert(data.mensaje); 
        localStorage.removeItem('mi_asiento_dominio');
        localStorage.setItem('en_partida', 'false');
        partida_en_curso = false;
    }
});

socket.on('mensaje_telefonista', (data) => {
    if (data.tipo === 'asiento_ocupado') {
        interfaz.marcarAsientoOcupado(
            data.asiento_id, 
            data.nombre, 
            data.es_anfitrion // <--- Agregamos este cable
        );
    }
});

socket.on('partida_lista', (estado) => {
    localStorage.setItem('en_partida', 'true');  // ✅ clave unificada con window.onload
    partida_en_curso = true;
    window.estado_actual = estado;
    window.mi_asiento = mi_asiento;

    interfaz.renderizarPartida(estado);

    const idSiguiente = estado.turno_actual_asiento;
    console.log("🔦 Turno inicial para:", idSiguiente);
    console.log(`%c 🚂 ¡ARRANCA EL TREN!`, "color: #e67e22; font-weight: bold;");
});

// Escuchar actualizaciones de la mesa durante el juego
socket.on('actualizar_mesa', (estado) => {
    console.log("☎️ La Telefonista dice: '¡Traigo novedades frescas del Notario!'");
    
    window.estado_actual = estado;
    if (!window.mi_asiento) window.mi_asiento = localStorage.getItem('mi_asiento_dominio');

    // Verificamos si ya estamos en la mesa o seguimos en el lobby
    const mesaDiv = document.getElementById('mesa-verde');
    const yaEstamosJugando = mesaDiv && mesaDiv.style.display !== 'none';

    if (yaEstamosJugando) {
        const nombreTurno = estado.jugadores[estado.turno_actual_asiento]?.nombre || "???";
        console.log(`%c 🔦 EL CHISME: Turno de ${nombreTurno} `, "background: #333; color: #f1c40f; font-weight: bold;");

        // Mandamos al pintor a trabajar
        interfaz.renderizarPartida(estado);
        interfaz.actualizarTurnoVisual(estado.turno_actual_asiento);
        
        if (typeof interfaz.actualizarControlesRobarPasar === "function") {
            interfaz.actualizarControlesRobarPasar(estado);
        }
    } else {
        console.log("⏳ La Telefonista guardó el recado, pero dice que aún no pasas a la mesa.");
    }
});

// Escuchar el final de la ronda
socket.on('fin_de_ronda', (data) => {
    console.log("🏁 FIN DE RONDA: Ganador Silla " + data.ganador);
    const nombreGanador = window.estado_actual.jugadores[data.ganador]?.nombre || `Jugador ${data.ganador}`;
    
    // Mostramos un anuncio espectacular reutilizando el overlay
    const overlay = document.getElementById('anuncio-mula');
    if (overlay) {
        const titulo = document.getElementById('titulo-mula');
        const visual = document.getElementById('ficha-mula-visual');
        const texto = document.getElementById('texto-mula-jugador');
        
        if (titulo) titulo.innerHTML = "🏆 ¡RONDA TERMINADA!";
        if (visual) visual.innerHTML = "<span style='font-size: 5rem;'>👑</span>";
        if (texto) {
            texto.innerHTML = `
                <div style="font-size: 1.4rem; margin-top: 15px;">
                    <strong>¡${nombreGanador} ha ganado la ronda!</strong>
                </div>
                <div style="margin-top: 15px; font-size: 1rem; opacity: 0.9;">
                    El tren ha completado su recorrido con éxito.
                </div>
            `;
        }
        overlay.classList.remove('oculto');
        overlay.classList.add('visible');
        
        // Lo ocultamos automáticamente después de 6 segundos
        setTimeout(() => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.classList.add('oculto'), 500);
        }, 6000);
    }
    
    if (typeof actualizarNoticia === "function") {
        actualizarNoticia(`🏆 Ronda terminada. ¡Felicidades a ${nombreGanador}!`);
    }
    window.fichaSeleccionadaParaTirar = null;
});

// Escuchar si el Árbitro rechaza nuestra jugada o nuestro robo
socket.on('error_jugada', (data) => {
    console.warn("⚠️ ÁRBITRO DICE:", data.mensaje);
    radio.bloqueo_envio = false; 
    document.querySelectorAll('.ficha').forEach(f => f.classList.remove('ficha-activa'));
    window.fichaSeleccionadaParaTirar = null;
});

// Escuchar cuando un compañero pierde la conexión
socket.on('alerta_desconexion_jugador', (data) => {
    console.warn(`🔌 ALERTA: El jugador del asiento ${data.asiento_id} (${data.nombre}) se ha desconectado.`);
    
    // 1. Actualizamos el cintillo de noticias superior para que todos lean lo que pasó
    if (typeof actualizarNoticia === "function") {
        actualizarNoticia(`🔌 ${data.nombre} (Silla ${data.asiento_id}) se desconectó. Esperando reingreso...`);
    } else {
        const textoNoticia = document.getElementById('texto-noticia');
        if (textoNoticia) {
            textoNoticia.innerText = `🔌 ${data.nombre} (Silla ${data.asiento_id}) se desconectó. Esperando reingreso...`;
            textoNoticia.style.color = "#e74c3c"; // Lo pintamos en rojo de advertencia
        }
    }

    // 2. Le pedimos al pintor de la interfaz que altere visualmente el indicador de su turno
    if (typeof interfaz.marcarJugadorDesconectado === "function") {
        interfaz.marcarJugadorDesconectado(data.asiento_id);
    } else {
        // Solución directa si tu interfaz maneja clases visuales en los nombres
        // Buscamos el elemento visual del turno o nombre de ese asiento y le cambiamos el aspecto
        const contenedorTurno = document.getElementById(`status-turno-${data.asiento_id}`);
        if (contenedorTurno) {
            contenedorTurno.innerHTML = `<span style="color: #95a5a6; font-style: italic;">🔌 Desconectado</span>`;
        }
    }
});

/* ==========================================
   EL OBJETO RADIO (Acciones) 
   ========================================== */
const radio = {
    bloqueo_envio: false, 

    intentarTirar: function(fichaObjeto, viaDestino, padreDestino = null, ramaDestino = null) {
        if (this.bloqueo_envio) return; 

        // Verificamos que sea nuestro turno antes de molestar al servidor
        const miAsiento = String(window.mi_asiento);
        if (String(window.estado_actual.turno_actual_asiento) !== miAsiento) {
            console.warn("⚠️ No es tu turno, ten paciencia.");
            return;
        }

        if (!fichaObjeto) {
            console.warn("⚠️ No has seleccionado ninguna ficha.");
            return;
        }

        const paqueteJugada = {
            asiento: miAsiento,
            via_destino: String(viaDestino),
            ficha: fichaObjeto,
            padre_destino: padreDestino, 
            rama_destino: ramaDestino
        };

        console.log(`%c 📤 JUGADA: Ficha [${fichaObjeto.v1}|${fichaObjeto.v2}] ⮕ Vía: ${viaDestino}`, "color: #2ecc71; font-weight: bold;");

        this.bloqueo_envio = true; 
        socket.emit('jugada_jugador', paqueteJugada);
        
        // Desbloqueo de seguridad por si el servidor no responde
        setTimeout(() => { this.bloqueo_envio = false; }, 800);
    }
};

/* ==========================================
   📻 SECCIÓN ENVIAR AL SERVIDOR (Corregida y Unificada)
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    console.log("🔌 Inicializando interruptores de los botones en la interfaz...");

    // 1. Registro en Lobby con rastro de control estricto
    const botonesAsiento = document.querySelectorAll('.ui-asiento-btn');
    console.log(`🪑 Se encontraron ${botonesAsiento.length} sillas en el HTML esperando configuración.`);

    botonesAsiento.forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-asiento');
            const inputNombre = document.getElementById('ui-input-nombre');
            
            console.log("🎯 Clic en botón de asiento detectado. ID Silla:", id);

            if (!inputNombre) {
                console.error("❌ ERROR: No se encontró el cuadro de texto con ID 'ui-input-nombre' en el HTML.");
                alert("⚠️ Error interno: Falta el campo de nombre en la interfaz.");
                return;
            }

            const nombre = inputNombre.value.trim();
            console.log("👤 Nombre escrito detectado:", nombre);

            if (!nombre) {
                alert("⚠️ Dinos tu nombre primero.");
                return;
            }
            
            console.log("📤 Enviando orden de ocupar asiento a la Telefonista...", { asiento_id: id, nombre: nombre });
            socket.emit('evento_lobby', { asiento_id: id, nombre: nombre });
        };
    });

    // 2. Botón Inicio del Anfitrión
    const btnInicio = document.getElementById('ui-btn-inicio');
    if (btnInicio) {
        btnInicio.addEventListener('click', () => {
            console.log("🚂 ¡El Capitán dio la orden de arrancar el tren!");
            socket.emit('orden_arrancar_juego'); 
            btnInicio.disabled = true;
            btnInicio.innerText = "ARRANCANDO...";
        }, { once: true });
    }

    // 3. Botones de Acción en Mesa Verde (Robar y Pasar)
    const btnRobar = document.getElementById('btn-robar');
    if (btnRobar) {
        btnRobar.onclick = () => {
            if (typeof radio !== 'undefined' && radio.bloqueo_envio) return;
            console.log("🎲 Solicitando robar ficha del pozo para el asiento:", window.mi_asiento);
            socket.emit('solicitar_robo_pozo', { asiento: window.mi_asiento });
        };
    }

    const btnPasar = document.getElementById('btn-pasar');
    if (btnPasar) {
        btnPasar.onclick = () => {
            if (typeof radio !== 'undefined' && radio.bloqueo_envio) return;
            console.log("⏭️ El jugador decide pasar el turno. Asiento:", window.mi_asiento);
            socket.emit('pasar_turno', { asiento: window.mi_asiento });
        };
    }

    console.log("✅ Todos los botones de la interfaz han sido activados correctamente.");
});


// --- LÓGICA DEL CHAT (EMISOR) ---
const btnEnviar = document.getElementById('btn-enviar');
const inputMsg = document.getElementById('input-msg');

btnEnviar.onclick = () => {
    const texto = inputMsg.value.trim();
    if (texto !== "") {
        // La antena lanza el mensaje al servidor
        socket.emit('enviar_chat', {
            asiento_id: window.mi_asiento,
            mensaje: texto
        });
        inputMsg.value = ""; 
    }
};

// --- LÓGICA DEL CHAT (RECEPTOR) ---
socket.on('recibir_chat', (data) => {
    // Le pedimos al pintor que lo dibuje
    interfaz.agregarMensajeChat(data.nombre, data.mensaje, data.es_propio);
});


// Al final de radio.js para que interfaz.js te encuentre
window.enviarJugadaAlServidor = function(viaId, padreId, rama) {
    radio.intentarTirar(window.fichaSeleccionadaParaTirar, viaId, padreId, rama);
};