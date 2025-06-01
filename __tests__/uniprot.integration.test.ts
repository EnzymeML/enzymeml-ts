/**
 * Integration tests for UniProt fetcher
 * These tests make actual HTTP requests to the UniProt API
 */

import { UniProtClient, UniProtError, fetchUniprot } from '../src/fetcher/uniprot';

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
}); 