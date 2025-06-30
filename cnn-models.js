const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');

// Model file paths
const MODEL_PATHS = {
  BUTTERFLY_SPECIES: './models/model_Butterfly_Species.h5',
  BUTTERFLY_STAGES: './models/model_Butterfly_Stages.h5',
  LARVAL_DISEASES: './models/model_Larval_Diseases.h5',
  PUPAE_DEFECTS: './models/model_Pupae_Defects.h5'
};

// Classification labels
const CLASSIFICATION_LABELS = {
  BUTTERFLY_SPECIES: [
    'Butterfly-Clippers',
    'Butterfly-Common Jay',
    'Butterfly-Common Lime',
    'Butterfly-Common Mime',
    'Butterfly-Common Mormon',
    'Butterfly-Emerald Swallowtail',
    'Butterfly-Golden Birdwing',
    'Butterfly-Gray Glassy Tiger',
    'Butterfly-Great Eggfly',
    'Butterfly-Great Yellow Mormon',
    'Butterfly-Paper Kite',
    'Butterfly-Plain Tiger',
    'Butterfly-Red Lacewing',
    'Butterfly-Scarlet Mormon',
    'Butterfly-Pink Rose',
    'Butterfly-Tailed Jay',
    'Moth-Atlas',
    'Moth-Giant Silk'
  ],
  
  BUTTERFLY_STAGES: [
    'Butterfly', 
    'Egg',
    'Larva',
    'Pupa',
  ],
  
  LARVAL_DISEASES: [
    'Anaphylaxis Infection',
    'Gnathostomiasis',
    'Healthy',
    'Nucleopolyhedrosis'
  ],
  
  PUPAE_DEFECTS: [
    'Antbites',
    'Deformed body',
    'Healthy',
    'Old Pupa',
    'Overbend',
    'Stretch abdomen'
  ]
};

// Market prices for butterfly species (for profit calculations)
const SPECIES_MARKET_PRICES = {
  'Butterfly-Clippers': 18.00,
  'Butterfly-Common Jay': 22.00,
  'Butterfly-Common Lime': 20.00,
  'Butterfly-Common Mime': 25.00,
  'Butterfly-Common Mormon': 28.00,
  'Butterfly-Emerald Swallowtail': 35.00,
  'Butterfly-Golden Birdwing': 65.00,
  'Butterfly-Gray Glassy Tiger': 30.00,
  'Butterfly-Great Eggfly': 32.00,
  'Butterfly-Great Yellow Mormon': 40.00,
  'Butterfly-Paper Kite': 38.00,
  'Butterfly-Plain Tiger': 24.00,
  'Butterfly-Red Lacewing': 42.00,
  'Butterfly-Scarlet Mormon': 36.00,
  'Butterfly-Pink Rose': 44.00,
  'Butterfly-Tailed Jay': 26.00,
  'Moth-Atlas': 45.00,
  'Moth-Giant Silk': 48.00
};

// Host plant requirements for each species
const SPECIES_HOST_PLANTS = {
  'Butterfly-Clippers': { plant: ['Ixora', 'Wild Cucumber'], dailyConsumption: 120 },
  'Butterfly-Common Jay': { plant: ['Avocado Tree', 'Soursop', 'Sugar Apple', 'Amuyon', 'Indian Tree'], dailyConsumption: 160 },
  'Butterfly-Common Lime': { plant:  ['Limeberry', 'Calamondin', 'Pomelo', 'Sweet Orange', 'Calamansi'], dailyConsumption: 140 },
  'Butterfly-Common Mime': { plant: ['Clover Cinnamon', 'Wild Cinnamon'], dailyConsumption: 150 },
  'Butterfly-Common Mormon': { plant: ['Limeberry', 'Calamondin', 'Pomelo', 'Sweet Orange', 'Calamansi', 'Lemoncito'], dailyConsumption: 155 },
  'Butterfly-Emerald Swallowtail': { plant: ['Curry Leafs', 'Pink Lime-Berry Tree'], dailyConsumption: 180 },
  'Butterfly-Golden Birdwing': { plant: ['Dutchman pipe', 'Indian Birthwort'], dailyConsumption: 200 },
  'Butterfly-Gray Glassy Tiger': { plant: 'Parsonsia', dailyConsumption: 130 },
  'Butterfly-Great Eggfly': { plant: ['Sweet Potato', 'Water Spinach', 'Portulaca'], dailyConsumption: 125 },
  'Butterfly-Great Yellow Mormon': { plant: ['Limeberry', 'Calamondin', 'Pomelo', 'Sweet Orange', 'Calamansi'], dailyConsumption: 165 },
  'Butterfly-Paper Kite': { plant: ['Common Skillpod'], dailyConsumption: 145 },
  'Butterfly-Plain Tiger': { plant: ['Crown flower', 'Giant Milkweed'], dailyConsumption: 135 },
  'Butterfly-Red Lacewing': { plant: ['Wild Bush Passion Fruits'], dailyConsumption: 170 },
  'Butterfly-Scarlet Mormon': { plant: ['Calamondin', 'Pomelo', 'Sweet Orange', 'Calamansi'], dailyConsumption: 158 },
  'Butterfly-Pink Rose': { plant: ['Dutchman pipe', 'Indian Birthwort'], dailyConsumption: 185 },
  'Butterfly-Tailed Jay': { plant: ['Avocado Tree', 'Soursop', 'Sugar Apple', 'Amuyon', 'Indian Tree'], dailyConsumption: 140 },
  'Moth-Atlas': { plant: 'Willow', 'Soursop', 'Amuyon', dailyConsumption: 220 },
  'Moth-Giant Silk': { plant: ['Gmelina Tree', 'Cassia'], dailyConsumption: 250 }
};


