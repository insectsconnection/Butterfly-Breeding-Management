// Enhanced AI Classification for Butterfly Pupae Quality Assessment
// Specifically designed for purchasers to evaluate pupae quality before buying

// Camera variables
let stream = null;
let video = null;
let canvas = null;
let captureBtn = null;

// Initialize camera functionality
function initializeCamera() {
    video = document.getElementById('camera-video');
    canvas = document.getElementById('capture-canvas');
    captureBtn = document.getElementById('capture-btn');
    
    if (!video || !canvas || !captureBtn) {
        console.warn('Camera elements not found, creating them...');
        createCameraInterface();
    }
}

function createCameraInterface() {
    const classificationTab = document.getElementById('classification');
    if (!classificationTab) return;
    
    const cameraHtml = `
        <div style="background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <h4 style="margin-bottom: 15px; color: #4a5568;"><i class="fas fa-camera"></i> Real-time Camera Capture</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <h5 style="margin-bottom: 10px;">Live Camera Feed</h5>
                    <video id="camera-video" autoplay playsinline style="width: 100%; max-width: 400px; border-radius: 10px; border: 2px solid #e2e8f0;"></video>
                    <div style="text-align: center; margin-top: 10px;">
                        <button id="start-camera-btn" onclick="startCamera()" style="margin: 5px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-video"></i> Start Camera
                        </button>
                        <button id="capture-btn" onclick="captureAndClassify()" style="margin: 5px; padding: 10px 20px; background: #38a169; color: white; border: none; border-radius: 8px; cursor: pointer;" disabled>
                            <i class="fas fa-camera"></i> Capture & Analyze
                        </button>
                        <button id="stop-camera-btn" onclick="stopCamera()" style="margin: 5px; padding: 10px 20px; background: #e53e3e; color: white; border: none; border-radius: 8px; cursor: pointer;" disabled>
                            <i class="fas fa-stop"></i> Stop Camera
                        </button>
                    </div>
                </div>
                <div>
                    <h5 style="margin-bottom: 10px;">Captured Image</h5>
                    <canvas id="capture-canvas" style="width: 100%; max-width: 400px; border-radius: 10px; border: 2px solid #e2e8f0; background: #f7fafc;"></canvas>
                    <div style="text-align: center; margin-top: 10px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <label for="analysis-type" style="font-weight: bold;">Analysis Type:</label>
                            <select id="analysis-type" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <option value="species">Species Identification</option>
                                <option value="disease">Disease Detection</option>
                                <option value="defects">Defects Assessment</option>
                                <option value="comprehensive">Comprehensive Analysis</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <div id="camera-status" style="text-align: center; padding: 10px; background: #f0f4f8; border-radius: 8px; color: #4a5568;">
                📷 Click "Start Camera" to begin real-time pupae quality assessment
            </div>
        </div>
    `;
    
    // Insert camera interface before existing upload section
    const uploadCard = classificationTab.querySelector('.card');
    if (uploadCard) {
        uploadCard.insertAdjacentHTML('beforebegin', cameraHtml);
    } else {
        classificationTab.innerHTML = cameraHtml + classificationTab.innerHTML;
    }
    
    // Initialize elements after creating them
    video = document.getElementById('camera-video');
    canvas = document.getElementById('capture-canvas');
    captureBtn = document.getElementById('capture-btn');
}

async function startCamera() {
    try {
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'environment' // Use back camera on mobile
            }
        };
        
        showCameraStatus('🔄 Starting camera...', 'info');
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        // Enable capture button and disable start button
        document.getElementById('capture-btn').disabled = false;
        document.getElementById('start-camera-btn').disabled = true;
        document.getElementById('stop-camera-btn').disabled = false;
        
        showCameraStatus('📹 Camera active - Position pupae in view and click "Capture & Analyze"', 'success');
        
        // Notify server about camera start
        if (socket) {
            socket.emit('camera_started', { userId: currentUser?.id });
        }
        
    } catch (error) {
        console.error('Error starting camera:', error);
        showCameraStatus('❌ Camera access denied. Please allow camera permissions.', 'danger');
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        
        // Reset button states
        document.getElementById('capture-btn').disabled = true;
        document.getElementById('start-camera-btn').disabled = false;
        document.getElementById('stop-camera-btn').disabled = true;
        
        showCameraStatus('📷 Camera stopped - Click "Start Camera" to resume', 'info');
    }
}

