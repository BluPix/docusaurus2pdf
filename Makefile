.PHONY: build dev start clean install test tex pdf pipeline

install:
	npm install

build:
	npx tsc

dev:
	npx tsx src/cli.ts -i ./example-docusaurus -o ./output

start:
	node dist/cli.js

clean:
	rm -rf dist output pdf-export

test: build
	node dist/cli.js -i ./example-docusaurus -o ./output --tex-only

# Pipeline workflow: Step 1 - Generate .tex files
tex:
	npx tsx src/cli.ts -i ./example-docusaurus -o ./pdf-export --tex-only

# Pipeline workflow: Step 2 - Compile PDFs from .tex
pdf:
	npx tsx src/cli.ts -o ./pdf-export --compile-only

# Full pipeline (for testing)
pipeline: tex pdf

.DEFAULT_GOAL := build
