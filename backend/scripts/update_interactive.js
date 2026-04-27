const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// The 6 tasks we already converted to structured
const structuredTasks = [
  { id: 'C001', isInteractive: true, interactionType: 'structured' },
  { id: 'C002', isInteractive: true, interactionType: 'structured' },
  { id: 'N001', isInteractive: true, interactionType: 'structured' },
  { id: 'N002', isInteractive: true, interactionType: 'structured' },
  { id: 'S002', isInteractive: true, interactionType: 'structured' },
  { id: 'L001', isInteractive: true, interactionType: 'structured' },
];

// Critical thinking tasks - all good for dialogue
const dialogueCTTasks = [
  'CT01', 'CT02', 'CT03', 'CT04', 'CT05', 'CT06',
  'CT07', 'CT08', 'CT09', 'CT10', 'CT11', 'CT12'
];

// Game theory tasks - all good for dialogue
const dialogueGTTasks = [
  'GT01', 'GT02', 'GT03', 'GT04', 'GT05',
  'GT06', 'GT07', 'GT08', 'GT09', 'GT10'
];

async function main() {
  console.log('Updating interactive tasks...\n');

  // Update structured tasks (already have config)
  for (const task of structuredTasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        isInteractive: task.isInteractive,
        interactionType: task.interactionType,
      },
    });
    console.log(`✅ ${task.id}: marked as ${task.interactionType} interactive`);
  }

  console.log();

  // Add dialogue config for CT tasks and update
  for (const id of dialogueCTTasks) {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      console.log(`⚠️ ${id}: not found, skipping`);
      continue;
    }

    // Create dialogue config
    const systemPrompt = `你是批判性思维课程的引导老师。这一课是「${task.name}」。请按照这门课的节奏，通过提问引导用户思考，而不是直接给出答案。保持你的语气温和但有启发性。用户进来开始第一课了，请给出第一个问题。`;

    const config = {
      systemPrompt,
      initialMessage: `你好！欢迎来到批判性思维第一课：${task.name}。让我先问你一个问题：${task.question.split('\n')[0]}`,
      maxRounds: 10,
      temperature: 0.7,
    };

    await prisma.task.update({
      where: { id },
      data: {
        isInteractive: true,
        interactionType: 'dialogue',
        interactionConfig: JSON.stringify(config),
      },
    });
    console.log(`✅ ${id}: marked as dialogue interactive`);
  }

  console.log();

  // Add dialogue config for GT tasks and update
  for (const id of dialogueGTTasks) {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      console.log(`⚠️ ${id}: not found, skipping`);
      continue;
    }

    // Create dialogue config
    const systemPrompt = `你是博弈论课程的引导老师。这一课是「${task.name}」。请通过提问引导用户思考这个博弈问题，分析不同策略的收益和均衡，而不是直接给出答案。保持启发式教学，一步一步来。`;

    const config = {
      systemPrompt,
      initialMessage: `你好！今天我们来分析这个博弈问题：**${task.name}**。你怎么看这个问题？说说你的想法。`,
      maxRounds: 10,
      temperature: 0.7,
    };

    await prisma.task.update({
      where: { id },
      data: {
        isInteractive: true,
        interactionType: 'dialogue',
        interactionConfig: JSON.stringify(config),
      },
    });
    console.log(`✅ ${id}: marked as dialogue interactive`);
  }

  console.log('\n🎉 All done!');

  // Count final result
  const final = await prisma.task.findMany({ where: { isInteractive: true } });
  console.log(`\nTotal interactive tasks now: ${final.length}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
