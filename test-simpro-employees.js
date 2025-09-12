#!/usr/bin/env node

// Test script to query SimPro employees directly
// This script pulls access tokens from the database and queries SimPro API

import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { eq } from 'drizzle-orm'
import * as schema from './src/database/schema.js'

const { Pool } = pg

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})
const db = drizzle(pool, { schema })

async function testSimproEmployees() {
  console.log('🔍 Testing SimPro Employee API Response\n')
  console.log('=====================================\n')
  
  try {
    // Get a SimPro account from the database
    const accounts = await db
      .select({
        userId: schema.account.userId,
        providerId: schema.account.providerId,
        accessToken: schema.account.accessToken,
        refreshToken: schema.account.refreshToken
      })
      .from(schema.account)
      .where(eq(schema.account.providerId, 'simpro'))
      .limit(1)
    
    if (accounts.length === 0) {
      console.error('❌ No SimPro accounts found in database')
      process.exit(1)
    }
    
    const account = accounts[0]
    console.log('✅ Found SimPro account for user:', account.userId)
    console.log('   Access token:', account.accessToken ? 'Present' : 'Missing')
    console.log('   Refresh token:', account.refreshToken ? 'Present' : 'Missing')
    console.log()
    
    // Get the user to find their SimPro domain/build
    const users = await db
      .select({
        simproBuildName: schema.user.simproBuildName,
        simproDomain: schema.user.simproDomain
      })
      .from(schema.user)
      .where(eq(schema.user.id, account.userId))
      .limit(1)
    
    if (users.length === 0) {
      console.error('❌ User not found')
      process.exit(1)
    }
    
    const user = users[0]
    console.log('✅ User SimPro config:')
    console.log('   Build name:', user.simproBuildName)
    console.log('   Domain:', user.simproDomain)
    console.log()
    
    // Construct the SimPro API URL
    const baseUrl = `https://${user.simproBuildName}.${user.simproDomain}`
    const employeesUrl = `${baseUrl}/api/v1.0/companies/0/employees/`
    
    console.log('📡 Calling SimPro API:')
    console.log('   URL:', employeesUrl)
    console.log()
    
    // Make the API request
    const response = await fetch(employeesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('📨 Response status:', response.status, response.statusText)
    console.log()
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API request failed:', errorText)
      process.exit(1)
    }
    
    const employees = await response.json()
    console.log('✅ Successfully fetched', employees.length, 'employees')
    console.log()
    
    // Analyze the DisplayOnSchedule field
    console.log('🔍 DisplayOnSchedule Field Analysis:')
    console.log('=====================================')
    
    if (employees.length > 0) {
      // Show the structure of the first employee
      console.log('\n📋 First Employee Structure:')
      console.log(JSON.stringify(employees[0], null, 2))
      console.log()
      
      // Check for DisplayOnSchedule field
      const hasDisplayOnSchedule = 'DisplayOnSchedule' in employees[0]
      console.log('✓ DisplayOnSchedule field present:', hasDisplayOnSchedule)
      
      if (hasDisplayOnSchedule) {
        // Count employees by DisplayOnSchedule value
        const displayOnScheduleTrue = employees.filter(e => e.DisplayOnSchedule === true).length
        const displayOnScheduleFalse = employees.filter(e => e.DisplayOnSchedule === false).length
        const displayOnScheduleUndefined = employees.filter(e => e.DisplayOnSchedule === undefined).length
        const displayOnScheduleNull = employees.filter(e => e.DisplayOnSchedule === null).length
        
        console.log('\n📊 DisplayOnSchedule Statistics:')
        console.log('   True:', displayOnScheduleTrue)
        console.log('   False:', displayOnScheduleFalse)
        console.log('   Undefined:', displayOnScheduleUndefined)
        console.log('   Null:', displayOnScheduleNull)
        
        // Show some examples
        console.log('\n📌 Sample Employees:')
        employees.slice(0, 3).forEach((emp, i) => {
          console.log(`\n   Employee ${i + 1}:`)
          console.log(`   - ID: ${emp.ID}`)
          console.log(`   - Name: ${emp.Name}`)
          console.log(`   - DisplayOnSchedule: ${emp.DisplayOnSchedule}`)
          console.log(`   - Active: ${emp.Active}`)
        })
      } else {
        console.log('\n⚠️  DisplayOnSchedule field NOT found in SimPro response!')
        console.log('\n📌 Available fields in employee object:')
        console.log(Object.keys(employees[0]).join(', '))
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the test
testSimproEmployees()