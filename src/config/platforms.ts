/**
 * Marketplace platforms a cell (ProductListing) can belong to.
 *
 * **Use**: the platform select options of the margin presets and the repricing filters
 * **Location**: src/config/platforms.ts
 * **History**: before 2609_24 the legacy register form (register/components/ProductListingForm.tsx:9)
 *          owned it. That screen went away and the list was promoted to config.
 *
 * ⚠️ COUPANG is the only platform with a listing / sync adapter. ELEVENST is here so an 11st margin preset
 *    can be created (FEATURE_2610_10 / D18); it has no listing / sync adapter yet. GMARKET · AUCTION ·
 *    SMARTSTORE are screen options only — registration and sync do not work for them. Check the adapter
 *    before adding a value.
 */
export const PLATFORMS = ['COUPANG', 'GMARKET', 'AUCTION', 'SMARTSTORE', 'ELEVENST'];
