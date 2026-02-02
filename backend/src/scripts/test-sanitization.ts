import { sanitizeInput, sanitizeOptional } from '../lib/sanitize';

console.log('🧪 Testing XSS sanitization...\n');

const testCases = [
  {
    name: 'Script tag XSS',
    input: '<script>alert("XSS")</script>',
    expected: '&lt;script&gt;alert("XSS")&lt;/script&gt;', // HTML escaped
  },
  {
    name: 'Image XSS',
    input: '<img src=x onerror=alert("XSS")>',
    expected: '&lt;img /&gt;', // HTML escaped
  },
  {
    name: 'SQL injection attempt',
    input: "Test'; DROP TABLE posts; --",
    expected: "Test'; DROP TABLE posts; --", // SQL is safe in parameterized queries
  },
  {
    name: 'Legitimate content',
    input: 'Hello world! This is a normal post.',
    expected: 'Hello world! This is a normal post.',
  },
  {
    name: 'Iframe injection',
    input: '<iframe src="evil.com"></iframe>',
    expected: '&lt;iframe&gt;&lt;/iframe&gt;', // HTML escaped
  },
  {
    name: 'Event handler XSS',
    input: '<div onclick="alert(1)">Click me</div>',
    expected: '&lt;div&gt;Click me&lt;/div&gt;', // HTML escaped
  },
  {
    name: 'SVG XSS',
    input: '<svg/onload=alert("XSS")>',
    expected: '&lt;svg&gt;', // HTML escaped
  },
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = sanitizeInput(testCase.input);
  const isPass = result === testCase.expected;

  if (isPass) {
    console.log(`✅ ${testCase.name}`);
    console.log(`   Input:    "${testCase.input}"`);
    console.log(`   Output:   "${result}"`);
    passed++;
  } else {
    console.log(`❌ ${testCase.name}`);
    console.log(`   Input:    "${testCase.input}"`);
    console.log(`   Expected: "${testCase.expected}"`);
    console.log(`   Got:      "${result}"`);
    failed++;
  }
  console.log();
}

// Test optional sanitization
console.log('Testing optional sanitization:');
console.log(`  null input: ${sanitizeOptional(null)}`);
console.log(`  undefined input: ${sanitizeOptional(undefined)}`);
console.log(`  XSS input: ${sanitizeOptional('<script>alert("XSS")</script>')}`);
console.log();

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
