const Product = require('../models/Product');
const Investment = require('../models/Investment');
const Recommendation = require('../models/Recommendation');
const logger = require('../utils/logger');

// Generate personalized recommendations for a user
exports.generateRecommendations = async (userId) => {
  try {
    // Get user's investment history
    const userInvestments = await Investment.find({ user: userId })
      .populate('product')
      .sort({ createdAt: -1 });

    // Calculate user preferences based on history
    const preferences = analyzeUserPreferences(userInvestments);

    // Get all available products
    const availableProducts = await Product.find({ status: 'open' });

    // Score each product
    const scoredProducts = availableProducts.map((product) => ({
      product,
      score: calculateProductScore(product, preferences, userInvestments),
    }));

    // Sort by score and get top 10
    scoredProducts.sort((a, b) => b.score - a.score);
    const topRecommendations = scoredProducts.slice(0, 10);

    // Save recommendations
    await Recommendation.deleteMany({ user: userId }); // Clear old recommendations

    const recommendations = topRecommendations.map((rec, index) => ({
      user: userId,
      product: rec.product._id,
      score: rec.score,
      reason: generateReason(rec.product, preferences, userInvestments),
      rank: index + 1,
    }));

    await Recommendation.insertMany(recommendations);

    logger.info(`Generated ${recommendations.length} recommendations for user ${userId}`);

    return recommendations;
  } catch (error) {
    logger.error('Error generating recommendations:', error);
    throw error;
  }
};

// Get user recommendations
exports.getUserRecommendations = async (userId, limit = 6) => {
  try {
    const recommendations = await Recommendation.find({ user: userId })
      .populate('product')
      .sort({ rank: 1 })
      .limit(limit);

    // If no recommendations exist, generate them
    if (recommendations.length === 0) {
      await exports.generateRecommendations(userId);
      return await Recommendation.find({ user: userId })
        .populate('product')
        .sort({ rank: 1 })
        .limit(limit);
    }

    return recommendations;
  } catch (error) {
    logger.error('Error getting user recommendations:', error);
    throw error;
  }
};

// Analyze user preferences based on investment history
function analyzeUserPreferences(investments) {
  if (investments.length === 0) {
    return {
      preferredCategories: [],
      averageInvestment: 0,
      riskTolerance: 'medium',
      investmentFrequency: 0,
    };
  }

  // Category preferences
  const categoryCount = {};
  investments.forEach((inv) => {
    const category = inv.product.category;
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });

  const preferredCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0]);

  // Average investment amount
  const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
  const averageInvestment = totalInvested / investments.length;

  // Risk tolerance (based on ROI range preferences)
  const avgExpectedROI =
    investments.reduce((sum, inv) => sum + inv.expectedROI, 0) / investments.length;
  let riskTolerance = 'medium';
  if (avgExpectedROI > 20) riskTolerance = 'high';
  else if (avgExpectedROI < 10) riskTolerance = 'low';

  // Investment frequency (investments per month)
  const firstInvestment = new Date(investments[investments.length - 1].createdAt);
  const monthsSinceFirst = (Date.now() - firstInvestment.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const investmentFrequency = monthsSinceFirst > 0 ? investments.length / monthsSinceFirst : 0;

  return {
    preferredCategories,
    averageInvestment,
    riskTolerance,
    investmentFrequency,
  };
}

// Calculate product score for recommendation
function calculateProductScore(product, preferences, userInvestments) {
  let score = 0;

  // Base score from product performance
  score += product.currentROI * 2; // Weight current ROI heavily

  // Category preference (max 30 points)
  const categoryIndex = preferences.preferredCategories.indexOf(product.category);
  if (categoryIndex !== -1) {
    score += (3 - categoryIndex) * 10; // First preference: 30, Second: 20, Third: 10
  } else {
    score += 5; // Exploration bonus for new categories
  }

  // Price match (max 20 points)
  if (preferences.averageInvestment > 0) {
    const priceDiff = Math.abs(product.minInvestment - preferences.averageInvestment);
    const maxDiff = preferences.averageInvestment;
    const priceScore = Math.max(0, 20 - (priceDiff / maxDiff) * 20);
    score += priceScore;
  }

  // Risk-ROI alignment (max 15 points)
  const productROI = (product.roiRange.min + product.roiRange.max) / 2;
  let targetROI = 15; // medium risk
  if (preferences.riskTolerance === 'high') targetROI = 25;
  else if (preferences.riskTolerance === 'low') targetROI = 10;

  const roiDiff = Math.abs(productROI - targetROI);
  const roiScore = Math.max(0, 15 - roiDiff);
  score += roiScore;

  // Availability (max 10 points)
  const availabilityRate = 1 - product.currentInvestors / product.maxInvestors;
  score += availabilityRate * 10;

  // Diversity bonus (max 10 points)
  // If user hasn't invested in this product before
  const hasInvested = userInvestments.some(
    (inv) => inv.product._id.toString() === product._id.toString()
  );
  if (!hasInvested) {
    score += 10;
  }

  // Featured products bonus (5 points)
  if (product.isFeatured) {
    score += 5;
  }

  // Duration preference (max 10 points)
  // Favor products with moderate duration (3-6 months)
  const idealDuration = 4.5;
  const durationDiff = Math.abs(product.duration - idealDuration);
  const durationScore = Math.max(0, 10 - durationDiff * 2);
  score += durationScore;

  return Math.round(score);
}

// Generate reason for recommendation
function generateReason(product, preferences, userInvestments) {
  const reasons = [];

  // Performance reason
  if (product.currentROI > 15) {
    reasons.push(`High performing with ${product.currentROI.toFixed(1)}% current ROI`);
  }

  // Category reason
  if (preferences.preferredCategories.includes(product.category)) {
    reasons.push(`Matches your interest in ${product.category}`);
  } else {
    reasons.push(`Explore ${product.category} opportunities`);
  }

  // Price reason
  if (
    preferences.averageInvestment > 0 &&
    product.minInvestment <= preferences.averageInvestment * 1.2
  ) {
    reasons.push('Within your typical investment range');
  }

  // Duration reason
  if (product.duration <= 6) {
    reasons.push(`Short ${product.duration}-month duration`);
  } else {
    reasons.push(`Long-term ${product.duration}-month investment`);
  }

  // Diversity reason
  const hasInvested = userInvestments.some(
    (inv) => inv.product._id.toString() === product._id.toString()
  );
  if (!hasInvested) {
    reasons.push('New opportunity for portfolio diversification');
  }

  // Availability reason
  const spotsLeft = product.maxInvestors - product.currentInvestors;
  if (spotsLeft <= 5) {
    reasons.push(`Limited spots: only ${spotsLeft} remaining`);
  }

  return reasons.join('. ');
}

// Refresh recommendations for all active users (can be run as cron job)
exports.refreshAllRecommendations = async () => {
  try {
    const Investment = require('../models/Investment');
    const activeUserIds = await Investment.distinct('user');

    let successCount = 0;
    let errorCount = 0;

    for (const userId of activeUserIds) {
      try {
        await exports.generateRecommendations(userId);
        successCount++;
      } catch (error) {
        logger.error(`Error refreshing recommendations for user ${userId}:`, error);
        errorCount++;
      }
    }

    logger.info(
      `Recommendation refresh complete: ${successCount} successful, ${errorCount} errors`
    );

    return { successCount, errorCount };
  } catch (error) {
    logger.error('Error refreshing all recommendations:', error);
    throw error;
  }
};
