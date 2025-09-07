const fs = require('fs');
const path = require('path');

module.exports = {
  // Input source files
  input: [
    'src/**/*.{tsx,ts}',
    // Exclude specific files/patterns
    '!src/**/*.d.ts',
    '!src/i18n/**/*',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
  ],

  // Output configuration
  output: './src/i18n/locales',
  
  options: {
    // Remove unused keys
    removeUnusedKeys: false,
    
    // Sort keys alphabetically
    sort: true,
    
    // Custom function to generate translation keys
    func: {
      // Define translation functions to look for
      list: ['t', 'i18n.t', 'tCommon', 'tNotifications'],
      
      // Key extraction extensions
      extensions: ['.tsx', '.ts'],
    },
    
    // Translation function options
    trans: {
      component: 'Trans',
      i18nKey: 'i18nKey',
      defaultsKey: 'defaults',
      extensions: ['.tsx', '.ts'],
      fallbackKey: function(ns, value) {
        return value;
      },
      
      // Support for translation function variations
      acorn: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    
    // Language and namespace configuration
    lngs: ['en', 'es'],
    defaultLng: 'en',
    defaultValue: function(lng, ns, key, options) {
      if (lng === 'en') {
        // Return the key itself for English as a placeholder
        return key;
      }
      // For other languages, return empty string to be filled
      return '';
    },
    
    // Resource configuration
    resource: {
      // Output format
      loadPath: '{{lng}}/{{ns}}.json',
      savePath: '{{lng}}/{{ns}}.json',
      
      // JSON formatting
      jsonIndent: 2,
      lineEnding: '\n',
    },
    
    // Namespace configuration
    nsSeparator: ':',
    keySeparator: '.',
    
    // Interpolation format
    interpolation: {
      prefix: '{{',
      suffix: '}}',
    },
  },

  // Custom transform function to catch more patterns
  transform: function transform(file, enc, done) {
    const parser = this.parser;
    const content = fs.readFileSync(file.path, enc);
    
    // Standard parsing
    parser.parseFuncFromString(content, { 
      list: ['t', 'i18n.t', 'tCommon', 'tNotifications'],
    }, (key, options) => {
      const defaultKey = key.replace(/[:.]/g, '_');
      parser.set(defaultKey, key);
    });

    // Custom pattern matching for hardcoded strings
    const patterns = [
      // JSX text content
      />([^<{]*[A-Za-z]{3,}[^<}]*)</g,
      // Placeholder attributes
      /placeholder=["']([^"']*[A-Za-z]{3,}[^"']*)["']/g,
      // Aria labels
      /aria-label=["']([^"']*[A-Za-z]{3,}[^"']*)["']/g,
      // Title attributes
      /title=["']([^"']*[A-Za-z]{3,}[^"']*)["']/g,
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const text = match[1];
        if (text && text.length > 2 && !text.includes('t(')) {
          // Generate a key from the text
          const key = text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
          
          if (key.length > 2) {
            parser.set(`hardcoded.${key}`, text);
          }
        }
      }
    });

    done();
  },
};