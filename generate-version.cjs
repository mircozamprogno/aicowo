// Rename your file from generate-version.js to generate-version.cjs


const fs = require('fs');
const path = require('path');

try {
  const versionInfo = {
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || 'unknown').substring(0, 7),
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE || 'No message available',
    buildDate: new Date().toISOString(),
    branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown'
  };

  // Ensure public directory exists
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Write version info to public directory
  fs.writeFileSync(
    path.join(publicDir, 'version.json'), 
    JSON.stringify(versionInfo, null, 2)
  );

  console.log('✅ Version info generated successfully:');
  console.log('   Commit:', versionInfo.commit);
  console.log('   Message:', versionInfo.message);
  console.log('   Branch:', versionInfo.branch);
  
} catch (error) {
  console.error('❌ Error generating version info:', error);
  
  // Create fallback version file
  const fallbackInfo = {
    commit: 'error',
    message: 'Version generation failed',
    buildDate: new Date().toISOString(),
    branch: 'unknown'
  };
  
  try {
    fs.writeFileSync('./public/version.json', JSON.stringify(fallbackInfo, null, 2));
  } catch (writeError) {
    console.error('Failed to write fallback version file:', writeError);
  }
}