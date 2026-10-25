import sys
from pathlib import Path

# Garante que 'backend/' esteja no sys.path para que 'app' seja importável nos testes
sys.path.insert(0, str(Path(__file__).parent))
