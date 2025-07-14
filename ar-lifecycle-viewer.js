// Augmented Reality Butterfly Lifecycle Viewer
// This module provides AR functionality for visualizing butterfly lifecycle stages

class ARLifecycleViewer {
  constructor() {
    this.isARSupported = false;
    this.arSession = null;
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.models = {};
    this.currentStage = 'Egg';
    this.currentSpecies = 'Butterfly-Common Mormon';
    this.isInitialized = false;
  }

  // Initialize AR capabilities
  async initialize() {
    try {
      console.log('🔍 Initializing AR Lifecycle Viewer...');
      
      // Check if WebXR is supported
      if ('xr' in navigator) {
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        this.isARSupported = supported;
        
        if (supported) {
          console.log('✓ AR is supported');
          await this.setupAREnvironment();
        } else {
          console.log('⚠️ AR not supported, falling back to 3D viewer');
          await this.setup3DViewer();
        }
      } else {
        console.log('⚠️ WebXR not available, using 3D viewer');
        await this.setup3DViewer();
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Error initializing AR viewer:', error);
      return false;
    }
  }

  // Setup AR environment with WebXR
  async setupAREnvironment() {
    // Create AR session button
    const arButton = document.createElement('button');
    arButton.textContent = 'Start AR Experience';
    arButton.className = 'btn btn-primary ar-button';
    arButton.onclick = () => this.startARSession();
    
    // Add to AR container
    const arContainer = document.getElementById('ar-container');
    if (arContainer) {
      arContainer.appendChild(arButton);
    }
  }

  // Setup 3D viewer fallback
  async setup3DViewer() {
    // Create 3D viewer container
    const viewerContainer = document.createElement('div');
    viewerContainer.id = 'lifecycle-3d-viewer';
    viewerContainer.style.cssText = `
      width: 100%;
      height: 400px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 15px;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px 0;
    `;
    
    // Create lifecycle stages visualization
    this.create3DLifecycleStages(viewerContainer);
    
    // Add to AR container
    const arContainer = document.getElementById('ar-container');
    if (arContainer) {
      arContainer.appendChild(viewerContainer);
    }
  }

  // Create 3D lifecycle stages visualization
  create3DLifecycleStages(container) {
    const stagesContainer = document.createElement('div');
    stagesContainer.style.cssText = `
      display: flex;
      justify-content: space-around;
      align-items: center;
      width: 100%;
      height: 100%;
      padding: 20px;
    `;

    const stages = [
      { name: 'Egg', icon: '🥚', color: '#ffd700' },
      { name: 'Larva', icon: '🐛', color: '#32cd32' },
      { name: 'Pupa', icon: '🛡️', color: '#8b4513' },
      { name: 'Adult', icon: '🦋', color: '#ff69b4' }
    ];

    stages.forEach((stage, index) => {
      const stageElement = document.createElement('div');
      stageElement.className = 'lifecycle-stage';
      stageElement.style.cssText = `
        text-align: center;
        cursor: pointer;
        transition: transform 0.3s ease;
        padding: 15px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.2);
        min-width: 120px;
      `;

      stageElement.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 10px;">${stage.icon}</div>
        <div style="color: white; font-weight: bold; font-size: 1.1rem;">${stage.name}</div>
        <div style="color: rgba(255, 255, 255, 0.8); font-size: 0.9rem; margin-top: 5px;">
          ${this.getStageDescription(stage.name)}
        </div>
      `;

      // Add hover and click effects
      stageElement.addEventListener('mouseenter', () => {
        stageElement.style.transform = 'scale(1.1)';
        stageElement.style.background = `rgba(255, 255, 255, 0.2)`;
      });

      stageElement.addEventListener('mouseleave', () => {
        stageElement.style.transform = 'scale(1)';
        stageElement.style.background = 'rgba(255, 255, 255, 0.1)';
      });

      stageElement.addEventListener('click', () => {
        this.selectStage(stage.name);
      });

      stagesContainer.appendChild(stageElement);

      // Add arrow between stages
      if (index < stages.length - 1) {
        const arrow = document.createElement('div');
        arrow.innerHTML = '→';
        arrow.style.cssText = `
          color: white;
          font-size: 2rem;
          font-weight: bold;
          opacity: 0.7;
        `;
        stagesContainer.appendChild(arrow);
      }
    });

    container.appendChild(stagesContainer);
  }

  // Get stage description
  getStageDescription(stage) {
    const descriptions = {
      'Egg': 'Fertilized eggs laid on host plants',
      'Larva': 'Caterpillar stage, rapid growth',
      'Pupa': 'Chrysalis stage, metamorphosis',
      'Adult': 'Mature butterfly, reproduction'
    };
    return descriptions[stage] || 'Stage description';
  }

  // Select and focus on a lifecycle stage
  selectStage(stage) {
    this.currentStage = stage;
    
    // Highlight selected stage
    const stages = document.querySelectorAll('.lifecycle-stage');
    stages.forEach(stageEl => {
      stageEl.style.border = '2px solid rgba(255, 255, 255, 0.2)';
    });
    
    // Highlight current stage
    const currentStageEl = Array.from(stages).find(el => 
      el.textContent.includes(stage)
    );
    if (currentStageEl) {
      currentStageEl.style.border = '2px solid #00ff00';
    }

    // Show detailed information
    this.showStageDetails(stage);
  }

  // Show detailed information about selected stage
  showStageDetails(stage) {
    const detailsContainer = document.getElementById('stage-details');
    if (!detailsContainer) return;

    const stageInfo = this.getDetailedStageInfo(stage);
    
    detailsContainer.innerHTML = `
      <div class="stage-details-card">
        <h3>${stage} Stage</h3>
        <div class="stage-info">
          <div class="info-item">
            <strong>Duration:</strong> ${stageInfo.duration}
          </div>
          <div class="info-item">
            <strong>Characteristics:</strong> ${stageInfo.characteristics}
          </div>
          <div class="info-item">
            <strong>Care Requirements:</strong> ${stageInfo.care}
          </div>
          <div class="info-item">
            <strong>Common Issues:</strong> ${stageInfo.issues}
          </div>
        </div>
      </div>
    `;
  }

  // Get detailed stage information
  getDetailedStageInfo(stage) {
    const stageData = {
      'Egg': {
        duration: '3-7 days',
        characteristics: 'Small, round, attached to host plant leaves',
        care: 'Maintain humidity, protect from predators',
        issues: 'Desiccation, parasitism, predation'
      },
      'Larva': {
        duration: '14-21 days',
        characteristics: 'Caterpillar with multiple instars, feeding actively',
        care: 'Fresh host plants, proper spacing, cleanliness',
        issues: 'Disease, overcrowding, food shortage'
      },
      'Pupa': {
        duration: '7-14 days',
        characteristics: 'Chrysalis stage, internal restructuring',
        care: 'Stable environment, minimal disturbance',
        issues: 'Deformation, parasitism, premature emergence'
      },
      'Adult': {
        duration: '2-4 weeks',
        characteristics: 'Fully developed butterfly, ready for reproduction',
        care: 'Nectar sources, mating space, egg-laying sites',
        issues: 'Wing damage, poor mating success'
      }
    };
    
    return stageData[stage] || {
      duration: 'Variable',
      characteristics: 'Stage characteristics',
      care: 'Basic care requirements',
      issues: 'Common problems'
    };
  }

  // Start AR session
  async startARSession() {
    try {
      if (!this.isARSupported) {
        throw new Error('AR not supported');
      }

      this.arSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body }
      });

      // Setup AR session
      await this.setupARSession();
      
      console.log('✓ AR session started');
    } catch (error) {
      console.error('❌ Failed to start AR session:', error);
      alert('AR not available. Using 3D viewer instead.');
    }
  }

  // Setup AR session
  async setupARSession() {
    // AR session setup would go here
    // This is a placeholder for actual WebXR implementation
    console.log('Setting up AR session...');
    
    // For now, show a modal with AR instructions
    this.showARInstructions();
  }

  // Show AR instructions modal
  showARInstructions() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
        <h3>AR Lifecycle Viewer</h3>
        <div style="padding: 20px; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 20px;">🦋</div>
          <p>Point your device at a flat surface to view the butterfly lifecycle in 3D!</p>
          <div style="margin: 20px 0;">
            <div>• Move your device to explore different angles</div>
            <div>• Tap on lifecycle stages to learn more</div>
            <div>• Use gestures to interact with models</div>
          </div>
          <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn">
            Start AR Experience
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // Update species for visualization
  updateSpecies(species) {
    this.currentSpecies = species;
    console.log(`Updated AR viewer for species: ${species}`);
  }

  // Get AR viewer status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isARSupported: this.isARSupported,
      currentStage: this.currentStage,
      currentSpecies: this.currentSpecies
    };
  }
}

// Export for use in other modules
module.exports = ARLifecycleViewer;