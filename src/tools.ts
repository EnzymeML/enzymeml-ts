/**
 * Database search tools for EnzymeML.
 * 
 * This module provides tools for searching various biological and chemical databases
 * including ChEBI, PDB, and PubChem. These tools can be used with LLM function calling
 * to enable AI assistants to search for molecular and protein information.
 */

import { Tool } from "openai/resources/responses/responses";
import { searchChebi } from "./fetcher/chebi";
import { searchPdb } from "./fetcher/pdb";
import { searchPubChem } from "./fetcher/pubchem";
import { searchUniprot } from "./fetcher/uniprot";

/**
 * OpenAI function specification for the database search tool.
 * 
 * This specification defines the structure and parameters for the search_databases
 * function that can be used with OpenAI's function calling feature.
 * 
 * Supported databases:
 * - chebi: Chemical Entities of Biological Interest database
 * - pdb: Protein Data Bank
 * - pubchem: PubChem chemical database
 * - uniprot: UniProt protein database
 */
export const SearchDatabaseToolSpecs: Tool = {
    type: "function",
    name: "search_databases",
    description: "Search for specific molecular and protein information that is mentioned in the provided document. Use this tool to extract information from the databases supported by this tool. Supports ChEBI (small molecules), PDB (protein structures), and UniProt (protein sequences).",
    strict: true,
    parameters: {
        type: "object",
        properties: {
            databases: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["chebi", "pdb", "uniprot"],
                },
                description: "The database to search in. Supports ChEBI (small molecules), PDB (protein structures), and UniProt (protein sequences).",
            },
            query: {
                type: "string",
                description: "The query to search for. Use this query to search for specific molecules, proteins, or entities in the databases.",
            }
        },
        strict: true,
        required: ["databases", "query"],
        additionalProperties: false,
    }
}

/**
 * Execute a database search based on the specified parameters.
 * 
 * This function routes search queries to the appropriate database fetcher
 * based on the database parameter and returns the results as a JSON string.
 * 
 * @param database - The database to search in (chebi, pdb, pubchem)
 * @param query - The search query string
 * @returns JSON string containing the search results
 * @throws Error if the specified database is not supported
 * 
 * @example
 * ```typescript
 * // Search for glucose in ChEBI
 * const results = await SearchDatabaseTool({ database: "chebi", query: "glucose", limit: 5 });
 * console.log(results);
 * 
 * // Search for insulin in PDB
 * const proteinResults = await SearchDatabaseTool({ database: "pdb", query: "insulin", limit: 10 });
 * console.log(proteinResults);
 * ```
 */
export const SearchDatabaseTool = async (
    {
        databases,
        query,
    }: {
        databases: string[],
        query: string,
    }) => {
    let responses: any[] = [];

    for (const database of databases) {
        switch (database) {
            case "chebi":
                responses.push(await searchChebi(query, 5));
                break;
            case "pdb":
                const pdbResults = (await searchPdb(query)).slice(0, 5);
                responses.push(pdbResults);
                break;
            case "pubchem":
                responses.push(await searchPubChem(query, 5));
                break;
            case "uniprot":
                responses.push(await searchUniprot(query, 5));
                break;
            default:
                throw new Error(`Database ${database} not supported`);
        }
    }

    return responses;
}
