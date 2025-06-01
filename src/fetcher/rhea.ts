/**
 * Rhea database fetcher for retrieving reaction entries by ID.
 * 
 * This module provides functionality to fetch reaction data from the
 * Rhea database by ID and map it to the EnzymeML data model (v2).
 */

import { Reaction, ReactionElement, SmallMolecule } from '..';
import { fetchChebi } from './chebi';

/**
 * Fetch a Rhea entry by ID and convert it to a Reaction object with SmallMolecules.
 * 
 * @param rheaId - The Rhea ID to fetch, can be with or without the 'RHEA:' prefix
 * @returns A tuple containing a Reaction object and array of SmallMolecule objects
 * @throws RheaError if the Rhea ID is invalid or not found
 * @throws Error if the connection to the Rhea server fails
 */
export async function fetchRhea(
    rheaId: string,
): Promise<[Reaction, SmallMolecule[]]> {
    const client = await RheaClient.fromId(rheaId);
    const rheaIdProcessed = client.jsonContent.id;

    const equation = client.jsonContent.equation;
    const nReactants = equation.split("=")[0].split("+").length;
    const nProducts = equation.split("=")[1].split("+").length;

    const smallMolecules: SmallMolecule[] = [];
    const reactants: ReactionElement[] = [];
    const products: ReactionElement[] = [];

    // Filter out invalid ChEBI IDs first
    const validChebiIds = client.chebiIds.filter(id => id && id.trim() !== '');

    if (validChebiIds.length !== nReactants + nProducts) {
        console.warn(`Expected ${nReactants + nProducts} ChEBI IDs but got ${validChebiIds.length} valid ones`);
    }

    // Process each chemical species in the reaction
    for (let i = 0; i < validChebiIds.length; i++) {
        const chebiId = validChebiIds[i];
        const smallMolecule = await fetchChebi(chebiId);

        smallMolecules.push(smallMolecule);

        if (i < nReactants) {
            const reactionElement: ReactionElement = {
                species_id: smallMolecule.id,
                stoichiometry: 1,
            };
            reactants.push(reactionElement);
        } else {
            const reactionElement: ReactionElement = {
                species_id: smallMolecule.id,
                stoichiometry: 1,
            };
            products.push(reactionElement);
        }
    }

    const reaction: Reaction = {
        id: `RHEA:${rheaIdProcessed}`,
        name: `RHEA:${rheaIdProcessed}`,
        reactants: reactants,
        products: products,
        reversible: client.jsonContent.balanced,
        kinetic_law: null,
        modifiers: []
    };

    return [reaction, smallMolecules];
}

/**
 * Interface for Rhea database result.
 */
export interface RheaResult {
    id: string;
    equation: string;
    balanced: boolean;
    transport: boolean;
}

/**
 * Interface for Rhea database query response.
 */
export interface RheaQuery {
    count: number;
    results: RheaResult[];
}

/**
 * Interface for TSV row data from Rhea API.
 */
export interface RheaTsvRow {
    'RHEA identifier': string;
    'Equation': string;
    'ChEBI identifier': string;
}

/**
 * Error class for Rhea-specific errors.
 */
export class RheaError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'RheaError';
    }
}

/**
 * Client for Rhea database.
 * 
 * This class handles communication with the Rhea database API
 * and parses the responses into structured data.
 */
export class RheaClient {
    private static readonly BASE_URL = 'https://www.rhea-db.org/rhea/?query=RHEA:{0}&columns=rhea-id,equation,chebi-id&format={1}&limit=10';

    public jsonContent: RheaResult;
    public chebiIds: string[];

    private constructor(jsonContent: RheaResult, chebiIds: string[]) {
        this.jsonContent = jsonContent;
        this.chebiIds = chebiIds;
    }

    /**
     * Create a RheaClient instance from a Rhea ID.
     * 
     * @param rheaId - The Rhea ID to fetch, can be with or without the 'RHEA:' prefix
     * @returns A RheaClient instance with the fetched data
     * @throws RheaError if no results are found for the given Rhea ID
     */
    static async fromId(rheaId: string): Promise<RheaClient> {
        if (rheaId.startsWith("RHEA:")) {
            rheaId = rheaId.split(":")[1];
        }

        const tsvContent = await this.fetchTsv(rheaId);
        const jsonContent = await this.fetchJson(rheaId);

        if (jsonContent.results.length === 0) {
            throw new RheaError(`No results found for RHEA ID: ${rheaId}`);
        }

        // Get first row of tsv_content
        const firstRow = tsvContent[0];
        if (!firstRow) {
            throw new RheaError(`No TSV data found for RHEA ID: ${rheaId}`);
        }

        const chebiIds = firstRow['ChEBI identifier'].split(";");

        return new RheaClient(jsonContent.results[0], chebiIds);
    }

    /**
     * Fetch TSV data from the Rhea API.
     * 
     * @param query - The Rhea ID to query
     * @returns An array of parsed TSV row objects
     * @throws RheaError if the request to the Rhea API fails
     */
    private static async fetchTsv(query: string): Promise<RheaTsvRow[]> {
        const url = this.BASE_URL.replace('{0}', query).replace('{1}', 'tsv');

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new RheaError(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const tsvText = await response.text();
            return this.parseTsv(tsvText);

        } catch (error) {
            if (error instanceof RheaError) {
                throw error;
            }
            throw new RheaError(
                `Failed to fetch TSV data: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Fetch JSON data from the Rhea API.
     * 
     * @param query - The Rhea ID to query
     * @returns A RheaQuery object containing the parsed JSON response
     * @throws RheaError if the request to the Rhea API fails
     */
    private static async fetchJson(query: string): Promise<RheaQuery> {
        const url = this.BASE_URL.replace('{0}', query).replace('{1}', 'json');

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new RheaError(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const jsonData = await response.json();
            return jsonData as RheaQuery;

        } catch (error) {
            if (error instanceof RheaError) {
                throw error;
            }
            throw new RheaError(
                `Failed to fetch JSON data: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Parse TSV text into an array of row objects.
     * 
     * @param tsvText - The raw TSV text
     * @returns An array of parsed row objects
     */
    private static parseTsv(tsvText: string): RheaTsvRow[] {
        const lines = tsvText.trim().split('\n');
        if (lines.length < 2) {
            throw new RheaError('Invalid TSV format: insufficient lines');
        }

        const headers = lines[0].split('\t');
        const rows: RheaTsvRow[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split('\t');
            const row: any = {};

            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = values[j] || '';
            }

            rows.push(row as RheaTsvRow);
        }

        return rows;
    }
}

/**
 * Fetch a Rhea entry by ID (alias for fetchRhea for consistency with Python API).
 */
export const fetch_rhea = fetchRhea;
