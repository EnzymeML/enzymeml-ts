/**
 * ChEBI fetcher for retrieving chemical entries by ID.
 * 
 * This module provides functionality to fetch chemical entity data from the
 * ChEBI database by ID and map it to the EnzymeML data model (v2).
 */

import { SmallMolecule } from '..';

/**
 * Fetch a ChEBI entry by ID and convert it to a SmallMolecule object.
 * 
 * @param chebiId - The ChEBI ID to fetch
 * @returns A SmallMolecule object with data from ChEBI
 * @throws ChEBIError if the ChEBI ID is invalid or not found
 * @throws Error if the connection to the ChEBI server fails
 */
export async function fetchChebi(
    chebiId: string
): Promise<SmallMolecule> {
    const url = new URL("https://www.ebi.ac.uk/chebi/backend/api/public/compounds/");
    url.searchParams.set('chebi_ids', chebiId);

    try {
        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new ChEBIError(`HTTP ${response.status}: ${response.statusText}`);
        }

        const chebiEntity: ChEBIApiResponse = await response.json();

        // Special case: API returns empty object when no data is found
        if (!chebiEntity || Object.keys(chebiEntity).length === 0) {
            throw new ChEBIError(`No data found for ChEBI ID ${chebiId}`);
        }

        // Get the first entry - API returns a map with ChEBI ID as key
        const entry = Object.values(chebiEntity)[0];

        return processChebiEntry(entry);
    } catch (error) {
        // Re-throw ChEBIError instances to preserve error type
        if (error instanceof ChEBIError) {
            throw error;
        }
        // Wrap other errors in ChEBIError for consistent error handling
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new ChEBIError(`Failed to fetch ChEBI ID ${chebiId}: ${errorMessage}`, error instanceof Error ? error : undefined);
    }
}

/**
 * Fetch multiple ChEBI entries by their IDs and convert them to SmallMolecule objects.
 * 
 * @param chebiIds - Array of ChEBI IDs to fetch
 * @returns Array of SmallMolecule objects with data from ChEBI
 * @throws ChEBIError if any ChEBI ID is invalid or not found
 * @throws Error if the connection to the ChEBI server fails
 */
export async function fetchChebiBatch(chebiIds: string[]): Promise<SmallMolecule[]> {
    // Special case: Return empty array for empty input to avoid unnecessary API call
    if (chebiIds.length === 0) {
        return [];
    }

    const url = new URL("https://www.ebi.ac.uk/chebi/backend/api/public/compounds/");
    url.searchParams.set('chebi_ids', chebiIds.join(','));

    try {
        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new ChEBIError(`HTTP ${response.status}: ${response.statusText}`);
        }

        const chebiEntity: ChEBIApiResponse = await response.json();
        // Note: This will process all entries, including those marked as non-existent
        // Individual entry validation happens in processChebiEntry
        return Object.values(chebiEntity).map(processChebiEntry);
    } catch (error) {
        if (error instanceof ChEBIError) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new ChEBIError(`Failed to fetch ChEBI batch: ${errorMessage}`, error instanceof Error ? error : undefined);
    }
}

/**
 * Search for ChEBI entries by query string.
 * 
 * This function searches the ChEBI database using the EBI search API and returns
 * an array of SmallMolecule objects for each matching entry.
 * 
 * @param query - The search query string to find ChEBI entries
 * @param size - The maximum number of search results to return
 * @returns A promise that resolves to an array of SmallMolecule objects
 * @throws Error if the search request fails or the API is unavailable
 * 
 * @example
 * ```typescript
 * // Search for glucose entries
 * const glucoseResults = await searchChebi('glucose', 10);
 * 
 * // Search for ATP entries
 * const atpResults = await searchChebi('ATP', 5);
 * ```
 */
