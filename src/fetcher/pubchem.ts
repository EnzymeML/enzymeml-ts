import { Compound } from 'pubchem';
import { SmallMolecule } from '..';

/**
 * Search for PubChem compounds by query string.
 * 
 * This function searches the PubChem database using the autocomplete API and returns
 * an array of SmallMolecule objects for each matching compound.
 * 
 * @param query - The search query string to find PubChem compounds
 * @param limit - The maximum number of search results to return
 * @returns A promise that resolves to an array of SmallMolecule objects
 * @throws Error if the search request fails or the API is unavailable
 */
async function searchPubChem(query: string, limit: number): Promise<SmallMolecule[]> {
    const url = new URL(`https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${query.toLowerCase()}/json`);
    url.searchParams.set('limit', limit.toString());

    const response = await fetch(url.toString());
    const data: SearchPubChemResponse = await response.json();
    const fetchPromises = data.dictionary_terms.compound.map((compound) => {
        return fetchPubChem(compound);
    });
    return Promise.all(fetchPromises);
}

/**
 * Searches PubChem for a compound by name
 * @param query The compound name to search for
 * @returns The compound information
 */
async function fetchPubChem(query: string): Promise<SmallMolecule> {
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

interface SearchPubChemResponse {
    status: {
        code: number;
    };
    total: number;
    dictionary_terms: {
        compound: string[];
    };
}

export { searchPubChem, fetchPubChem, fetchPubChem as fromPubChem };