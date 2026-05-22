"""FastAPI router packages.

main.py wires each router via app.include_router() so endpoints stay
organised by domain (anomalies, candidates, jobs, ...) instead of
piling up in a single file.
"""
