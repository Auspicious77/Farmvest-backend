# Farm-Invest Price Model

## Overview
This document explains how product pricing works in the Farm-Invest platform.

## Price Types

### 1. Unit Price (Base Price)
- **Field**: `product.unitPrice`
- **Description**: The original listing price when the product was first created
- **Characteristics**:
  - Remains constant throughout the product's lifecycle
  - Used as a reference point for calculating percentage changes
  - Stored for historical comparison

### 2. Current Price (Market Price)
- **Field**: `product.currentPrice`
- **Description**: The current market price that changes as admin updates performance
- **Characteristics**:
  - Updated by admin via `updateProductPerformance` endpoint
  - Reflects the current market value of the product
  - **This is the price new investors pay when creating investments**
  - Used to calculate ROI for existing investors

## Investment Creation Flow

When a new investor creates an investment:

1. **Entry Price Determination**:
   ```javascript
   const investorBasePrice = product.currentPrice && product.currentPrice > 0 
     ? product.currentPrice 
     : product.unitPrice;
   ```
   - New investors ALWAYS pay the `currentPrice` (market price)
   - Falls back to `unitPrice` only if `currentPrice` is not set

2. **Total Investment Calculation**:
   ```javascript
   const totalInvestment = quantity * investorBasePrice;
   ```

3. **Investment Record**:
   - `investment.unitPrice`: The price at which the investor entered (currentPrice at time of investment)
   - `investment.currentUnitPrice`: Updated as market price changes
   - `investment.totalInvestment`: Total amount invested (quantity × entry price)

## Price Update Flow

When admin updates the price:

1. **Product Update**:
   - `product.currentPrice` is updated to the new market price
   - `product.unitPrice` remains unchanged
   - Price history is recorded with percentage change from base price

2. **Existing Investments Update**:
   - All active investments for the product are updated
   - `investment.currentUnitPrice` is updated to the new price
   - `investment.currentValue` is recalculated
   - ROI is calculated based on: (currentPrice - entry price) / entry price

3. **Platform Revenue**:
   - Platform takes 20% of gross ROI as fee
   - Revenue is only recorded when there's actual profit (price increase)

## Example Scenario

### Product Creation
- Product listed with `unitPrice = ₦100,000`
- Initial `currentPrice = ₦100,000`

### Investor A Invests (Day 1)
- Entry price: ₦100,000 (currentPrice)
- Quantity: 10 units
- Total investment: ₦1,000,000

### Admin Updates Price (Day 30)
- New `currentPrice = ₦120,000`
- `unitPrice` still ₦100,000 (unchanged)
- Investor A's ROI: (₦120,000 - ₦100,000) / ₦100,000 = 20%
- Investor A's current value: 10 × ₦120,000 = ₦1,200,000

### Investor B Invests (Day 31)
- Entry price: ₦120,000 (currentPrice - NEW market price)
- Quantity: 10 units
- Total investment: ₦1,200,000
- Investor B starts with 0% ROI

### Admin Updates Price Again (Day 60)
- New `currentPrice = ₦150,000`
- Investor A's ROI: (₦150,000 - ₦100,000) / ₦100,000 = 50%
- Investor B's ROI: (₦150,000 - ₦120,000) / ₦120,000 = 25%

## Important Notes

1. **Price Consistency**: New investors always pay the current market price, not the original listing price.

2. **Fair Market Value**: This ensures fair pricing - new investors don't get an advantage by paying old prices in an appreciating market.

3. **ROI Calculation**: Each investor's ROI is relative to their entry price, not the original base price.

4. **Transaction Records**: The transaction metadata stores:
   - `unitPrice`: The actual price paid (currentPrice at time of investment)
   - `basePrice`: Original base price (for reference)
   - `currentPrice`: Market price at time of investment

5. **UI Display**: 
   - Show `currentPrice` as the investment price to new investors
   - Show `unitPrice` as "Original Price" or "Base Price" for reference
   - Calculate percentage change: `((currentPrice - unitPrice) / unitPrice) * 100`

## API Endpoints

### Create Investment
- **Endpoint**: `POST /api/v1/investments`
- **Price Used**: `product.currentPrice` (falls back to `product.unitPrice`)

### Update Product Performance
- **Endpoint**: `PUT /api/v1/admin/products/:id/performance`
- **Updates**: `product.currentPrice` (not `product.unitPrice`)
- **Recalculates**: All active investment values and ROI

### Get Product Details
- **Endpoint**: `GET /api/v1/products/:id`
- **Returns**: Both `unitPrice` and `currentPrice`
- **Mobile App Should Display**: `currentPrice` as the investment price
