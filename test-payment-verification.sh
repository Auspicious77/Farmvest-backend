#!/bin/bash

# Paystack Payment Verification Test
# This script tests the complete payment flow with the fixed status enum

echo "🧪 Paystack Payment Verification Test"
echo "======================================"
echo ""

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MGY3YWQ4NzVkZTYzYjhmODQwZDM3YSIsImlhdCI6MTc2NDQwNTI4NiwiZXhwIjoxNzY1MDEwMDg2fQ.-mHKH34yg-8aoBH6dlXA4bF2xI1zRW9qKbFaFBLufaQ"
API_URL="http://localhost:5001/api/v1"

echo "Step 1: Initialize Payment"
echo "-------------------------"
RESPONSE=$(curl -s -X POST "$API_URL/wallet/fund/paystack" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 1000}')

REFERENCE=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data']['reference'])" 2>/dev/null)
AUTH_URL=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data']['authorizationUrl'])" 2>/dev/null)

echo "✅ Payment initialized"
echo "   Reference: $REFERENCE"
echo "   Authorization URL: $AUTH_URL"
echo ""

echo "Step 2: Payment Instructions"
echo "-------------------------"
echo "⚠️  MANUAL ACTION REQUIRED:"
echo ""
echo "1. Open this URL in your browser:"
echo "   $AUTH_URL"
echo ""
echo "2. Complete payment with test card:"
echo "   Card: 4084 0840 8408 4081"
echo "   Expiry: 01/30 (any future date)"
echo "   CVV: 408"
echo "   PIN: 0000"
echo "   OTP: 123456"
echo ""
echo "3. After payment is successful, press Enter to continue verification..."
read -p ""

echo ""
echo "Step 3: Verify Payment"
echo "---------------------"
VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/wallet/verify-payment" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"reference\": \"$REFERENCE\"}")

SUCCESS=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null)
MESSAGE=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('message', 'Unknown'))" 2>/dev/null)

if [ "$SUCCESS" == "True" ]; then
  echo "✅ Payment verified successfully!"
  echo "   Message: $MESSAGE"
  
  NEW_BALANCE=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('newBalance', 'N/A'))" 2>/dev/null)
  echo "   New Balance: ₦$NEW_BALANCE"
else
  echo "❌ Verification failed"
  echo "   Message: $MESSAGE"
  echo ""
  echo "Full response:"
  echo "$VERIFY_RESPONSE" | python3 -m json.tool
fi

echo ""
echo "Step 4: Check Transaction Status"
echo "-------------------------------"
curl -s "$API_URL/wallet/transactions" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
transactions = data.get('data', {}).get('transactions', [])
if transactions:
    latest = transactions[0]
    print(f\"Latest Transaction:\")
    print(f\"   Reference: {latest.get('reference')}\")
    print(f\"   Amount: ₦{latest.get('amount')}\")
    print(f\"   Status: {latest.get('status')}\")
    print(f\"   Type: {latest.get('type')}\")
else:
    print('No transactions found')
"

echo ""
echo "======================================"
echo "✅ Test Complete!"
echo ""
