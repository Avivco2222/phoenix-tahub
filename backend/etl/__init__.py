"""ETL primitives — status canonicalisation and rule execution.

Lives under its own package so callers can do
``from etl.rules import canonicalize_statuses`` once the legacy
``internal_logic`` facade is retired.
"""
