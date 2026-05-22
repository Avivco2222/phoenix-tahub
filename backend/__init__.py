"""Phoenix Talent OS — FastAPI backend.

The package's source files (main.py, config.py, aliases.py,
internal_logic.py, …) are intended to be imported as top-level modules
(``import main``, ``import config``) because the entry point puts this
directory on sys.path:

* ``backend/scripts/start.sh`` runs ``uvicorn main:app`` from this
  directory.
* ``backend/conftest.py`` prepends ``backend/`` to sys.path for pytest.

This ``__init__.py`` exists only to mark the directory as a regular
Python package so editor / type-checker / IDE tooling (mypy, ruff,
PyCharm) recognises the source root.
"""
