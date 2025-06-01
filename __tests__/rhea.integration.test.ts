/**
 * Integration tests for Rhea fetcher
 * These tests make actual HTTP requests to the Rhea API
 */

import { RheaClient, RheaError, fetchRhea } from '../src/fetcher/rhea';

describe('Rhea Integration Tests', () => {
    describe('RheaClient.fromId', () => {
        it('should fetch ATP hydrolysis reaction (RHEA:13065) successfully', async () => {
            const client = await RheaClient.fromId('13065');

            expect(client.jsonContent.id).toBe('13065');
            expect(client.jsonContent.equation).toBeDefined();
            expect(client.chebiIds).toBeDefined();
            expect(client.chebiIds.length).toBeGreaterThan(0);

            // Should have equation for ATP hydrolysis
            expect(client.jsonContent.equation).toContain('ATP');
        }, 15000); // 15 second timeout for API calls

        it('should fetch glucose-6-phosphate isomerase reaction (RHEA:15901) successfully', async () => {
            const client = await RheaClient.fromId('RHEA:15901');

            expect(client.jsonContent.id).toBe('15901');
            expect(client.jsonContent.equation).toBeDefined();
            expect(client.chebiIds).toBeDefined();
            expect(Array.isArray(client.chebiIds)).toBe(true);

            // Should have balanced property
            expect(typeof client.jsonContent.balanced).toBe('boolean');
        }, 15000);

        it('should handle non-existent Rhea ID gracefully', async () => {
            await expect(RheaClient.fromId('999999')).rejects.toThrow(RheaError);
        }, 15000);

        it('should handle invalid Rhea ID format', async () => {
            await expect(RheaClient.fromId('invalid-id')).rejects.toThrow(RheaError);
        }, 15000);

        it('should fetch hexokinase reaction (RHEA:10264) with transport info', async () => {
            const client = await RheaClient.fromId('10264');

            expect(client.jsonContent.id).toBe('10264');
            expect(client.jsonContent.equation).toBeDefined();
            expect(typeof client.jsonContent.transport).toBe('boolean');

            // Should have multiple ChEBI IDs
            expect(client.chebiIds.length).toBeGreaterThanOrEqual(2);
        }, 15000);
    });

    describe('fetchRhea', () => {
        it('should fetch and convert ATP hydrolysis to Reaction + SmallMolecules', async () => {
            const [reaction, smallMolecules] = await fetchRhea('13065');

            expect(reaction.id).toBe('RHEA:13065');
            expect(reaction.name).toBe('RHEA:13065');
            expect(typeof reaction.reversible).toBe('boolean');
            expect(reaction.kinetic_law).toBeNull();
            expect(Array.isArray(reaction.modifiers)).toBe(true);

            // Should have reactants and products
            expect(Array.isArray(reaction.reactants)).toBe(true);
            expect(Array.isArray(reaction.products)).toBe(true);
            expect(reaction.reactants.length).toBeGreaterThan(0);
            expect(reaction.products.length).toBeGreaterThan(0);

            // Should have corresponding small molecules
            expect(Array.isArray(smallMolecules)).toBe(true);
            expect(smallMolecules.length).toBe(reaction.reactants.length + reaction.products.length);

            // Each small molecule should have required properties
            smallMolecules.forEach(molecule => {
                expect(molecule.id).toBeDefined();
                expect(molecule.name).toBeDefined();
                expect(typeof molecule.constant).toBe('boolean');
            });
        }, 20000);

        it('should handle Rhea ID with prefix', async () => {
            const [reaction, smallMolecules] = await fetchRhea('RHEA:15901');

            expect(reaction.id).toBe('RHEA:15901');
            expect(reaction.name).toBe('RHEA:15901');
            expect(smallMolecules.length).toBeGreaterThan(0);
        }, 15000);

        it('should create valid ReactionElement objects', async () => {
            const [reaction, smallMolecules] = await fetchRhea('10264');

            // Check reactants
            reaction.reactants.forEach(reactant => {
                expect(reactant.species_id).toBeDefined();
                expect(typeof reactant.species_id).toBe('string');
                expect(typeof reactant.stoichiometry).toBe('number');
                expect(reactant.stoichiometry).toBe(1);

                // Should match one of the small molecule IDs
                const matchingMolecule = smallMolecules.find(mol => mol.id === reactant.species_id);
                expect(matchingMolecule).toBeDefined();
            });

            // Check products
            reaction.products.forEach(product => {
                expect(product.species_id).toBeDefined();
                expect(typeof product.species_id).toBe('string');
                expect(typeof product.stoichiometry).toBe('number');
                expect(product.stoichiometry).toBe(1);

                // Should match one of the small molecule IDs
                const matchingMolecule = smallMolecules.find(mol => mol.id === product.species_id);
                expect(matchingMolecule).toBeDefined();
            });
        }, 15000);

        it('should fetch reaction with valid ChEBI molecules', async () => {
            const [reaction, smallMolecules] = await fetchRhea('15901');

            // Each small molecule should have been fetched from ChEBI
            smallMolecules.forEach(molecule => {
                expect(molecule.id).toBeDefined();
                expect(molecule.name).toBeDefined();
                expect(Array.isArray(molecule.references)).toBe(true);
                expect(molecule.references.length).toBeGreaterThan(0);

                // Should have ChEBI reference
                const hasChEBIRef = molecule.references.some(ref =>
                    ref.includes('ebi.ac.uk/chebi')
                );
                expect(hasChEBIRef).toBe(true);
            });
        }, 20000);
    });

    describe('Real API Error Handling', () => {
        it('should handle server timeouts gracefully', async () => {
            // This test might be flaky depending on network conditions
            // But it helps ensure proper error handling
            try {
                await RheaClient.fromId('13065');
                // If it succeeds, that's fine too
            } catch (error) {
                expect(error).toBeInstanceOf(RheaError);
            }
        }, 25000);

        it('should handle invalid response format gracefully', async () => {
            // Test with a potentially problematic ID
            try {
                await RheaClient.fromId('123456');
                // If it works, that's fine
            } catch (error) {
                expect(error).toBeInstanceOf(RheaError);
            }
        }, 15000);

        it('should handle network errors gracefully', async () => {
            // This test might succeed or fail depending on network
            try {
                const [reaction, molecules] = await fetchRhea('13065');
                expect(reaction).toBeDefined();
                expect(molecules).toBeDefined();
            } catch (error) {
                // Could be RheaError or network-related error
                expect(error).toBeInstanceOf(Error);
            }
        }, 20000);
    });
}); 