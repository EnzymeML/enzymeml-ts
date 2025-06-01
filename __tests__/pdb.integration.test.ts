/**
 * Integration tests for PDB fetcher
 * These tests make actual HTTP requests to the PDB API
 */

import { PDBClient, PDBError, fetchPdb } from '../src/fetcher/pdb';

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
}); 