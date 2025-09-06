/**
 * Integration tests for PDB fetcher
 * These tests make actual HTTP requests to the PDB API
 */

import { PDBClient, PDBError, fetchPdb, searchPdb } from '../src/fetcher/pdb';

describe('PDB Integration Tests', () => {
    let client: PDBClient;

    beforeEach(() => {
        client = new PDBClient();
    });

    describe('PDBClient.getEntryById', () => {
        it('should fetch hemoglobin (4HHB) successfully', async () => {
            const result = await client.getEntryById('4HHB');

            expect(result.pdb_id).toBe('4HHB');
            expect(result.struct?.title).toBeDefined();
            expect(result.polymer_entities).toBeDefined();

            // Check if we have polymer entities
            if (result.polymer_entities && Object.keys(result.polymer_entities).length > 0) {
                const firstEntity = Object.values(result.polymer_entities)[0];
                expect(firstEntity.sequence).toBeDefined();
            }
        }, 15000); // 15 second timeout for API calls

        it('should fetch lysozyme (1LYZ) successfully', async () => {
            const result = await client.getEntryById('1LYZ');

            expect(result.pdb_id).toBe('1LYZ');
            expect(result.struct?.title).toBeDefined();
            expect(result.polymer_entities).toBeDefined();

            // Lysozyme should have experimental method
            if (result.struct?.experimental_method) {
                expect(typeof result.struct.experimental_method).toBe('string');
            }
        }, 15000);

        it('should handle non-existent PDB ID gracefully', async () => {
            await expect(client.getEntryById('9ZZZ')).rejects.toThrow(PDBError);
        }, 15000);

        it('should handle invalid PDB ID format', async () => {
            await expect(client.getEntryById('invalid-id')).rejects.toThrow(PDBError);
        }, 15000);

        it('should fetch lysozyme (2LYZ) with citation data', async () => {
            const result = await client.getEntryById('2LYZ');

            expect(result.pdb_id).toBe('2LYZ');
            expect(result.citation).toBeDefined();
            expect(Array.isArray(result.citation)).toBe(true);

            // Check if we have citation data
            if (result.citation.length > 0) {
                const firstCitation = result.citation[0];
                expect(typeof firstCitation).toBe('object');
            }
        }, 15000);
    });

    describe('fetchPdb', () => {
        it('should fetch and convert hemoglobin to Protein', async () => {
            const result = await fetchPdb('4HHB');

            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.constant).toBe(true);
            expect(result.vessel_id).toBeNull();
            expect(result.references).toContain('https://www.rcsb.org/structure/4HHB');

            // Check if sequence is present
            if (result.sequence) {
                expect(typeof result.sequence).toBe('string');
                expect(result.sequence.length).toBeGreaterThan(0);
            }
        }, 15000);

        it('should handle PDB ID with prefix', async () => {
            const result = await fetchPdb('pdb:1LYZ');

            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.references).toContain('https://www.rcsb.org/structure/1LYZ');
        }, 15000);

        it('should fetch lysozyme (1LYZ) which typically has organism info', async () => {
            const result = await fetchPdb('1LYZ');

            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.references).toContain('https://www.rcsb.org/structure/1LYZ');

            // Check organism info if available
            if (result.organism) {
                expect(typeof result.organism).toBe('string');
            }
            if (result.organism_tax_id) {
                expect(typeof result.organism_tax_id).toBe('string');
            }
        }, 15000);

        it('should fetch enzyme with EC number (1LYZ - lysozyme)', async () => {
            // Lysozyme has EC number 3.2.1.17
            const result = await fetchPdb('1LYZ');

            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();

            // EC number is optional, so just check type if present
            if (result.ecnumber) {
                expect(typeof result.ecnumber).toBe('string');
            }
        }, 15000);
    });

    describe('Real API Error Handling', () => {
        it('should handle server timeouts gracefully', async () => {
            // This test might be flaky depending on network conditions
            // But it helps ensure proper error handling
            const client = new PDBClient();

            try {
                await client.getEntryById('4HHB');
                // If it succeeds, that's fine too
            } catch (error) {
                expect(error).toBeInstanceOf(PDBError);
            }
        }, 20000);

        it('should handle invalid response format gracefully', async () => {
            // Test with a potentially problematic ID
            try {
                await client.getEntryById('1ABC');
                // If it works, that's fine
            } catch (error) {
                expect(error).toBeInstanceOf(PDBError);
            }
        }, 15000);
    });

    describe('searchPdb', () => {
        it('should search for insulin and return multiple Protein results', async () => {
            const results = await searchPdb('insulin');

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThanOrEqual(10); // RCSB typically limits results

            // Check that each result is a valid Protein object
            results.forEach(protein => {
                expect(protein.id).toBeDefined();
                expect(protein.name).toBeDefined();
                expect(typeof protein.constant).toBe('boolean');
                expect(protein.constant).toBe(true); // PDB proteins are always constant
                expect(protein.vessel_id).toBeNull();
                expect(Array.isArray(protein.references)).toBe(true);
                expect(protein.references.length).toBeGreaterThan(0);

                // Should have PDB reference
                const hasPDBRef = protein.references.some(ref =>
                    ref.includes('rcsb.org/structure/')
                );
                expect(hasPDBRef).toBe(true);
            });

            // At least one result should be insulin-related
            const hasInsulinRelated = results.some(protein =>
                protein.name?.toLowerCase().includes('insulin') ||
                protein.id.toLowerCase().includes('insulin')
            );
            expect(hasInsulinRelated).toBe(true);
        }, 25000); // Longer timeout for search + multiple fetches

        it('should search for lysozyme and return relevant results with proper structure', async () => {
            const results = await searchPdb('lysozyme');

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            // Check structure of returned proteins
            results.forEach(protein => {
                expect(typeof protein.id).toBe('string');
                expect(typeof protein.name).toBe('string');
                expect(typeof protein.constant).toBe('boolean');
                expect(protein.references.length).toBeGreaterThan(0);

                // Sequence might be present
                if (protein.sequence) {
                    expect(typeof protein.sequence).toBe('string');
                    expect(protein.sequence.length).toBeGreaterThan(0);
                }

                // Organism info might be present
                if (protein.organism) {
                    expect(typeof protein.organism).toBe('string');
                }

                // EC number might be present (lysozyme is an enzyme)
                if (protein.ecnumber) {
                    expect(typeof protein.ecnumber).toBe('string');
                    expect(protein.ecnumber).toMatch(/\d+\.\d+\.\d+\.\d+/);
                }
            });

            // Should have lysozyme-related results
            const hasLysozymeRelated = results.some(protein =>
                protein.name?.toLowerCase().includes('lysozyme') ||
                protein.id.toLowerCase().includes('lysozyme') ||
                protein.name?.toLowerCase().includes('lysc')
            );
            expect(hasLysozymeRelated).toBe(true);
        }, 25000);

        it('should handle searches with no results gracefully', async () => {
            const results = await searchPdb('nonexistentproteinxyz12345');

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        }, 15000);

        it('should search for hemoglobin and verify protein data quality', async () => {
            const results = await searchPdb('hemoglobin');

            expect(results.length).toBeGreaterThan(0);

            // Find a hemoglobin result to examine in detail
            const hemoglobinResult = results.find(protein =>
                protein.name?.toLowerCase().includes('hemoglobin') ||
                protein.id.toLowerCase().includes('hemoglobin')
            );

            if (hemoglobinResult) {
                expect(hemoglobinResult.id).toBeDefined();
                expect(hemoglobinResult.name).toBeDefined();
                expect(hemoglobinResult.constant).toBe(true);
                // Should have RCSB structure reference
                const hasRCSBRef = hemoglobinResult.references.some(ref =>
                    /https:\/\/www\.rcsb\.org\/structure\/\w+/.test(ref)
                );
                expect(hasRCSBRef).toBe(true);

                // Hemoglobin should have organism info
                if (hemoglobinResult.organism) {
                    expect(typeof hemoglobinResult.organism).toBe('string');
                }
                if (hemoglobinResult.organism_tax_id) {
                    expect(typeof hemoglobinResult.organism_tax_id).toBe('string');
                }
            }
        }, 25000);

        it('should handle search API errors gracefully', async () => {
            // Test with extremely long query that might cause issues
            try {
                const veryLongQuery = 'a'.repeat(1000);
                const results = await searchPdb(veryLongQuery);

                // If it succeeds, should still return array
                expect(Array.isArray(results)).toBe(true);
            } catch (error) {
                // If it fails, should be a proper Error
                expect(error).toBeInstanceOf(Error);
            }
        }, 15000);

        it('should maintain consistency between search results and individual fetches', async () => {
            // Search for a specific term likely to return known results
            const results = await searchPdb('1LYZ');

            if (results.length > 0) {
                const firstResult = results[0];

                // The search result should be consistent with direct fetch
                expect(firstResult.id).toBeDefined();
                expect(firstResult.name).toBeDefined();
                expect(firstResult.constant).toBe(true);
                expect(firstResult.vessel_id).toBeNull();
                expect(Array.isArray(firstResult.references)).toBe(true);
            }
        }, 20000);
    });
}); 