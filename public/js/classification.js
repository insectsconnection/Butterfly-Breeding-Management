// Enhanced AI Classification for Butterfly Pupae Quality Assessment
// Specifically designed for purchasers to evaluate pupae quality before buying

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
        showNotification('Analyzing pupae quality...', 'info');
        showLoadingState(true);
        
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
            showNotification('Quality analysis completed!', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Classification failed', 'danger');
        }
    } catch (error) {
        console.error('Error classifying image:', error);
        showNotification('Network error during classification', 'danger');
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
    
    // Update classification interface for purchaser-focused features
    const uploadSection = classificationTab.querySelector('.card');
    if (uploadSection) {
        uploadSection.querySelector('h3').innerHTML = '<i class="fas fa-camera"></i> Pupae Quality Scanner';
        
        // Add purchaser-specific instructions
        const instructions = document.createElement('div');
        instructions.innerHTML = `
            <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                <h5 style="color: #4a5568; margin-bottom: 10px;"><i class="fas fa-info-circle"></i> For Purchasers</h5>
                <p style="margin: 0; color: #666;">Upload clear photos of pupae to assess quality before purchasing. Our AI will analyze health, defects, and provide buying recommendations.</p>
            </div>
        `;
        uploadSection.insertBefore(instructions, uploadSection.querySelector('.form-group'));
    }
}