function showCameraStatus(message, type) {
    const statusDiv = document.getElementById('camera-status');
    if (statusDiv) {
        statusDiv.innerHTML = message;
        statusDiv.className = `camera-status ${type}`;
        statusDiv.style.background = type === 'success' ? '#f0fff4' : type === 'danger' ? '#fff5f5' : type === 'warning' ? '#fffbf0' : '#f0f4f8';
        statusDiv.style.color = type === 'success' ? '#38a169' : type === 'danger' ? '#e53e3e' : type === 'warning' ? '#d69e2e' : '#4a5568';
    }
    
    // Also show main notification
    showNotification(message.replace(/[📷📹🔄❌]/g, '').trim(), type);
}

async function captureAndClassify() {
    if (!video || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the video frame to canvas
    ctx.drawImage(video, 0, 0);
    
    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
        if (!blob) {
            showNotification('Failed to capture image', 'danger');
            return;
        }
        
        // Create FormData for upload
        const formData = new FormData();
        formData.append('image', blob, 'captured-pupae.jpg');
        formData.append('analysisType', document.getElementById('analysis-type').value);
        formData.append('captureMethod', 'realtime_camera');
        
        // Notify about analysis start
        showCameraStatus('🔍 Analyzing captured image...', 'info');
        showNotification('🧠 AI analyzing pupae quality - Please wait...', 'info');
        
        try {
            showLoadingState(true);
            
            // Emit to socket for real-time progress
            if (socket) {
                socket.emit('classification_started', { 
                    userId: currentUser?.id, 
                    analysisType: document.getElementById('analysis-type').value 
                });
            }
            
            const response = await fetch('/api/cnn/classify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                displayClassificationResults(data.results);
                showNotification('✅ Quality analysis completed!', 'success');
                showCameraStatus('✅ Analysis complete! Check results below.', 'success');
                
                // Emit completion
                if (socket) {
                    socket.emit('classification_completed', { 
                        userId: currentUser?.id, 
                        results: data.results 
                    });
                }
            } else {
                const error = await response.json();
                showNotification(`❌ ${error.error || 'Classification failed'}`, 'danger');
                showCameraStatus('❌ Analysis failed - Please try again', 'danger');
            }
        } catch (error) {
            console.error('Error classifying image:', error);
            showNotification('❌ Network error during classification', 'danger');
            showCameraStatus('❌ Network error - Check connection', 'danger');
        } finally {
            showLoadingState(false);
        }
    }, 'image/jpeg', 0.8);
}

// Classification functions
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showNotification('File size too large. Maximum 10MB allowed.', 'danger');
        return;
    }
    
    const analysisType = document.getElementById('analysis-type').value;
    const formData = new FormData();
    formData.append('image', file);
    formData.append('analysisType', analysisType);
    
    try {
        showNotification('🧠 AI analyzing pupae quality...', 'info');
        showLoadingState(true);
        
        // Emit to socket for real-time progress
        if (socket) {
            socket.emit('classification_started', { 
                userId: currentUser?.id, 
                analysisType: analysisType 
            });
        }
        
        const response = await fetch('/api/cnn/classify', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            displayClassificationResults(data.results);
            showNotification('✅ Quality analysis completed!', 'success');
            
            // Emit completion to socket
            if (socket) {
                socket.emit('classification_completed', { 
                    userId: currentUser?.id, 
                    results: data.results 
                });
            }
        } else {
            const error = await response.json();
            showNotification(`❌ ${error.error || 'Classification failed'}`, 'danger');
        }
    } catch (error) {
        console.error('Error classifying image:', error);
        showNotification('❌ Network error during classification', 'danger');
    } finally {
        showLoadingState(false);
    }
}

function showLoadingState(isLoading) {
    const resultsContainer = document.getElementById('classification-results');
    if (isLoading) {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 20px; color: #666;">Analyzing pupae quality...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        resultsContainer.style.display = 'block';
    }
}

