import 'dotenv/config'
import { db } from '../src/lib/db/db'
import { todos, user, organization, member } from '../src/database/schema'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'

const todoTitles = [
  'Review quarterly budget report',
  'Update project documentation',
  'Schedule team meeting',
  'Fix bug in authentication flow',
  'Implement new dashboard feature',
  'Write unit tests for API endpoints',
  'Optimize database queries',
  'Review pull request',
  'Update deployment scripts',
  'Create user onboarding guide',
  'Refactor legacy code',
  'Set up monitoring alerts',
  'Design new landing page',
  'Conduct code review',
  'Research new technology stack',
  'Plan sprint retrospective',
  'Update CI/CD pipeline',
  'Create backup strategy',
  'Implement caching layer',
  'Write technical blog post',
  'Analyze performance metrics',
  'Update security patches',
  'Configure load balancer',
  'Create API documentation',
  'Implement search functionality',
  'Review system architecture',
  'Set up testing environment',
  'Create deployment checklist',
  'Update error handling',
  'Implement logging system',
  'Review user feedback',
  'Plan product roadmap',
  'Create design mockups',
  'Test cross-browser compatibility',
  'Update dependencies',
  'Implement rate limiting',
  'Create data migration script',
  'Review security vulnerabilities',
  'Set up development environment',
  'Create technical specifications'
]

const descriptions = [
  'This task requires immediate attention and should be completed by the end of the week.',
  'Please review all related documentation before starting this task.',
  'Coordinate with the team before implementing these changes.',
  'Make sure to follow the established coding standards.',
  'This is a high-priority item that affects multiple systems.',
  'Consider the performance implications of this change.',
  'Ensure backward compatibility is maintained.',
  'Document all changes thoroughly for future reference.',
  'Test in staging environment before deploying to production.',
  'Review with stakeholders before finalizing.',
  null,
  null,
  null
]

const priorities: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high']

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function getRandomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function seedTodos() {
  try {
    console.log('🌱 Starting todo seeding process...')
    
    // Use provided organization and user IDs
    const orgId = 'QusCh8Bc4n4t98C2Dpa71Pjj2EAiqc9f'
    const userId = 'gkJm4zjuCPVTbnIvKdtmWEA0r5Fz2P6V'
    
    // Verify organization exists
    const orgs = await db.select().from(organization).where(eq(organization.id, orgId))
    if (orgs.length === 0) {
      console.error(`❌ Organization with ID ${orgId} not found.`)
      process.exit(1)
    }
    const org = orgs[0]
    console.log(`✅ Found organization: ${org.name}`)
    
    // Verify user exists
    const users = await db.select().from(user).where(eq(user.id, userId))
    if (users.length === 0) {
      console.error(`❌ User with ID ${userId} not found.`)
      process.exit(1)
    }
    const currentUser = users[0]
    console.log(`✅ Found user: ${currentUser.name}`)
    
    // For variety, we'll use this single user for all todos but vary the assignee
    const members = [{ userId, userName: currentUser.name, userEmail: currentUser.email }]
    
    // Create 500 todos
    const todosToCreate = []
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const sixMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate())
    
    for (let i = 0; i < 500; i++) {
      const createdAt = getRandomDate(oneYearAgo, now)
      const creator = getRandomElement(members)
      const isCompleted = Math.random() < 0.3 // 30% chance of being completed
      const hasAssignee = Math.random() < 0.7 // 70% chance of having an assignee
      const hasDueDate = Math.random() < 0.6 // 60% chance of having a due date
      
      todosToCreate.push({
        id: nanoid(),
        title: getRandomElement(todoTitles) + ` #${i + 1}`,
        description: getRandomElement(descriptions),
        organizationId: orgId,
        createdBy: creator.userId,
        assignedTo: hasAssignee ? getRandomElement(members).userId : null,
        completed: isCompleted,
        priority: getRandomElement(priorities),
        dueDate: hasDueDate ? getRandomDate(now, sixMonthsFromNow) : null,
        createdAt: createdAt,
        updatedAt: isCompleted ? getRandomDate(createdAt, now) : createdAt
      })
      
      if ((i + 1) % 50 === 0) {
        console.log(`📝 Created ${i + 1} todos...`)
      }
    }
    
    // Insert todos in batches of 50
    console.log('💾 Inserting todos into database...')
    for (let i = 0; i < todosToCreate.length; i += 50) {
      const batch = todosToCreate.slice(i, i + 50)
      await db.insert(todos).values(batch)
      console.log(`✅ Inserted batch ${Math.floor(i / 50) + 1}/${Math.ceil(todosToCreate.length / 50)}`)
    }
    
    console.log('🎉 Successfully seeded 500 todos!')
    
    // Show summary
    const completedCount = todosToCreate.filter(t => t.completed).length
    const highPriorityCount = todosToCreate.filter(t => t.priority === 'high').length
    const mediumPriorityCount = todosToCreate.filter(t => t.priority === 'medium').length
    const lowPriorityCount = todosToCreate.filter(t => t.priority === 'low').length
    const withDueDateCount = todosToCreate.filter(t => t.dueDate).length
    
    console.log('\n📊 Summary:')
    console.log(`  Total todos: 500`)
    console.log(`  Completed: ${completedCount}`)
    console.log(`  Pending: ${500 - completedCount}`)
    console.log(`  High priority: ${highPriorityCount}`)
    console.log(`  Medium priority: ${mediumPriorityCount}`)
    console.log(`  Low priority: ${lowPriorityCount}`)
    console.log(`  With due dates: ${withDueDateCount}`)
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding todos:', error)
    process.exit(1)
  }
}

// Run the seeding function
seedTodos()