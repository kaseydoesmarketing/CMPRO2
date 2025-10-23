#!/bin/bash

# CMPRO2 Production Validation Script
# This script validates the deployed application

echo "🔍 CMPRO2 Production Validation"
echo "================================"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print results
print_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Get URLs from user
echo ""
read -p "Enter Backend URL (e.g., https://xxx.railway.app): " BACKEND_URL
read -p "Enter Frontend URL (e.g., https://xxx.vercel.app): " FRONTEND_URL

# Remove trailing slashes
BACKEND_URL=${BACKEND_URL%/}
FRONTEND_URL=${FRONTEND_URL%/}

echo ""
echo "Testing Configuration:"
echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# 1. Backend Health Check
echo "📡 Backend Tests"
echo "----------------"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/health" 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    print_pass "Health endpoint responding (HTTP $HTTP_CODE)"
    if echo "$RESPONSE_BODY" | grep -q '"ok":true'; then
        print_pass "Health check returns valid JSON"
    else
        print_fail "Health check JSON invalid: $RESPONSE_BODY"
    fi
else
    print_fail "Health endpoint failed (HTTP $HTTP_CODE)"
fi

# 2. Clone Endpoint Test
echo ""
echo "🔄 Clone Endpoint Test"
echo "----------------------"

CLONE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/clone/scan" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' \
  -w "\n%{http_code}" \
  --max-time 30 2>/dev/null)

HTTP_CODE=$(echo "$CLONE_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_pass "Clone endpoint responding (HTTP $HTTP_CODE)"
    RESPONSE_BODY=$(echo "$CLONE_RESPONSE" | head -n-1)

    # Check for required fields
    if echo "$RESPONSE_BODY" | grep -q '"success":true'; then
        print_pass "Clone returns success status"
    else
        print_fail "Clone missing success status"
    fi

    if echo "$RESPONSE_BODY" | grep -q '"template"'; then
        print_pass "Clone returns template data"
    else
        print_fail "Clone missing template data"
    fi

    if echo "$RESPONSE_BODY" | grep -q '"version":"0.4"'; then
        print_pass "Template uses correct Elementor version"
    else
        print_fail "Template version mismatch"
    fi
else
    print_fail "Clone endpoint failed (HTTP $HTTP_CODE)"
fi

# 3. CORS Test
echo ""
echo "🌐 CORS Configuration"
echo "--------------------"

CORS_RESPONSE=$(curl -s -I -X OPTIONS "$BACKEND_URL/api/health" \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: GET" 2>/dev/null)

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    print_pass "CORS headers present"
else
    print_fail "CORS headers missing"
fi

# 4. Frontend Tests
echo ""
echo "🎨 Frontend Tests"
echo "-----------------"

# Check if frontend is accessible
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    print_pass "Frontend accessible (HTTP $FRONTEND_RESPONSE)"
else
    print_fail "Frontend not accessible (HTTP $FRONTEND_RESPONSE)"
fi

# Check if frontend has necessary assets
FRONTEND_HTML=$(curl -s "$FRONTEND_URL" 2>/dev/null)
if echo "$FRONTEND_HTML" | grep -q "CloneMentor"; then
    print_pass "Frontend loads application content"
else
    print_fail "Frontend missing application content"
fi

# 5. Performance Tests
echo ""
echo "⚡ Performance Tests"
echo "--------------------"

# Test backend response time
START_TIME=$(date +%s%3N)
curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))

if [ $RESPONSE_TIME -lt 1000 ]; then
    print_pass "Backend response time: ${RESPONSE_TIME}ms"
else
    print_fail "Backend slow response: ${RESPONSE_TIME}ms"
fi

# 6. Security Tests
echo ""
echo "🔒 Security Tests"
echo "-----------------"

# Check for security headers
SECURITY_HEADERS=$(curl -s -I "$BACKEND_URL/api/health" 2>/dev/null)

if echo "$SECURITY_HEADERS" | grep -qi "X-Content-Type-Options"; then
    print_pass "X-Content-Type-Options header present"
else
    print_info "X-Content-Type-Options header missing (recommended)"
fi

if echo "$SECURITY_HEADERS" | grep -qi "X-Frame-Options"; then
    print_pass "X-Frame-Options header present"
else
    print_info "X-Frame-Options header missing (recommended)"
fi

# 7. Integration Test
echo ""
echo "🔗 Integration Test"
echo "-------------------"

print_info "Testing end-to-end flow..."

# This would require browser automation or manual testing
print_info "Manual test required: Visit $FRONTEND_URL and test cloning a website"

# Results Summary
echo ""
echo "================================"
echo "📊 VALIDATION RESULTS"
echo "================================"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo "The application is ready for production use."
else
    echo ""
    echo -e "${YELLOW}⚠ Some tests failed. Please review and fix before production use.${NC}"
fi

echo ""
echo "📝 Manual Testing Checklist:"
echo "----------------------------"
echo "[ ] Visit $FRONTEND_URL"
echo "[ ] Enter a test URL (e.g., https://example.com)"
echo "[ ] Verify scanning animation works"
echo "[ ] Verify Elementor JSON is generated"
echo "[ ] Download the template file"
echo "[ ] Import template into WordPress Elementor"
echo "[ ] Verify template renders correctly"
echo ""
echo "Production URLs:"
echo "Backend API: $BACKEND_URL"
echo "Frontend App: $FRONTEND_URL"
echo "Health Check: $BACKEND_URL/api/health"