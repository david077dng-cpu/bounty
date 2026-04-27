const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const SVG_DIR = './svgs';

async function main() {
  console.log('='.repeat(60));
  console.log('Update Fixed SVGs to Database');
  console.log('='.repeat(60));

  const reportPath = path.join(SVG_DIR, 'analysis-report.json');
  if (!fs.existsSync(reportPath)) {
    console.error('Error: analysis-report.json not found. Run analyze-svgs.js first.');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const filesWithIssues = report.results.filter(r => r.issueCount > 0);

  if (filesWithIssues.length === 0) {
    console.log('✓ No files with issues found. Nothing to update.');
    return;
  }

  console.log(`\nUpdating ${filesWithIssues.length} fixed SVG files...\n`);

  let updated = 0;
  let errors = 0;

  for (const result of filesWithIssues) {
    const id = result.id;
    const svgPath = path.join(SVG_DIR, `${id}.svg`);

    if (!fs.existsSync(svgPath)) {
      console.log(`⚠ ${id}: File not found - skipping`);
      errors++;
      continue;
    }

    try {
      const content = fs.readFileSync(svgPath, 'utf8');
      await prisma.task.update({
        where: { id },
        data: { illustration: content },
      });
      console.log(`✓ ${id}: Updated successfully (${content.length} bytes)`);
      updated++;
    } catch (err) {
      console.error(`✗ ${id}: Update failed - ${err.message}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Update Complete');
  console.log('='.repeat(60));
  console.log(`Successfully updated: ${updated} files`);
  console.log(`Errors: ${errors}`);

  if (errors === 0) {
    console.log('\n✓ All updates completed successfully!');
  }
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
