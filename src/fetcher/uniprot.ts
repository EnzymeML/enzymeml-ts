/**
 * UniProt fetcher for retrieving protein entries by ID.
 * 
 * This module provides functionality to fetch protein data from the
 * UniProt database by ID and map it to the EnzymeML data model (v2).
 */

import { Protein } from '..';

/**
 * Fetch a UniProt entry by ID and convert it to a Protein object.
 * 
 * @param uniprotId - The UniProt ID to fetch
 * @param proteinId - Optional custom ID for the protein (derived from UniProt if not provided)
 * @param vesselId - The ID of the vessel to add the protein to
 * @returns A Protein object with data from UniProt
 * @throws UniProtError if the UniProt ID is invalid or not found
 * @throws Error if the connection to the UniProt server fails
 */
export async function fetchUniprot(
    uniprotId: string
): Promise<Protein> {
    const client = new UniProtClient();

    // Allow prefixing with 'uniprot:'
    if (uniprotId.toLowerCase().startsWith("uniprot:")) {
        uniprotId = uniprotId.split(":", 2)[1];
    }

    const uniprotEntry = await client.getEntryById(uniprotId);

    if (!uniprotEntry) {
        throw new UniProtError(`No data found for UniProt ID ${uniprotId}`);
    }

    // Extract protein name
    let name = uniprotId;
    if (uniprotEntry.protein_description?.recommendedName?.fullName?.value) {
        name = uniprotEntry.protein_description.recommendedName.fullName.value;
    }

    // Extract sequence if available
    const sequence = uniprotEntry.sequence?.value || null;

    // Extract organism data
    const organism = uniprotEntry.organism?.scientificName || null;
    const organism_tax_id = uniprotEntry.organism?.taxonId ? String(uniprotEntry.organism.taxonId) : null;

    // Extract EC number
    let ecnumber: string | null = null;
    if (uniprotEntry.protein_description?.recommendedName?.ecNumbers &&
        uniprotEntry.protein_description.recommendedName.ecNumbers.length > 0) {
        ecnumber = uniprotEntry.protein_description.recommendedName.ecNumbers[0].value;
    }

    // Generate protein_id if not provided
    const finalProteinId =
        (uniprotEntry.protein_description?.recommendedName?.fullName?.value
            ? processId(uniprotEntry.protein_description.recommendedName.fullName.value)
            : uniprotEntry.accession);

    // Create Protein instance
    const protein: Protein = {
        id: finalProteinId,
        name: name,
        sequence: sequence,
        organism: organism,
        organism_tax_id: organism_tax_id,
        ecnumber: ecnumber,
        constant: true,
        vessel_id: null,
        references: []
    };

    // Add full link as reference
    protein.references.push(`https://www.uniprot.org/uniprotkb/${uniprotEntry.accession}`);

    return protein;
}

/**
 * Interface for EC number in UniProt API.
 */
export interface ECNumber {
    value: string;
}

/**
 * Interface for protein name in UniProt API.
 */
export interface ProteinName {
    value: string;
}

/**
 * Interface for recommended protein name in UniProt API.
 */
export interface RecommendedName {
    fullName?: ProteinName;
    ecNumbers?: ECNumber[];
}

/**
 * Interface for protein description in UniProt API.
 */
export interface ProteinDescription {
    recommendedName?: RecommendedName;
}

/**
 * Interface for organism in UniProt API.
 */
export interface Organism {
    scientificName?: string;
    taxonId?: number;
}

/**
 * Interface for protein sequence in UniProt API.
 */
export interface Sequence {
    value: string;
    length: number;
    molWeight?: number;
}

/**
 * Interface for UniProt entry response.
 */
export interface UniProtEntry {
    uniProtkbId: string;
    proteinDescription?: ProteinDescription;
    organism?: Organism;
    sequence?: Sequence;
    primaryAccession: string;
    annotationScore?: number;
}

/**
 * Processed UniProt entry with simplified field names.
 */
export interface ProcessedUniProtEntry {
    id: string;
    protein_description?: ProteinDescription;
    organism?: Organism;
    sequence?: Sequence;
    accession: string;
    annotation_score?: number;
}

/**
 * Error class for UniProt-specific errors.
 */
export class UniProtError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'UniProtError';
    }
}

/**
 * Client for accessing the UniProt API to fetch protein data.
 */
export class UniProtClient {
    private static readonly BASE_URL = 'https://rest.uniprot.org/uniprotkb';

    /**
     * Fetch a UniProt entry by its ID.
     * 
     * @param uniprotId - The UniProt ID to fetch
     * @returns ProcessedUniProtEntry object with the parsed response data
     * @throws UniProtError if the UniProt ID is invalid or not found
     * @throws Error if the connection to the UniProt server fails
     */
    async getEntryById(uniprotId: string): Promise<ProcessedUniProtEntry> {
        // Construct the URL
        const url = `${UniProtClient.BASE_URL}/${uniprotId}.json`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new UniProtError(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const data: UniProtEntry = await response.json();

            // Convert to processed format with simplified field names
            const processedEntry: ProcessedUniProtEntry = {
                id: data.uniProtkbId,
                protein_description: data.proteinDescription,
                organism: data.organism,
                sequence: data.sequence,
                accession: data.primaryAccession,
                annotation_score: data.annotationScore
            };

            return processedEntry;

        } catch (error) {
            if (error instanceof UniProtError) {
                throw error;
            }
            throw new UniProtError(
                `Connection to UniProt server failed: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            );
        }
    }
}

/**
 * Process the ID of a UniProt entity.
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
 * Fetch a UniProt entry by ID (alias for fetchUniprot for consistency with Python API).
 */
export const fetch_uniprot = fetchUniprot;
