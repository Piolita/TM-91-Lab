# app.py - Host de la SPA "Tren Mexicano 91"
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from config import Config
from telefonista import iniciar_eventos_socket

# Inicialización siguiendo el Mapa Maestro
app = Flask(__name__)
app.config.from_object(Config)

# IMPORTANTE: Usamos eventlet como motor de vapor para tiempo real
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Conectamos a la Telefonista para que gestione los eventos de los jugadores
iniciar_eventos_socket(socketio)

@app.route('/')
def index():
    """Sirve la Interfaz de la Mesa Verde."""
    return render_template('index.html')

if __name__ == '__main__':
   

    puerto = getattr(Config, 'PORT', 5012)
    debug_mode = getattr(Config, 'DEBUG', True)
    
   
    print("\n" + "="*50)
    print(f"🚂 TM-91: ¡ESTACIÓN ENCENDIDA!")
    print(f"🔗 LOCAL: http://127.0.0.1:{puerto}")
    print(f"🛠  MODO: {'DEPURACIÓN ACTIVA' if debug_mode else 'PRODUCCIÓN'}")
    print("="*50 + "\n")
    
    socketio.run(
        app, 
        host='0.0.0.0', 
        port=puerto, 
        debug=debug_mode, 
        use_reloader=True, 
        log_output=False 
    )