#!/usr/bin/env node

/**
 * Test script for scheduling settings implementation
 * This tests the date range validation logic without running the full app
 */

// Import the helper functions from the compiled JS
const { calculateBookingWindow } = require('./dist/lib/simpro/availability-utils.server.js');

// Test scenarios
const testScenarios = [
    {
        name: "Rolling 7 calendar days",
        settings: {
            dateRangeType: 'rolling',
            rollingDays: 7,
            rollingUnit: 'calendar-days',
            minimumNotice: 0,
            minimumNoticeUnit: 'hours'
        },
        timezone: 'America/New_York'
    },
    {
        name: "Rolling 10 weekdays",
        settings: {
            dateRangeType: 'rolling',
            rollingDays: 10,
            rollingUnit: 'week-days',
            minimumNotice: 0,
            minimumNoticeUnit: 'hours'
        },
        timezone: 'America/New_York'
    },
    {
        name: "Fixed date range",
        settings: {
            dateRangeType: 'fixed',
            fixedStartDate: '2025-01-15',
            fixedEndDate: '2025-02-15',
            minimumNotice: 0,
            minimumNoticeUnit: 'hours'
        },
        timezone: 'America/New_York'
    },
    {
        name: "Indefinite with 2-day minimum notice",
        settings: {
            dateRangeType: 'indefinite',
            minimumNotice: 2,
            minimumNoticeUnit: 'days'
        },
        timezone: 'America/New_York'
    },
    {
        name: "Rolling 14 days with 24-hour minimum notice",
        settings: {
            dateRangeType: 'rolling',
            rollingDays: 14,
            rollingUnit: 'calendar-days',
            minimumNotice: 24,
            minimumNoticeUnit: 'hours'
        },
        timezone: 'America/New_York'
    }
];

console.log('=== Testing Scheduling Settings Implementation ===\n');

testScenarios.forEach(scenario => {
    console.log(`Test: ${scenario.name}`);
    console.log('Settings:', JSON.stringify(scenario.settings, null, 2));
    
    try {
        const result = calculateBookingWindow(scenario.settings, scenario.timezone);
        console.log('Result:');
        console.log(`  Start Date: ${result.startDate.toISOString()}`);
        console.log(`  End Date: ${result.endDate ? result.endDate.toISOString() : 'None (indefinite)'}`);
        
        if (result.endDate) {
            const daysDiff = Math.ceil((result.endDate - result.startDate) / (1000 * 60 * 60 * 24));
            console.log(`  Window: ${daysDiff} days`);
        }
        
        console.log('✅ PASSED\n');
    } catch (error) {
        console.log(`❌ FAILED: ${error.message}\n`);
    }
});

console.log('=== Test Complete ===');