export async function searchChebi(query: string, size?: number): Promise<SmallMolecule[]> {
    const url = new URL('https://www.ebi.ac.uk/chebi/backend/api/public/es_search/');
    url.searchParams.set('term', query);

    // Optional size parameter to limit search results
    if (size) {
        url.searchParams.set('size', size.toString());
    }

    try {
        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new ChEBIError(`Search failed: HTTP ${response.status}: ${response.statusText}`);
        }

        const searchResults: ChebiSearchResponse = await response.json();

        // Special case: Validate search response structure
        if (!searchResults || !searchResults.results) {
            throw new ChEBIError('Invalid search response format');
        }

        // Extract ChEBI accession numbers from search results
        const chebiIds = searchResults.results.map((result) => result._source.chebi_accession);
        // Fetch full compound data for all search results
        return fetchChebiBatch(chebiIds);
    } catch (error) {
        if (error instanceof ChEBIError) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new ChEBIError(`Failed to search ChEBI: ${errorMessage}`, error instanceof Error ? error : undefined);
    }
}

/**
 * Process a ChEBI entry result and convert it to a SmallMolecule object.
 * 
 * @param entry - The ChEBI entry result from the API
 * @returns A SmallMolecule object with mapped data
 */
function processChebiEntry(entry: ChEBIEntryResult): SmallMolecule {
    // Create a SmallMolecule instance
    const id = processId(entry.data.ascii_name);

    return {
        id,
        name: entry.data.ascii_name,
        // Special case: Structure data may be null for some compounds
        canonical_smiles: entry.data.default_structure?.smiles || null,
        inchi: entry.data.default_structure?.standard_inchi || null,
        inchikey: entry.data.default_structure?.standard_inchi_key || null,
        constant: false,
        vessel_id: null,
        synonymous_names: [], // TODO: Could be populated from entry.data.names if needed
        references: [
            `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${entry.standardized_chebi_id}`
        ],
    };
}

/**
 * Process a name string to create a valid identifier.
 * 
 * Replaces non-alphanumeric characters with underscores, removes consecutive
 * underscores, converts to lowercase, and trims leading/trailing underscores.
 * 
 * @param name - The name string to process
 * @returns A processed identifier string
 */
export function processId(name: string): string {
    // Replace non-alphanumeric characters with underscore
    // and then replace multiple consecutive underscores with a single one
    return name
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase()
        .replace(/^_+|_+$/g, ''); // trim underscores from start and end
}

/**
 * Top-level response structure from ChEBI API
 * Maps ChEBI IDs to their corresponding entry data
 */
interface ChEBIApiResponse {
    [chebiId: string]: ChEBIEntryResult;
}

/**
 * Individual ChEBI entry result
 */
interface ChEBIEntryResult {
    standardized_chebi_id: string;
    primary_chebi_id: string;
    exists: boolean;
    id_type: string;
    data: ChEBIEntryData;
}

/**
 * Core data structure for a ChEBI entry
 */
interface ChEBIEntryData {
    id: number;
    chebi_accession: string;
    name: string;
    ascii_name: string;
    stars: number;
    definition: string;
    names: ChEBINames;
    chemical_data: ChEBIChemicalData;
    default_structure: ChEBIStructure;
    modified_on: string;
    secondary_ids: string[];
    is_released: boolean;
}

/**
 * Chemical structure information
 * Note: All structure fields may be null for compounds without structural data
 */
interface ChEBIStructure {
    id: number;
    smiles: string;
    standard_inchi: string;
    standard_inchi_key: string;
    wurcs: string | null;
    is_r_group: boolean;
}

/**
 * Names and synonyms structure
 * All name types are optional as not all compounds have all name types
 */
interface ChEBINames {
    SYNONYM?: ChEBIName[];
    "IUPAC NAME"?: ChEBIName[];
    INN?: ChEBIName[];
}

/**
 * Individual name/synonym entry
 */
interface ChEBIName {
    name: string;
    status: string;
    type: string;
    source: string;
    ascii_name: string;
    adapted: boolean;
    language_code: string;
}

/**
 * Chemical formula and mass data
 */
interface ChEBIChemicalData {
    formula: string;
    charge: number;
    mass: string;
    monoisotopic_mass: string;
}

/**
 * Search response structure from ChEBI search API
 * Note: Results array may be empty for queries with no matches
 */
interface ChebiSearchResponse {
    results: { "_source": { chebi_accession: string } }[];
}

/**
 * Error class for ChEBI-specific errors.
 */
export class ChEBIError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'ChEBIError';
    }
}