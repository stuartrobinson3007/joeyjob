export default {
  // Target locales
  locales: ['en', 'es'],
  
  // Output format matching our structure
  output: 'src/i18n/locales/$LOCALE/$NAMESPACE.json',
  
  // Input files to scan
  input: 'src/**/*.{ts,tsx}',
  
  // Lexer configuration for TypeScript/React
  lexers: {
    ts: ['JavascriptLexer'],
    tsx: ['JsxLexer'],
    default: ['JavascriptLexer']
  },
  
  // Disable these separators since we use dot notation
  namespaceSeparator: ':',
  keySeparator: '.',
  
  // Translation function names to detect
  functions: ['t', 'useTranslation'],
  
  // Default namespace
  defaultNamespace: 'common',
  
  // React component support  
  componentFunctions: ['Trans'],
  
  // Default locale for fallback values
  resetDefaultValueLocale: 'en',
  
  // Sort keys alphabetically
  sort: true,
  
  // Verbose output to see what's being processed
  verbose: true,
  
  // Don't fail on warnings initially (we'll fix them)
  failOnWarnings: false,
  
  // Create old catalog backup
  createOldCatalogs: false,
  
  // Custom functions to detect (your custom hooks)
  customValueTemplate: null,
  
  // Options for JavaScript lexer
  javascriptLexer: {
    // Functions that return translation keys
    functions: ['t', 'useTranslation']
  },
  
  // Options for JSX lexer  
  jsxLexer: {
    // Translation functions to detect
    functions: ['t'],
    // Trans component attribute name
    attr: 'i18nKey',
    // React components that handle translation
    componentFunctions: ['Trans']
  }
}