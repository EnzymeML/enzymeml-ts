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

The library also provides fetchers for the following sources:

- [ChEBI](https://www.ebi.ac.uk/chebi/)
- [PDB](https://www.rcsb.org/)
- [UniProt](https://www.uniprot.org/)
- [Rhea](https://www.rhea-db.org/)

In the following example, we will utilize the fetchers to fetch a reaction from Rhea, which will return a reaction and a list of small molecules fetched from ChEBI. In addition, we will fetch a protein from PDB and a small molecule from PubChem.

```typescript
import { fetchRhea, fetchPdb, fromPubChem } from 'enzymeml';

const enzmldoc: EnzymeMLDocument = {
    ... // Your EnzymeML document
}

const [reaction, smallMolecules] = await fetchRhea('RHEA:13065');

enzmldoc.reactions.push(reaction);
enzmldoc.small_molecules.push(...smallMolecules);

const protein = await fetchPdb('PDB:1LYZ');
enzmldoc.proteins.push(protein);

const smallMolecule = await fromPubChem('ethanol');
enzmldoc.small_molecules.push(smallMolecule);
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

## Contributing

Contributions are welcome! Please feel free to submit an issue or a pull request.

---

<div align="center">
<strong>Made with ❤️ by the EnzymeML Team</strong>
</div>