// Disease severity impact on profit
const DISEASE_IMPACT = {
  'Anaphylaxis Infection': 0.3,
  'Gnathostomiasis': 0.4,
  'Healthy': 1.0,
  'Nucleopolyhedrosis': 0.1
};

// Defect severity impact on profit
const DEFECT_IMPACT = {
  'Antbites': 0.7,
  'Deformed body': 0.4,
  'Healthy': 1.0,
  'Old Pupa': 0.6,
  'Overbend': 0.5,
  'Stretch abdomen': 0.6
};

class CNNModelManager {
  constructor() {
    this.models = {};
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🧠 Initializing CNN models...');
      
      // Create models directory if it doesn't exist
      await fs.mkdir('./models', { recursive: true });
      
      // For now, we'll create placeholder models since the actual .h5 files need to be uploaded
      // In a real implementation, you would load the actual models like this:
      // this.models.BUTTERFLY_SPECIES = await tf.loadLayersModel('file://' + MODEL_PATHS.BUTTERFLY_SPECIES);
      
      // Create mock models for demonstration (replace with actual model loading)
      this.models = {
        BUTTERFLY_SPECIES: await this.createMockModel(CLASSIFICATION_LABELS.BUTTERFLY_SPECIES.length),
        BUTTERFLY_STAGES: await this.createMockModel(CLASSIFICATION_LABELS.BUTTERFLY_STAGES.length),
        LARVAL_DISEASES: await this.createMockModel(CLASSIFICATION_LABELS.LARVAL_DISEASES.length),
        PUPAE_DEFECTS: await this.createMockModel(CLASSIFICATION_LABELS.PUPAE_DEFECTS.length)
      };
      
      this.isInitialized = true;
      console.log('✓ CNN models initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing CNN models:', error);
      return false;
    }
  }

  // Create a mock model for demonstration (replace with actual model loading)
  async createMockModel(numClasses) {
    const model = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [224, 224, 3],
          filters: 32,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.flatten(),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dense({ units: numClasses, activation: 'softmax' })
      ]
    });
    
    return model;
  }

  // Load actual TensorFlow model from file
  async loadActualModel(modelPath, modelType) {
    try {
      console.log(`Loading ${modelType} model from ${modelPath}...`);
      
      // Check if model file exists
      await fs.access(modelPath);
      
      // Load the model
      const model = await tf.loadLayersModel('file://' + modelPath);
      this.models[modelType] = model;
      
      console.log(`✓ ${modelType} model loaded successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Error loading ${modelType} model:`, error);
      return false;
    }
  }

  // Preprocess image for model input
  preprocessImage(imageBuffer) {
    try {
      // Decode image
      const imageTensor = tf.node.decodeImage(imageBuffer, 3);
      
      // Resize to 224x224 (standard input size for most CNN models)
      const resized = tf.image.resizeBilinear(imageTensor, [224, 224]);
      
      // Normalize pixel values to [0, 1]
      const normalized = resized.div(255.0);
      
      // Add batch dimension
      const batched = normalized.expandDims(0);
      
      // Clean up intermediate tensors
      imageTensor.dispose();
      resized.dispose();
      normalized.dispose();
      
      return batched;
    } catch (error) {
      console.error('Error preprocessing image:', error);
      throw new Error('Failed to preprocess image');
    }
  }

  // Classify butterfly species
  async classifySpecies(imageBuffer) {
    if (!this.isInitialized || !this.models.BUTTERFLY_SPECIES) {
      throw new Error('Species classification model not available');
    }

    try {
      const preprocessed = this.preprocessImage(imageBuffer);
      const predictions = await this.models.BUTTERFLY_SPECIES.predict(preprocessed);
      const probabilities = await predictions.data();
      
      // Clean up tensors
      preprocessed.dispose();
      predictions.dispose();
      
      // Get top 3 predictions
      const results = CLASSIFICATION_LABELS.BUTTERFLY_SPECIES
        .map((label, index) => ({
          species: label,
          confidence: probabilities[index],
          marketPrice: SPECIES_MARKET_PRICES[label] || 25.00,
          hostPlant: SPECIES_HOST_PLANTS[label] || { plant: 'Unknown', dailyConsumption: 150 }
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);
      
      return {
        modelType: 'BUTTERFLY_SPECIES',
        predictions: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in species classification:', error);
      throw new Error('Species classification failed');
    }
  }

  // Classify butterfly lifecycle stage
  async classifyLifecycleStage(imageBuffer) {
    if (!this.isInitialized || !this.models.BUTTERFLY_STAGES) {
      throw new Error('Lifecycle stage classification model not available');
    }

    try {
      const preprocessed = this.preprocessImage(imageBuffer);
      const predictions = await this.models.BUTTERFLY_STAGES.predict(preprocessed);
      const probabilities = await predictions.data();
      
      preprocessed.dispose();
      predictions.dispose();
      
      const results = CLASSIFICATION_LABELS.BUTTERFLY_STAGES
        .map((label, index) => ({
          stage: label,
          confidence: probabilities[index]
        }))
        .sort((a, b) => b.confidence - a.confidence);
      
      return {
        modelType: 'BUTTERFLY_STAGES',
        predictions: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in lifecycle stage classification:', error);
      throw new Error('Lifecycle stage classification failed');
    }
  }

  // Classify larval diseases
  async classifyLarvalDisease(imageBuffer) {
    if (!this.isInitialized || !this.models.LARVAL_DISEASES) {
      throw new Error('Larval disease classification model not available');
    }

    try {
      const preprocessed = this.preprocessImage(imageBuffer);
      const predictions = await this.models.LARVAL_DISEASES.predict(preprocessed);
      const probabilities = await predictions.data();
      
      preprocessed.dispose();
      predictions.dispose();
      
      const results = CLASSIFICATION_LABELS.LARVAL_DISEASES
        .map((label, index) => ({
          disease: label,
          confidence: probabilities[index],
          severity: label === 'Healthy' ? 'None' : 'High',
          profitImpact: DISEASE_IMPACT[label] || 0.5,
          treatmentRecommended: label !== 'Healthy'
        }))
        .sort((a, b) => b.confidence - a.confidence);
      
      return {
        modelType: 'LARVAL_DISEASES',
        predictions: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in larval disease classification:', error);
      throw new Error('Larval disease classification failed');
    }
  }

  // Classify pupae defects
  async classifyPupaeDefects(imageBuffer) {
    if (!this.isInitialized || !this.models.PUPAE_DEFECTS) {
      throw new Error('Pupae defect classification model not available');
    }

    try {
      const preprocessed = this.preprocessImage(imageBuffer);
      const predictions = await this.models.PUPAE_DEFECTS.predict(preprocessed);
      const probabilities = await predictions.data();
      
      preprocessed.dispose();
      predictions.dispose();
      
      const results = CLASSIFICATION_LABELS.PUPAE_DEFECTS
        .map((label, index) => ({
          defect: label,
          confidence: probabilities[index],
          severity: this.getDefectSeverity(label),
          profitImpact: DEFECT_IMPACT[label] || 0.5,
          qualityGrade: this.getQualityGrade(DEFECT_IMPACT[label] || 0.5)
        }))
        .sort((a, b) => b.confidence - a.confidence);
      
      return {
        modelType: 'PUPAE_DEFECTS',
        predictions: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in pupae defect classification:', error);
      throw new Error('Pupae defect classification failed');
    }
  }

  // Get defect severity level
  getDefectSeverity(defect) {
    const severityMap = {
      'Antbites': 'Medium',
      'Deformed body': 'High',
      'Healthy': 'None',
      'Old Pupa': 'Medium',
      'Overbend': 'Medium',
      'Stretch abdomen': 'Medium'
    };
    return severityMap[defect] || 'Unknown';
  }

  // Get quality grade based on profit impact
  getQualityGrade(impact) {
    if (impact >= 0.9) return 'A+';
    if (impact >= 0.8) return 'A';
    if (impact >= 0.7) return 'B+';
    if (impact >= 0.6) return 'B';
    if (impact >= 0.5) return 'C+';
    if (impact >= 0.4) return 'C';
    return 'D';
  }

  // Perform comprehensive analysis on an image
  async performFullAnalysis(imageBuffer, analysisType = 'all') {
    const results = {};
    
    try {
      if (analysisType === 'all' || analysisType === 'species') {
        results.species = await this.classifySpecies(imageBuffer);
      }
      
      if (analysisType === 'all' || analysisType === 'stage') {
        results.stage = await this.classifyLifecycleStage(imageBuffer);
      }
      
      if (analysisType === 'all' || analysisType === 'disease') {
        results.disease = await this.classifyLarvalDisease(imageBuffer);
      }
      
      if (analysisType === 'all' || analysisType === 'defects') {
        results.defects = await this.classifyPupaeDefects(imageBuffer);
      }
      
      // Calculate overall health score
      let healthScore = 1.0;
      if (results.disease) {
        healthScore *= results.disease.predictions[0].profitImpact;
      }
      if (results.defects) {
        healthScore *= results.defects.predictions[0].profitImpact;
      }
      
      results.summary = {
        overallHealthScore: healthScore,
        qualityGrade: this.getQualityGrade(healthScore),
        analysisTimestamp: new Date().toISOString(),
        recommendedActions: this.generateRecommendations(results)
      };
      
      return results;
    } catch (error) {
      console.error('Error in full analysis:', error);
      throw new Error('Analysis failed');
    }
  }

  // Generate care recommendations based on analysis
  generateRecommendations(analysisResults) {
    const recommendations = [];
    
    if (analysisResults.disease) {
      const topDisease = analysisResults.disease.predictions[0];
      if (topDisease.disease !== 'Healthy' && topDisease.confidence > 0.7) {
        recommendations.push({
          type: 'health',
          priority: 'high',
          action: `Treat for ${topDisease.disease}`,
          description: `High confidence detection of ${topDisease.disease}. Immediate treatment recommended.`
        });
      }
    }
    
    if (analysisResults.defects) {
      const topDefect = analysisResults.defects.predictions[0];
      if (topDefect.defect !== 'Healthy' && topDefect.confidence > 0.6) {
        recommendations.push({
          type: 'quality',
          priority: topDefect.severity === 'High' ? 'high' : 'medium',
          action: `Address ${topDefect.defect}`,
          description: `Quality issue detected: ${topDefect.defect}. Consider isolation or special care.`
        });
      }
    }
    
    if (analysisResults.species) {
      const topSpecies = analysisResults.species.predictions[0];
      recommendations.push({
        type: 'care',
        priority: 'medium',
        action: `Optimize care for ${topSpecies.species}`,
        description: `Ensure proper ${topSpecies.hostPlant.plant} supply (${topSpecies.hostPlant.dailyConsumption}g/day).`
      });
    }
    
    return recommendations;
  }

  // Get model status
  getModelStatus() {
    return {
      initialized: this.isInitialized,
      models: {
        BUTTERFLY_SPECIES: !!this.models.BUTTERFLY_SPECIES,
        BUTTERFLY_STAGES: !!this.models.BUTTERFLY_STAGES,
        LARVAL_DISEASES: !!this.models.LARVAL_DISEASES,
        PUPAE_DEFECTS: !!this.models.PUPAE_DEFECTS
      },
      supportedSpecies: CLASSIFICATION_LABELS.BUTTERFLY_SPECIES.length,
      lastInitialized: this.isInitialized ? new Date().toISOString() : null
    };
  }
}

// Export singleton instance
const cnnModelManager = new CNNModelManager();

module.exports = {
  cnnModelManager,
  CLASSIFICATION_LABELS,
  SPECIES_MARKET_PRICES,
  SPECIES_HOST_PLANTS,
  DISEASE_IMPACT,
  DEFECT_IMPACT
};