/**
 * ChEBI fetcher for retrieving chemical entries by ID.
 * 
 * This module provides functionality to fetch chemical entity data from the
 * ChEBI database by ID and map it to the EnzymeML data model (v2).
 */

import { XMLParser } from 'fast-xml-parser';
import { SmallMolecule } from '..';

/**
 * Fetch a ChEBI entry by ID and convert it to a SmallMolecule object.
 * 
 * @param chebiId - The ChEBI ID to fetch
 * @param smallmolId - Optional custom ID for the small molecule
 * @param vesselId - The ID of the vessel to add the small molecule to
 * @returns A SmallMolecule object with data from ChEBI
 * @throws ChEBIError if the ChEBI ID is invalid or not found
 * @throws Error if the connection to the ChEBI server fails
 */
export async function fetchChebi(
    chebiId: string
): Promise<SmallMolecule> {
    const client = new ChEBIClient();
    const chebiEntity = await client.getEntryById(chebiId);

    if (!chebiEntity) {
        throw new ChEBIError(`No data found for ChEBI ID ${chebiId}`);
    }

    // Create a SmallMolecule instance
    const id = processId(chebiEntity.chebiAsciiName);

    const smallMolecule: SmallMolecule = {
        id,
        name: chebiEntity.chebiAsciiName,
        canonical_smiles: chebiEntity.smiles || null,
        inchi: chebiEntity.inchi || null,
        inchikey: chebiEntity.inchiKey || null,
        constant: false,
        vessel_id: null,
        synonymous_names: [],
        references: [
            `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${chebiEntity.chebiId}`
        ],
    };

    return smallMolecule;
}

/**
 * Interface for a ChEBI entity property.
 */
export interface PropertyModel {
    name: string;
    value: string;
}

/**
 * Interface for a ChEBI synonym.
 */
export interface SynonymModel {
    data: string;
    type: string;
    source?: string;
}

/**
 * Interface for a ChEBI chemical formula.
 */
export interface FormulaModel {
    formula: string;
    source?: string;
}

/**
 * Interface for a ChEBI structure representation.
 */
export interface StructureModel {
    type: string;
    structure: string;
    dimension?: string;
    format?: string;
}

/**
 * Interface for a ChEBI entity response.
 */
export interface ChEBIEntity {
    chebiId: string;
    chebiAsciiName: string;
    definition?: string;
    status: string;
    mass?: number;
    charge?: number;
    structure?: StructureModel;
    formula?: FormulaModel;
    inchi?: string;
    inchiKey?: string;
    smiles?: string;
    chebiIdVersion?: string;
}

/**
 * Interface for the ChEBI API response inside SOAP envelope.
 */
export interface GetEntityResponse {
    return: ChEBIEntity;
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

/**
 * Client for accessing the ChEBI API to fetch chemical entity data.
 */
export class ChEBIClient {
    private static readonly BASE_URL = 'https://www.ebi.ac.uk/webservices/chebi/2.0/test/getCompleteEntity';
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseAttributeValue: true,
            trimValues: true,
        });
    }

    /**
     * Fetch a ChEBI entry by its ID.
     * 
     * @param chebiId - The ChEBI ID to fetch, can be with or without the 'CHEBI:' prefix
     * @returns ChEBIEntity object with the parsed response data
     * @throws ChEBIError if the ChEBI ID is invalid or not found
     * @throws Error if the connection to the ChEBI server fails
     */
    async getEntryById(chebiId: string): Promise<ChEBIEntity> {
        // Ensure the CHEBI ID has the correct format
        const formattedId = chebiId.startsWith('CHEBI:') ? chebiId : `CHEBI:${chebiId}`;

        // Construct the URL
        const url = `${ChEBIClient.BASE_URL}?chebiId=${formattedId}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new ChEBIError(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const xmlText = await response.text();

            // Extract the getCompleteEntityResponse element using regex
            const match = xmlText.match(/<getCompleteEntityResponse.*?<\/getCompleteEntityResponse>/s);

            if (!match) {
                throw new ChEBIError('Could not find expected content in ChEBI response');
            }

            try {
                // Parse only the relevant XML fragment
                const parsedXml = this.parser.parse(match[0]);
                const entityResponse = this.extractEntityResponse(parsedXml);

                if (!entityResponse?.return) {
                    throw new ChEBIError(`No data found for ChEBI ID ${formattedId}`);
                }

                return entityResponse.return;
            } catch (parseError) {
                throw new ChEBIError(
                    `Failed to parse ChEBI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                    parseError instanceof Error ? parseError : undefined
                );
            }
        } catch (error) {
            if (error instanceof ChEBIError) {
                throw error;
            }
            throw new ChEBIError(
                `Connection to ChEBI server failed: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Extract the entity response from parsed XML.
     * Handles the nested structure of the SOAP response.
     */
    private extractEntityResponse(parsedXml: any): GetEntityResponse {
        // Navigate through the XML structure to find the entity data
        const response = parsedXml?.getCompleteEntityResponse;
        if (!response) {
            throw new ChEBIError('Invalid XML structure: missing getCompleteEntityResponse');
        }

        return {
            return: this.parseEntity(response.return)
        };
    }

    /**
     * Parse the entity data from the XML response.
     */
    private parseEntity(entityData: any): ChEBIEntity {
        if (!entityData) {
            throw new ChEBIError('Invalid XML structure: missing return element');
        }

        return {
            chebiId: entityData.chebiId || '',
            chebiAsciiName: entityData.chebiAsciiName || '',
            definition: entityData.definition || undefined,
            status: entityData.status || '',
            mass: entityData.mass ? parseFloat(entityData.mass) : undefined,
            charge: entityData.charge ? parseInt(entityData.charge, 10) : undefined,
            structure: entityData.structure ? this.parseStructure(entityData.structure) : undefined,
            formula: entityData.formula ? this.parseFormula(entityData.formula) : undefined,
            inchi: entityData.inchi || undefined,
            inchiKey: entityData.inchiKey || undefined,
            smiles: entityData.smiles || undefined,
            chebiIdVersion: entityData.chebiIdVersion || undefined,
        };
    }

    /**
     * Parse structure data from XML.
     */
    private parseStructure(structureData: any): StructureModel {
        return {
            type: structureData['@_type'] || '',
            structure: structureData.structure || '',
            dimension: structureData['@_dimension'] || undefined,
            format: structureData['@_format'] || undefined,
        };
    }

    /**
     * Parse formula data from XML.
     */
    private parseFormula(formulaData: any): FormulaModel {
        return {
            formula: formulaData.data || formulaData || '',
            source: formulaData['@_source'] || undefined,
        };
    }
}

/**
 * Process the ID of a ChEBI entity.
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
 * Fetch a ChEBI entry by ID (alias for fetchChebi for consistency with Python API).
 */
export const fetch_chebi = fetchChebi;
