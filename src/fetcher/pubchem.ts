import { Compound } from 'pubchem';
import { SmallMolecule } from '..';

/**
 * Searches PubChem for a compound by name
 * @param query The compound name to search for
 * @returns The compound information
 */
async function fromPubChem(query: string): Promise<SmallMolecule> {
    try {
        const compound = await Compound.fromName(query);
        const data = await compound.getData();
        console.log(data);
        return {
            id: compound.getCID(),
            name: data.getIdentifiers().formula.label,
            constant: false,
            vessel_id: null,
            canonical_smiles: data.getSMILES().value,
            inchi: data.getInChI().value,
            inchikey: data.getInChIKey().value,
            synonymous_names: [],
            references: [],
        };
    } catch (error: any) {
        console.error(`Error searching PubChem: ${error.message}`);
        throw error;
    }
}

export { fromPubChem };