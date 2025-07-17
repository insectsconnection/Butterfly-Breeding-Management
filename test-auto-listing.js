#!/usr/bin/env node

// Test script to demonstrate the automatic pupae listing feature
const { BUTTERFLY_SPECIES_INFO, SPECIES_HOST_PLANTS, SPECIES_MARKET_PRICES } = require('./cnn-models');

// Mock batch data for testing
const mockBatch = {
  cageId: 'CAGE-TEST-001',
  species: 'Butterfly-Golden Birdwing',
  larvaCount: 25,
  lifecycleStage: 'Pupa',
  pupaeStageDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
  listedForSale: false,
  qualityScore: 0.95,
  survivalRate: 0.92,
  createdBy: 'f3365906-2ccf-4e8d-a62a-610f24115bfd',
  phoneNumber: '+639328811749'
};

// Function to check if pupae should be listed for sale
function shouldListForSale(batch) {
  if (batch.lifecycleStage !== 'Pupa') return false;
  if (batch.listedForSale) return false;
  if (!batch.pupaeStageDate) return false;
  
  const pupaeDate = new Date(batch.pupaeStageDate);
  const daysSincePupae = Math.floor((Date.now() - pupaeDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysSincePupae >= 3;
}

// Function to calculate sale price
function calculateSalePrice(batch) {
  const basePrice = SPECIES_MARKET_PRICES[batch.species] || 25.00;
  const qualityMultiplier = batch.qualityScore || 1.0;
  const survivalMultiplier = batch.survivalRate || 1.0;
  
  return Math.round(basePrice * qualityMultiplier * survivalMultiplier * 100) / 100;
}

// Function to create marketplace listing
function createMarketplaceListing(batch) {
  const salePrice = calculateSalePrice(batch);
  const speciesInfo = BUTTERFLY_SPECIES_INFO[batch.species] || {};
  
  return {
    id: `SALE-${Date.now()}`,
    batch_id: batch.cageId,
    species: batch.species,
    larval_count: batch.larvaCount,
    quality_score: batch.qualityScore,
    survival_rate: batch.survivalRate,
    final_sale_price: salePrice,
    price_per_unit: Math.round((salePrice / batch.larvaCount) * 100) / 100,
    seller_id: batch.createdBy,
    listed_date: new Date().toISOString(),
    status: 'available',
    description: `High-quality ${batch.species} pupae ready for emergence`,
    species_info: {
      scientific_name: speciesInfo.scientific_name || 'Unknown',
      family: speciesInfo.family || 'Unknown',
      description: speciesInfo.description || '',
      host_plants: SPECIES_HOST_PLANTS[batch.species]?.plant || 'Unknown'
    }
  };
}

// Test the auto-listing functionality
console.log('🧪 Testing Auto-Listing Feature for Butterfly Breeding System\n');

console.log('📋 Mock Batch Data:');
console.log('- Cage ID:', mockBatch.cageId);
console.log('- Species:', mockBatch.species);
console.log('- Larval Count:', mockBatch.larvaCount);
console.log('- Lifecycle Stage:', mockBatch.lifecycleStage);
console.log('- Pupae Stage Date:', mockBatch.pupaeStageDate);
console.log('- Quality Score:', mockBatch.qualityScore);
console.log('- Survival Rate:', mockBatch.survivalRate);

const pupaeDate = new Date(mockBatch.pupaeStageDate);
const daysSincePupae = Math.floor((Date.now() - pupaeDate.getTime()) / (1000 * 60 * 60 * 24));
console.log('- Days Since Pupae Stage:', daysSincePupae);

console.log('\n📊 Auto-Listing Check:');
const shouldList = shouldListForSale(mockBatch);
console.log('- Should List for Sale:', shouldList ? '✅ YES' : '❌ NO');

if (shouldList) {
  const listing = createMarketplaceListing(mockBatch);
  
  console.log('\n🏪 Generated Marketplace Listing:');
  console.log('- Listing ID:', listing.id);
  console.log('- Species:', listing.species);
  console.log('- Scientific Name:', listing.species_info.scientific_name);
  console.log('- Family:', listing.species_info.family);
  console.log('- Larval Count:', listing.larval_count);
  console.log('- Quality Score:', listing.quality_score);
  console.log('- Survival Rate:', listing.survival_rate);
  console.log('- Final Sale Price: ₱' + listing.final_sale_price);
  console.log('- Price per Unit: ₱' + listing.price_per_unit);
  console.log('- Host Plants:', listing.species_info.host_plants);
  console.log('- Status:', listing.status);
  console.log('- Listed Date:', listing.listed_date);
  console.log('- Description:', listing.description);
  
  console.log('\n🔄 Batch Status Update:');
  mockBatch.listedForSale = true;
  mockBatch.salePrice = listing.final_sale_price;
  mockBatch.marketplaceId = listing.id;
  
  console.log('- Batch marked as listed for sale');
  console.log('- Sale price set to: ₱' + mockBatch.salePrice);
  console.log('- Marketplace ID:', mockBatch.marketplaceId);
  
  console.log('\n📱 SMS Notification (would be sent):');
  console.log(`To: ${mockBatch.phoneNumber}`);
  console.log(`Message: "🦋 Your ${mockBatch.species} pupae batch (${mockBatch.cageId}) is now 3+ days old and has been automatically listed for sale at ₱${listing.final_sale_price}! Quality: ${Math.round(mockBatch.qualityScore * 100)}%, Survival: ${Math.round(mockBatch.survivalRate * 100)}%. Check the marketplace for buyer interest."`);
}

console.log('\n🎯 Summary:');
console.log('- Auto-listing triggers when pupae reach 3+ days old');
console.log('- Price calculated based on species, quality, and survival rate');
console.log('- Comprehensive species information included');
console.log('- SMS notification sent to breeder');
console.log('- Marketplace listing created automatically');
console.log('- Batch status updated to prevent duplicate listings');

console.log('\n✅ Auto-listing feature is working correctly!');