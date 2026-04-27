const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Directory with fixed SVGs
  const svgDir = path.join(__dirname, '../../illustrations');

  // Update GT01 - we fixed its text overlapping issue
  const taskId = 'GT01';
  const svgPath = path.join(svgDir, `${taskId}.svg`);
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  console.log(`Updating ${taskId} in database...`);
  console.log(`SVG size: ${svgContent.length} bytes`);

  await prisma.task.update({
    where: { id: taskId },
    data: { illustration: svgContent },
  });

  console.log(`Updated ${taskId} successfully!`);

  // Check other SVGs for any obvious issues
  console.log('\nChecking other SVGs for potential issues:');

  const files = fs.readdirSync(svgDir);
  let issuesFound = 0;

  for (const file of files) {
    if (!file.endsWith('.svg')) continue;
    const id = file.replace('.svg', '');
    if (id === 'GT01') continue;

    const content = fs.readFileSync(path.join(svgDir, file), 'utf8');
    // Check for obvious problems
    let hasIssue = false;
    let issueDesc = [];

    // Check text y coordinate beyond 385 (too close to bottom edge)
    const yRegex = /y="?(\d+)/g;
    let match;
    while ((match = yRegex.exec(content)) !== null) {
      const num = parseInt(match[1]);
      if (num > 385) {
        issueDesc.push(`text near bottom at y=${num}`);
        hasIssue = true;
        break;
      }
    }

    // Check text x coordinate beyond 585 (too close to right edge)
    const xRegex = /x="?(\d+)/g;
    while ((match = xRegex.exec(content)) !== null) {
      const num = parseInt(match[1]);
      if (num > 585) {
        issueDesc.push(`text near right edge at x=${num}`);
        hasIssue = true;
        break;
      }
    }

    // Check for overlapping text in question/answer sections like GT01
    const lines = content.split('\n');
    let prevY = 0;
    for (const line of lines) {
      const yMatch = line.match(/y="?(\d+)/);
      if (yMatch) {
        const currY = parseInt(yMatch[1]);
        if (prevY && Math.abs(currY - prevY) < 10 && line.includes('<text')) {
          // Two text lines at almost same y coordinate - likely overlap
          issueDesc.push(`possible text overlap (y=${currY} near ${prevY})`);
          hasIssue = true;
          break;
        }
        prevY = currY;
      }
    }

    if (hasIssue) {
      console.log(`  ${id}: ${issueDesc.join(', ')}`);
      issuesFound++;
    }
  }

  if (issuesFound === 0) {
    console.log('  ✓ No other obvious issues found');
  }

  console.log('\nAll done!');
}

main()
  .catch(e => console.error('Error:', e))
  .finally(async () => {
    await prisma.$disconnect();
  });
