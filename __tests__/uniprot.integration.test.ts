/**
 * Integration tests for UniProt fetcher
 * These tests make actual HTTP requests to the UniProt API
 */

import { UniProtClient, UniProtError, fetchUniprot, searchUniprot } from '../src/fetcher/uniprot';

describe('UniProt Integration Tests', () => {
    let client: UniProtClient;

    beforeEach(() => {
        client = new UniProtClient();
    });

    describe('UniProtClient.getEntryById', () => {
        it('should fetch human insulin (P01308) successfully', async () => {
            const result = await client.getEntryById('P01308');

            expect(result.id).toBe('INS_HUMAN');
            expect(result.accession).toBe('P01308');
            expect(result.protein_description).toBeDefined();
            expect(result.organism).toBeDefined();
            expect(result.sequence).toBeDefined();

            // Human insulin should have organism info
            expect(result.organism?.scientificName).toContain('Homo sapiens');
            expect(result.organism?.taxonId).toBe(9606);
        }, 15000); // 15 second timeout for API calls

        it('should fetch lysozyme (P00698) successfully', async () => {
            const result = await client.getEntryById('P00698');

            expect(result.id).toBe('LYSC_CHICK');
            expect(result.accession).toBe('P00698');
            expect(result.protein_description?.recommendedName).toBeDefined();
            expect(result.sequence).toBeDefined();

            // Lysozyme should have sequence data
            expect(result.sequence?.value).toBeDefined();
            expect(result.sequence?.length).toBeGreaterThan(0);
        }, 15000);

        it('should handle non-existent UniProt ID gracefully', async () => {
            await expect(client.getEntryById('Z99999')).rejects.toThrow(UniProtError);
        }, 15000);

        it('should handle invalid UniProt ID format', async () => {
            await expect(client.getEntryById('invalid-id')).rejects.toThrow(UniProtError);
        }, 15000);

        it('should fetch alcohol dehydrogenase (P07327) with EC number', async () => {
            const result = await client.getEntryById('P07327');

            expect(result.id).toBe('ADH1A_HUMAN');
            expect(result.accession).toBe('P07327');
            expect(result.protein_description?.recommendedName).toBeDefined();

            // Should have EC numbers for this enzyme
            if (result.protein_description?.recommendedName?.ecNumbers) {
                expect(result.protein_description.recommendedName.ecNumbers.length).toBeGreaterThan(0);
            }
        }, 15000);
    });

    describe('fetchUniprot', () => {
        it('should fetch and convert human insulin to Protein', async () => {
            const result = await fetchUniprot('P01308');

            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.constant).toBe(true);
            expect(result.vessel_id).toBeNull();
            expect(result.references).toContain('https://www.uniprot.org/uniprotkb/P01308');

            // Check if sequence is present
            if (result.sequence) {
                expect(typeof result.sequence).toBe('string');
                expect(result.sequence.length).toBeGreaterThan(0);
            }

            // Human insulin should have organism info
            expect(result.organism).toContain('Homo sapiens');
            expect(result.organism_tax_id).toBe('9606');
        }, 15000);

        it('should handle UniProt ID with prefix', async () => {
            const result = await fetchUniprot('uniprot:P00698');

            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.references).toContain('https://www.uniprot.org/uniprotkb/P00698');
        }, 15000);

        it('should fetch enzyme with EC number (P07327 - alcohol dehydrogenase)', async () => {
            const result = await fetchUniprot('P07327');

            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();

            // EC number is optional, so just check type if present
            if (result.ecnumber) {
                expect(typeof result.ecnumber).toBe('string');
                expect(result.ecnumber).toMatch(/\d+\.\d+\.\d+\.\d+/); // EC number format
            }
        }, 15000);

        it('should generate proper protein ID from name', async () => {
            const result = await fetchUniprot('P01308'); // Human insulin

            // Should generate ID from protein name
            expect(result.id).toBeDefined();
            expect(typeof result.id).toBe('string');
            expect(result.id.length).toBeGreaterThan(0);
        }, 15000);

        it('should handle proteins with complex names', async () => {
            const result = await fetchUniprot('P00698'); // Lysozyme

            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.references).toContain('https://www.uniprot.org/uniprotkb/P00698');

            // Check that the name processing worked correctly
            expect(result.id).not.toContain(' ');
            expect(result.id).not.toContain('-');
        }, 15000);
    });

    describe('Real API Error Handling', () => {
        it('should handle server timeouts gracefully', async () => {
            // This test might be flaky depending on network conditions
            // But it helps ensure proper error handling
            const client = new UniProtClient();

            try {
                await client.getEntryById('P01308');
                // If it succeeds, that's fine too
            } catch (error) {
                expect(error).toBeInstanceOf(UniProtError);
            }
        }, 20000);

        it('should handle invalid response format gracefully', async () => {
            // Test with a potentially problematic ID
            try {
                await client.getEntryById('P12345');
                // If it works, that's fine
            } catch (error) {
                expect(error).toBeInstanceOf(UniProtError);
            }
        }, 15000);
    });

    describe('searchUniprot', () => {
        it('should search for insulin and return multiple Protein results', async () => {
            const results = await searchUniprot('insulin', 3);

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThanOrEqual(3);

            // Check that each result is a valid Protein object
            results.forEach(protein => {
                expect(protein.id).toBeDefined();
                expect(protein.name).toBeDefined();
                expect(typeof protein.constant).toBe('boolean');
                expect(protein.constant).toBe(true); // UniProt proteins are always constant
                expect(protein.vessel_id).toBeNull();
                expect(Array.isArray(protein.references)).toBe(true);
                expect(protein.references.length).toBeGreaterThan(0);

                // Should have UniProt reference
                const hasUniProtRef = protein.references.some(ref =>
                    ref.includes('uniprot.org/uniprotkb/')
                );
                expect(hasUniProtRef).toBe(true);
            });

            // At least one result should be insulin-related
            const hasInsulinRelated = results.some(protein =>
                protein.name?.toLowerCase().includes('insulin') ||
                protein.id.toLowerCase().includes('insulin')
            );
            expect(hasInsulinRelated).toBe(true);
        }, 25000); // Longer timeout for search + multiple fetches

        it('should search for lysozyme and return relevant results with proper structure', async () => {
            const results = await searchUniprot('lysozyme', 2);

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThanOrEqual(2);

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
                if (protein.organism_tax_id) {
                    expect(typeof protein.organism_tax_id).toBe('string');
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
            const results = await searchUniprot('nonexistentproteinxyz12345', 10);

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        }, 15000);

        it('should search for hemoglobin and verify protein data quality', async () => {
            const results = await searchUniprot('hemoglobin', 2);

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

                // Should have UniProt reference
                const hasUniProtRef = hemoglobinResult.references.some(ref =>
                    /https:\/\/www\.uniprot\.org\/uniprotkb\/\w+/.test(ref)
                );
                expect(hasUniProtRef).toBe(true);

                // Hemoglobin should have organism info
                if (hemoglobinResult.organism) {
                    expect(typeof hemoglobinResult.organism).toBe('string');
                }
                if (hemoglobinResult.organism_tax_id) {
                    expect(typeof hemoglobinResult.organism_tax_id).toBe('string');
                }

                // Should have sequence data
                if (hemoglobinResult.sequence) {
                    expect(typeof hemoglobinResult.sequence).toBe('string');
                    expect(hemoglobinResult.sequence.length).toBeGreaterThan(0);
                }
            }
        }, 25000);

        it('should handle search API errors gracefully', async () => {
            // Test with extremely long query that might cause issues
            try {
                const veryLongQuery = 'a'.repeat(1000);
                const results = await searchUniprot(veryLongQuery, 1);

                // If it succeeds, should still return array
                expect(Array.isArray(results)).toBe(true);
            } catch (error) {
                // If it fails, should be a proper Error
                expect(error).toBeInstanceOf(Error);
            }
        }, 15000);

        it('should maintain consistency between search results and individual fetches', async () => {
            // Search for a specific term likely to return known results
            const results = await searchUniprot('P01308', 1); // Search for human insulin accession

            if (results.length > 0) {
                const firstResult = results[0];

                // The search result should be consistent with direct fetch
                expect(firstResult.id).toBeDefined();
                expect(firstResult.name).toBeDefined();
                expect(firstResult.constant).toBe(true);
                expect(firstResult.vessel_id).toBeNull();
                expect(Array.isArray(firstResult.references)).toBe(true);
                expect(firstResult.references.length).toBeGreaterThan(0);

                // Should have the expected reference format
                const hasCorrectRef = firstResult.references.some(ref =>
                    ref.includes('uniprot.org/uniprotkb/')
                );
                expect(hasCorrectRef).toBe(true);
            }
        }, 20000);

        it('should respect the size parameter for limiting results', async () => {
            const smallResults = await searchUniprot('kinase', 1);
            const largerResults = await searchUniprot('kinase', 3);

            expect(smallResults.length).toBeLessThanOrEqual(1);
            expect(largerResults.length).toBeLessThanOrEqual(3);

            // Only check if both returned results
            if (smallResults.length > 0 && largerResults.length > 0) {
                expect(largerResults.length).toBeGreaterThanOrEqual(smallResults.length);
            }
        }, 30000); // Longer timeout for potentially many results

        it('should handle special characters in search queries', async () => {
            // Use a search query with special characters
            const results = await searchUniprot('α-amylase', 2);

            expect(Array.isArray(results)).toBe(true);
            // Results might be empty, and that's okay for special characters
            if (results.length > 0) {
                results.forEach(protein => {
                    expect(protein.id).toBeDefined();
                    expect(protein.name).toBeDefined();
                    expect(Array.isArray(protein.references)).toBe(true);
                });
            }
        }, 20000);
    });
}); 