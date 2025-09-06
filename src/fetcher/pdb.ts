/**
 * PDB fetcher for retrieving protein entries by ID.
 * 
 * This module provides functionality to fetch protein data from the
 * Protein Data Bank by ID and map it to the EnzymeML data model (v2).
 */

import { Protein } from '..';

/**
 * Fetch a PDB entry by ID and convert it to a Protein object.
 * 
 * @param pdbId - The PDB ID to fetch (e.g., '4HHB')
 * @param proteinId - Optional custom ID for the protein (derived from PDB if not provided)
 * @param entityId - The entity ID within the PDB structure (default is "1")
 * @param vesselId - The ID of the vessel to add the protein to
 * @returns A Protein object with data from PDB
 * @throws PDBError if the PDB ID is invalid or not found
 * @throws Error if the connection to the PDB server fails
 */
export async function fetchPdb(
    pdbId: string
): Promise<Protein> {
    const client = new PDBClient();

    // Allow prefixing with 'PDB:'
    if (pdbId.toLowerCase().startsWith("pdb:")) {
        pdbId = pdbId.split(":", 2)[1];
    }

    const pdbResponse = await client.getEntryById(pdbId);

    if (!pdbResponse) {
        throw new PDBError(`No data found for PDB ID ${pdbId}`);
    }

    // Get the entity data
    if (!pdbResponse.polymer_entities) {
        throw new PDBError("No polymer entries to fetch from.");
    }

    const entityData = pdbResponse.polymer_entities[1];

    if (!entityData) {
        throw new PDBError(`Entity ID 1 not found in PDB ${pdbId}`);
    }

    // Prepare data for Protein object
    // Use entity description or structure title for name
    const name = entityData.description ||
        (pdbResponse.struct?.title || `PDB ${pdbId}`);

    // Generate protein_id if not provided
    const finalProteinId =
        (entityData.description ? processId(entityData.description) : `${pdbId.toLowerCase()}_1`);

    // Create Protein instance
    const protein: Protein = {
        id: finalProteinId,
        name: name,
        sequence: entityData.sequence || null,
        organism: entityData.organism_scientific_name || null,
        organism_tax_id: entityData.organism_taxid ? String(entityData.organism_taxid) : null,
        ecnumber: entityData.ec_number || null,
        constant: true,
        vessel_id: null,
        references: []
    };

    // Add references
    protein.references.push(`https://www.rcsb.org/structure/${pdbId.toUpperCase()}`);

    // Add citation if available
    if (pdbResponse.citation && pdbResponse.citation.length > 0) {
        const firstCitation = pdbResponse.citation[0];
        if (firstCitation.doi) {
            protein.references.push(`https://doi.org/${firstCitation.doi}`);
        }
        if (firstCitation.pubmed_id) {
            protein.references.push(`https://pubmed.ncbi.nlm.nih.gov/${firstCitation.pubmed_id}`);
        }
    }

    return protein;
}

/**
 * Search for PDB entries by query string.
 * 
 * This function searches the PDB database using the RCSB search API and returns
 * an array of Protein objects for each matching entry.
 * 
 * @param query - The search query string to find PDB entries
 * @returns A promise that resolves to an array of Protein objects
 * @throws Error if the search request fails or the API is unavailable
 * 
 * @example
 * ```typescript
 * // Search for insulin entries
 * const insulinResults = await searchPdb('insulin');
 * 
 * // Search for lysozyme entries
 * const lysozymeResults = await searchPdb('lysozyme');
 * ```
 */
