const { nanoid } = require('nanoid');

// Simulate creating 5 forms with the new shorter IDs
console.log('New Form IDs (10 characters):');
console.log('=============================');
for (let i = 1; i <= 5; i++) {
  const id = nanoid(10);
  console.log(`Form ${i}: ${id}`);
  console.log(`  Edit URL: /form/${id}/edit`);
  console.log(`  Embed URL: /embed/${id}`);
  console.log('');
}

console.log('Comparison with old format:');
console.log('===========================');
console.log('Old ID (21 chars):', nanoid());
console.log('New ID (10 chars):', nanoid(10));