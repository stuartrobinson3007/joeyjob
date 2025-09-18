import { createServerFn } from '@tanstack/react-start'
import { readFileSync } from 'fs'
import { join } from 'path'
import { marked } from 'marked'

/**
 * Server function to read and process the Terms of Service markdown file
 * This function runs only on the server and returns processed HTML
 */
export const getTermsOfService = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ html: string; lastUpdated: string }> => {
    try {
      // Read the markdown file from the project root
      const termsPath = join(process.cwd(), 'TERMS_OF_SERVICE.md')
      const markdownContent = readFileSync(termsPath, 'utf-8')

      // Configure marked for secure HTML output
      marked.setOptions({
        breaks: true,
        gfm: true,
      })

      // Convert markdown to HTML
      const html = await marked(markdownContent)

      // Extract the last updated date from the markdown content
      const lastUpdatedMatch = markdownContent.match(/\*\*Last Updated:\*\* (.+)/i)
      const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1] : 'Not specified'

      return {
        html,
        lastUpdated
      }
    } catch (error) {
      console.error('Error reading Terms of Service:', error)
      throw new Error('Unable to load Terms of Service')
    }
  })