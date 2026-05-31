# ==========================================================================
# ⚙️ config.py - Centralización de Voltaje del TM-91
# Auditoría NAC-T: Cero importaciones externas para evitar ciclos.
# ==========================================================================
import os

class Config:
    """Configuración inamovible para el puerto de Veracruz."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'el-secreto-de-claudia-tm-veracruz-2026'
    DEBUG = True
    PORT = 5012
    # Ruta absoluta para que el Notario no se pierda
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SAVE_FILE = os.path.join(BASE_DIR, 'partida_save.json')

    @staticmethod
    def init_app(app):
        pass