# EnzymeML-TS

[![npm version](https://badge.fury.io/js/enzymeml.svg)](https://badge.fury.io/js/enzymeml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The **official TypeScript library** for [EnzymeML](https://enzymeml.org), providing comprehensive type definitions and runtime validation for enzymatic experiment data.

## Overview

EnzymeML is a standardized data exchange format that supports the comprehensive documentation of enzymatic data by describing reaction conditions, time courses of substrate and product concentrations, kinetic models, and estimated kinetic constants. This TypeScript library provides:

- 🔒 **Type-safe** data structures based on EnzymeML v2 specification
- ⚡ **Runtime validation** using [Zod](https://github.com/colinhacks/zod)
- 📝 **Complete type inference** for excellent IDE support
- 🌐 **JSON-LD compatible** for semantic web applications
- 🔍 **OpenAI streaming utilities** for AI-powered data extraction from text and files using the OpenAI API

## Installation

In order to use this library, you need to install it in your project. You can do this using NPM or Yarn.

```bash
# Using NPM
npm install enzymeml

# Using Yarn
yarn add enzymeml
```

## Usage

There are two ways of using this library. First, you can use the `EnzymeMLDocumentSchema` or any of the sub-schemas to validate your dataset against the EnzymeML V2 specification through the usage of Zod. Second, you can use the `EnzymeMLDocument` or any of the sub-types in your web-application to provide a type-safe interface for your users.

### Validation

The following example shows how to validate a dataset against the EnzymeML V2 specification using Zod.

```typescript
import { EnzymeMLDocumentSchema } from 'enzymeml';

const data = {
    "version": "2.0.0",
    "description": "This is a test EnzymeML document",
    "name": "Test EnzymeML Document",
    "small_molecules": [
        {
            "id": "s1",
            "name": "Small Molecule 1",
            "canonical_smiles": "C1=CC=C(C=C1)C(=O)O"
        }
    ]
}

const result = EnzymeMLDocumentSchema.parse(data);

if (!result.success) {
    console.error(result.error);
}
```

### Fetchers

The library provides both direct fetchers and search capabilities for the following sources:

- [ChEBI](https://www.ebi.ac.uk/chebi/)
- [PDB](https://www.rcsb.org/)
- [UniProt](https://www.uniprot.org/)
- [Rhea](https://www.rhea-db.org/)
- [PubChem](https://pubchem.ncbi.nlm.nih.gov/)

```typescript
import { fetchRhea, fetchPdb, fetchPubChem, searchChebi } from 'enzymeml';

const enzmldoc: EnzymeMLDocument = {
    ... // Your EnzymeML document
}

// Fetch specific entries by ID
const [reaction, smallMolecules] = await fetchRhea('RHEA:13065');
const protein = await fetchPdb('PDB:1LYZ');
const smallMolecule = await fetchPubChem('ethanol');

// Search for entries by name
const glucoseResults = await searchChebi('glucose', 10);

enzmldoc.reactions.push(reaction);
enzmldoc.small_molecules.push(...smallMolecules, ...glucoseResults);
enzmldoc.proteins.push(protein);
```

### LLM Integration

The library includes OpenAI streaming utilities for AI-powered data generation and analysis:

```typescript
import OpenAI from 'openai';
import { extractData, EnzymeMLDocumentSchema, UserQuery, PDFUpload, ImageUpload } from 'enzymeml';

// Create OpenAI client
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Upload files
const pdfUpload = new PDFUpload('./document.pdf');
await pdfUpload.upload();

const imageUpload = new ImageUpload('./image.png');
await imageUpload.upload();

// Generate structured EnzymeML documents with AI
const { chunks, final } = extractData({
  model: 'gpt-4o',
  input: [
    new SystemQuery('You are an expert at extracting structured data from scientific documents.'),
    new UserQuery('Extract the metadata from the following documents and images'),
    pdfUpload,
    imageUpload,
  ],
  schema: EnzymeMLDocumentSchema,
  schemaKey: 'enzymeml_document',
  client: client,
});

// Stream the response
for await (const chunk of chunks) {
  if (chunk.kind === 'text') {
    console.log(chunk.delta);
  }
}

// Get the final validated document
const document = await final.output_parsed;
```

### Type-safe interface

The following example shows how to use the `EnzymeMLDocument` type to create a type-safe interface for your users.

```typescript
import { EnzymeMLDocument, SmallMolecule } from 'enzymeml';

const myFunction = (data: EnzymeMLDocument): SmallMolecule => {
    const smallMolecule = data.small_molecules.find((smallMolecule) => smallMolecule.id === 's1');
    if (!smallMolecule) {
        throw new Error('Small molecule not found');
    }
    return smallMolecule;
}
```

## Development

### Code Quality

This project uses ESLint for code linting and formatting. The linting rules are automatically enforced through pre-commit hooks using Husky.

#### Available Scripts

```bash
# Run ESLint and automatically fix issues
npm run lint

# Check for ESLint issues without fixing
npm run lint:check

# Run tests
npm test

# Build the project
npm run build
```

#### Pre-commit Hooks

This project uses [Husky](https://github.com/typicode/husky) to automatically run code quality checks before each commit:

- **ESLint**: Automatically runs on all staged TypeScript files
- **Auto-fix**: Attempts to automatically fix linting issues where possible
- **Commit blocking**: Prevents commits if there are unfixable linting errors

The pre-commit hook will:
1. Run `eslint --fix` on all staged `.ts` and `.js` files in the `src/` directory
2. Automatically stage any fixes made by ESLint
3. Block the commit if there are remaining linting errors that cannot be auto-fixed

#### Setting up Development Environment

After cloning the repository, run:

```bash
npm install
```

This will:
- Install all dependencies
- Set up Husky git hooks automatically via the `prepare` script
- Configure the pre-commit hook to run ESLint

#### Bypassing Pre-commit Hooks

In rare cases where you need to bypass the pre-commit hooks (not recommended), you can use:

```bash
git commit --no-verify -m "your commit message"
```

## Contributing

Contributions are welcome! Please feel free to submit an issue or a pull request.

Before submitting a pull request:
1. Ensure your code passes all ESLint checks (`npm run lint:check`)
2. Run the test suite (`npm test`)
3. Add tests for any new functionality

---

<div align="center">
<strong>Made with ❤️ by the EnzymeML Team</strong>
</div>