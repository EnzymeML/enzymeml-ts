/**
 * Database search tools for EnzymeML.
 * 
 * This module provides tools for searching various biological and chemical databases
 * including ChEBI, PDB, PubChem, and UniProt. These tools can be used with LLM function calling
 * to enable AI assistants to search for molecular and protein information.
 */

import { FunctionTool } from "openai/resources/responses/responses";
import { searchChebi } from "./fetcher/chebi";
import { searchPdb } from "./fetcher/pdb";
import { searchPubChem } from "./fetcher/pubchem";
import { searchUniprot } from "./fetcher/uniprot";
import { Protein, SmallMolecule } from "./v2";
import { ToolDefinition } from "./llm";

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
const SearchDatabaseToolSpecs: FunctionTool = {
    type: "function",
    name: "search_databases",
    description: "Search for specific molecular and protein information that is mentioned in the provided document. Use this tool to extract information from the databases supported by this tool. Supports ChEBI (small molecules), PDB (protein structures), PubChem (chemical database), and UniProt (protein sequences).",
    strict: true,
    parameters: {
        type: "object",
        properties: {
            databases: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["chebi", "pdb", "pubchem", "uniprot"],
                },
                description: "The databases to search in. Supports ChEBI (small molecules), PDB (protein structures), PubChem (chemical database), and UniProt (protein sequences).",
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
 * Execute database searches based on the specified parameters.
 * 
 * This function routes search queries to the appropriate database fetchers
 * based on the databases parameter and returns the combined results as an array.
 * Each database is searched with a limit of 5 results.
 * 
 * @param databases - Array of databases to search in (chebi, pdb, pubchem, uniprot)
 * @param query - The search query string
 * @returns Array containing the search results from all specified databases
 * @throws Error if any of the specified databases is not supported
 * 
 * @example
 * ```typescript
 * // Search for glucose in ChEBI and PubChem
 * const results = await SearchDatabaseTool({ 
 *   databases: ["chebi", "pubchem"], 
 *   query: "glucose" 
 * });
 * console.log(results);
 * 
 * // Search for insulin in PDB and UniProt
 * const proteinResults = await SearchDatabaseTool({ 
 *   databases: ["pdb", "uniprot"], 
 *   query: "insulin" 
 * });
 * console.log(proteinResults);
 * ```
 */
const SearchDatabaseToolFunction = async (
    {
        databases,
        query,
    }: {
        databases: string[],
        query: string,
    }): Promise<(SmallMolecule | Protein)[]> => {
    let responses: (SmallMolecule | Protein)[] = [];

    for (const database of databases) {
        switch (database) {
            case "chebi":
                responses.push(...await searchChebi(query, 5));
                break;
            case "pdb":
                const pdbResults = (await searchPdb(query)).slice(0, 5);
                responses.push(...pdbResults);
                break;
            case "pubchem":
                responses.push(...await searchPubChem(query, 5));
                break;
            case "uniprot":
                responses.push(...await searchUniprot(query, 5));
                break;
            default:
                throw new Error(`Database ${database} not supported`);
        }
    }

    return responses;
}

export const SearchDatabaseTool: ToolDefinition = {
    specs: SearchDatabaseToolSpecs,
    fun: SearchDatabaseToolFunction,
}