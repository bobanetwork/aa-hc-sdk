.PHONY: install test test-unit test-integration

install:
	python -m venv venv
	./venv/bin/pip install -r requirements.txt

test:
	./venv/bin/pytest

test-unit:
	./venv/bin/pytest tests/unit -v

test-integration:
	./venv/bin/pytest tests/integration -v -s