// Enhanced display for purchasers - focus on quality and buying decision
function displayClassificationResults(results) {
    const container = document.getElementById('classification-results');
    container.style.display = 'block';
    
    let html = `
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 15px; margin-bottom: 20px;">
            <h3><i class="fas fa-microscope"></i> Pupae Quality Assessment Report</h3>
            <p style="opacity: 0.9;">AI-powered analysis to help you make informed purchasing decisions</p>
        </div>
    `;
    
    // Overall Quality Score
    if (results.summary) {
        const qualityScore = results.summary.overallHealthScore * 100;
        const qualityGrade = results.summary.qualityGrade;
        const gradeColor = getGradeColor(qualityGrade);
        
        html += `
            <div style="background: ${gradeColor}; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
                <h2 style="margin: 0; font-size: 2.5rem;">${qualityScore.toFixed(1)}%</h2>
                <h3 style="margin: 5px 0;">Quality Grade: ${qualityGrade}</h3>
                <p style="margin: 0; opacity: 0.9;">${getQualityDescription(qualityGrade)}</p>
            </div>
        `;
    }
    
    // Species Classification with Market Value
    if (results.species) {
        html += `
            <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
                <h4 style="color: #4a5568; margin-bottom: 15px;"><i class="fas fa-butterfly"></i> Species & Market Value</h4>
                <div style="display: grid; gap: 10px;">
                    ${results.species.predictions.slice(0, 3).map((pred, index) => `
                        <div style="display: flex; justify-content: between; align-items: center; padding: 12px; background: ${index === 0 ? '#f0fff4' : '#f7fafc'}; border-radius: 8px; border-left: 4px solid ${index === 0 ? '#38a169' : '#cbd5e0'};">
                            <div style="flex: 1;">
                                <strong style="color: #2d3748;">${pred.species}</strong>
                                <span style="color: #4a5568; margin-left: 10px;">${(pred.confidence * 100).toFixed(1)}% confidence</span>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: #38a169; font-weight: bold; font-size: 1.1rem;">₱${pred.marketPrice}</div>
                                <div style="color: #666; font-size: 0.9rem;">per pupae</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Health Assessment
    if (results.disease) {
        const healthyIndex = results.disease.predictions.findIndex(p => p.disease === 'Healthy');
        const isHealthy = healthyIndex === 0;
        
        html += `
            <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
                <h4 style="color: #4a5568; margin-bottom: 15px;"><i class="fas fa-heartbeat"></i> Health Status</h4>
                <div style="display: grid; gap: 10px;">
                    ${results.disease.predictions.slice(0, 3).map((pred, index) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: ${pred.disease === 'Healthy' ? '#f0fff4' : '#fff5f5'}; border-radius: 8px; border-left: 4px solid ${pred.disease === 'Healthy' ? '#38a169' : '#e53e3e'};">
                            <div>
                                <strong style="color: ${pred.disease === 'Healthy' ? '#38a169' : '#e53e3e'};">${pred.disease}</strong>
                                <span style="color: #666; margin-left: 10px;">${(pred.confidence * 100).toFixed(1)}%</span>
                            </div>
                            <div style="color: ${pred.disease === 'Healthy' ? '#38a169' : '#e53e3e'};">
                                Impact: ${(pred.profitImpact * 100).toFixed(0)}%
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Quality Defects Assessment
    if (results.defects) {
        html += `
            <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
                <h4 style="color: #4a5568; margin-bottom: 15px;"><i class="fas fa-search"></i> Physical Quality Assessment</h4>
                <div style="display: grid; gap: 10px;">
                    ${results.defects.predictions.slice(0, 3).map((pred, index) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: ${pred.defect === 'Healthy' ? '#f0fff4' : '#fff5f5'}; border-radius: 8px; border-left: 4px solid ${pred.defect === 'Healthy' ? '#38a169' : '#e53e3e'};">
                            <div>
                                <strong style="color: ${pred.defect === 'Healthy' ? '#38a169' : '#e53e3e'};">${pred.defect}</strong>
                                <span style="color: #666; margin-left: 10px;">${(pred.confidence * 100).toFixed(1)}%</span>
                            </div>
                            <div style="background: ${getGradeColor(pred.qualityGrade)}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                                Grade ${pred.qualityGrade}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Purchasing Recommendation
    if (results.summary) {
        const recommendation = getPurchaseRecommendation(results.summary);
        html += `
            <div style="background: ${recommendation.color}; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h4 style="margin-bottom: 15px;"><i class="fas fa-${recommendation.icon}"></i> Purchase Recommendation</h4>
                <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center;">
                    <div>
                        <h5 style="margin: 0 0 5px 0;">${recommendation.title}</h5>
                        <p style="margin: 0; opacity: 0.9;">${recommendation.description}</p>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; margin-bottom: 5px;">${recommendation.icon === 'check-circle' ? '✓' : recommendation.icon === 'exclamation-triangle' ? '⚠' : '✗'}</div>
                        <div style="font-weight: bold;">${recommendation.action}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Recommended Actions for Purchasers
        if (results.summary.recommendedActions.length > 0) {
            html += `
                <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0;">
                    <h4 style="color: #4a5568; margin-bottom: 15px;"><i class="fas fa-lightbulb"></i> Important Considerations</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        ${results.summary.recommendedActions.map(action => `
                            <li style="margin-bottom: 10px; color: ${action.priority === 'high' ? '#e53e3e' : action.priority === 'medium' ? '#d69e2e' : '#38a169'};">
                                <strong>${action.action}:</strong> ${action.description}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
    }
    
    container.innerHTML = html;
}

function getGradeColor(grade) {
    switch(grade?.toUpperCase()) {
        case 'A': return '#38a169';
        case 'B': return '#48bb78';
        case 'C': return '#d69e2e';
        case 'D': return '#ed8936';
        case 'F': return '#e53e3e';
        default: return '#718096';
    }
}

function getQualityDescription(grade) {
    switch(grade?.toUpperCase()) {
        case 'A': return 'Excellent quality - Highly recommended for purchase';
        case 'B': return 'Good quality - Safe to purchase';
        case 'C': return 'Average quality - Purchase with caution';
        case 'D': return 'Below average - Consider other options';
        case 'F': return 'Poor quality - Not recommended';
        default: return 'Quality assessment unavailable';
    }
}

function getPurchaseRecommendation(summary) {
    const score = summary.overallHealthScore * 100;
    
    if (score >= 85) {
        return {
            title: 'Highly Recommended',
            description: 'This pupae shows excellent health and quality indicators. Very good investment potential.',
            action: 'BUY',
            color: '#38a169',
            icon: 'check-circle'
        };
    } else if (score >= 70) {
        return {
            title: 'Recommended',
            description: 'Good quality pupae with acceptable health indicators. Reasonable purchase option.',
            action: 'BUY',
            color: '#48bb78',
            icon: 'check'
        };
    } else if (score >= 50) {
        return {
            title: 'Caution Advised',
            description: 'Average quality with some concerns. Consider price and seller reputation carefully.',
            action: 'CAREFUL',
            color: '#d69e2e',
            icon: 'exclamation-triangle'
        };
    } else {
        return {
            title: 'Not Recommended',
            description: 'Poor quality indicators detected. High risk of loss or poor emergence rates.',
            action: 'AVOID',
            color: '#e53e3e',
            icon: 'times-circle'
        };
    }
}

// Initialize classification interface for purchasers
function initializePurchaserClassification() {
    const classificationTab = document.getElementById('classification');
    if (!classificationTab) return;
    
    // Create the full camera interface
    initializeCamera();
    
    // Update classification interface for purchaser-focused features
    const uploadSection = classificationTab.querySelector('.card');
    if (uploadSection) {
        uploadSection.querySelector('h3').innerHTML = '<i class="fas fa-camera"></i> Pupae Quality Scanner';
        
        // Add purchaser-specific instructions
        const instructions = document.createElement('div');
        instructions.innerHTML = `
            <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                <h5 style="color: #4a5568; margin-bottom: 10px;"><i class="fas fa-info-circle"></i> For Purchasers</h5>
                <p style="margin: 0; color: #666;">Use the camera above for real-time capture or upload photos to assess pupae quality before purchasing. Our AI analyzes health, defects, and provides buying recommendations.</p>
            </div>
        `;
        uploadSection.insertBefore(instructions, uploadSection.querySelector('.form-group'));
    }
}