export async function searchPdb(query: string): Promise<Protein[]> {
    const url = "https://search.rcsb.org/rcsbsearch/v2/query";
    const searchQuery = prepareSearch(query);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: searchQuery
        });

        if (!response.ok) {
            throw new PDBError(`PDB search API error: ${response.status} ${response.statusText}`);
        }

        const responseText = await response.text();

        // Handle empty response
        if (!responseText || responseText.trim() === '') {
            return [];
        }

        const data: SearchPDBResponse = JSON.parse(responseText);

        // Handle case where result_set might be undefined or empty
        if (!data.result_set || data.result_set.length === 0) {
            return [];
        }

        const fetchPromises = data.result_set.map((entry) => fetchPdb(entry.identifier));
        return Promise.all(fetchPromises);
    } catch (error) {
        if (error instanceof PDBError) {
            throw error;
        }
        throw new PDBError(
            `PDB search failed: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : undefined
        );
    }
}

/**
 * Helper function to prepare the search query for PDB API.
 * 
 * This function creates a JSON query string formatted for the PDB search API.
 * It constructs a full-text search query that will return PDB entry IDs.
 * 
 * @param query - The search term to query the PDB database with
 * @returns A JSON string formatted for the PDB search API
 */
function prepareSearch(query: string): string {
    return JSON.stringify({
        "query": {
            "type": "terminal",
            "service": "full_text",
            "parameters": {
                "value": query
            }
        },
        "return_type": "entry"
    });
}

interface SearchPDBResponse {
    query_id: string;
    result_type: string;
    total_count: number;
    result_set: {
        identifier: string;
        score: number;
    }[];
}

/**
 * Interface for PDB citation data.
 */
export interface Citation {
    title?: string;
    authors?: string[];
    journal_name?: string;
    year?: number;
    doi?: string;
    pubmed_id?: string;
}

/**
 * Interface for PDB structure information.
 */
export interface StructInfo {
    title?: string;
    experimental_method?: string;
    resolution?: number;
}

/**
 * Interface for PDB entity information.
 */
export interface EntityInfo {
    description?: string;
    polymer_type?: string;
    ec_number?: string;
    sequence?: string;
    organism_scientific_name?: string;
    organism_taxid?: number;
}

/**
 * Interface for PDB API response.
 */
export interface PDBResponse {
    pdb_id: string;
    citation: Citation[];
    struct?: StructInfo;
    polymer_entities?: Record<string, EntityInfo>;
    rcsb_primary_citation?: Record<string, any>;
    rcsb_entry_info?: Record<string, any>;
}

/**
 * Error class for PDB-specific errors.
 */
export class PDBError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'PDBError';
    }
}

/**
 * Client for accessing the PDB API to fetch protein data.
 */
export class PDBClient {
    private static readonly BASE_URL = 'https://data.rcsb.org/rest/v1/core';

    /**
     * Fetch a PDB entry by its ID.
     * 
     * @param pdbId - The PDB ID to fetch (e.g., '4HHB')
     * @returns PDBResponse object with the parsed response data
     * @throws PDBError if the PDB ID is invalid or not found
     * @throws Error if the connection to the PDB server fails
     */
    async getEntryById(pdbId: string): Promise<PDBResponse> {
        // Ensure PDB ID is uppercase
        const formattedId = pdbId.toUpperCase();

        try {
            // Fetch main entry data
            const entryData = await this.fetchJson(`${PDBClient.BASE_URL}/entry/${formattedId}`);

            // Get polymer entity information
            const polymerEntities: Record<string, EntityInfo> = {};

            // If we have polymer entity IDs, fetch their details
            const entityIds = entryData?.rcsb_entry_container_identifiers?.polymer_entity_ids;
            if (entityIds && Array.isArray(entityIds)) {
                for (const entityId of entityIds) {
                    const entityData = await this.fetchJson(
                        `${PDBClient.BASE_URL}/polymer_entity/${formattedId}/${entityId}`
                    );

                    // Extract entity information
                    polymerEntities[entityId] = {
                        description: entityData?.struct?.pdbx_descriptor,
                        polymer_type: entityData?.entity_poly?.type,
                        ec_number: entityData?.rcsb_polymer_entity?.enzyme_class,
                        sequence: entityData?.entity_poly?.pdbx_seq_one_letter_code,
                        organism_scientific_name: entityData?.rcsb_polymer_entity_container_identifiers?.taxonomy_organism_scientific_name,
                        organism_taxid: entityData?.rcsb_polymer_entity_container_identifiers?.taxonomy_id,
                    };
                }
            }

            // Get citation data
            const citation: Citation[] = (entryData?.citation || []).map((c: any) => ({
                title: c.title,
                authors: c.authors,
                journal_name: c.journal_abbrev,
                year: c.year,
                doi: c.doi,
                pubmed_id: c.pdbx_database_id_PubMed,
            }));

            // Construct the PDBResponse
            const response: PDBResponse = {
                pdb_id: formattedId,
                citation,
                struct: {
                    title: entryData?.struct?.title,
                    experimental_method: entryData?.rcsb_entry_info?.experimental_method,
                    resolution: entryData?.rcsb_entry_info?.resolution_combined?.[0],
                },
                polymer_entities: polymerEntities,
                rcsb_primary_citation: entryData?.rcsb_primary_citation,
                rcsb_entry_info: entryData?.rcsb_entry_info,
            };

            return response;

        } catch (error) {
            if (error instanceof PDBError) {
                throw error;
            }
            throw new PDBError(
                `Connection to PDB server failed: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Helper method to fetch and parse JSON from a URL.
     * 
     * @param url - The URL to fetch data from
     * @returns Parsed JSON as an object
     * @throws PDBError if the request fails or returns non-200 status
     */
    private async fetchJson(url: string): Promise<any> {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new PDBError(`HTTP error ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error instanceof PDBError) {
                throw error;
            }
            throw new PDBError(
                `Failed to fetch or parse response: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            );
        }
    }
}

/**
 * Process the ID of a PDB entity.
 * 
 * Replaces special characters and initial non-alpha characters with an underscore.
 * 
 * @param name - The name to process
 * @returns Processed ID string
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
 * Fetch a PDB entry by ID (alias for fetchPdb for consistency with Python API).
 */
export const fetch_pdb = fetchPdb;
