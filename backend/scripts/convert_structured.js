const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// C001: 找出隐藏的Bug - already has the fill-in question we saw
const c001Config = {
  title: '找出隐藏的Bug',
  description: '找出 Python 代码中的 Bug 并修复',
  randomizeQuestions: false,
  passThreshold: 80,
  questions: [
    {
      id: 'q1',
      type: 'single',
      question: '给定代码：\n```python\ndef second_largest(nums):\n    nums = list(set(nums))  # 去重\n    nums.sort()\n    return nums[-2]\n```\n这个函数最可能在什么输入下崩溃？',
      points: 10,
      options: [
        { id: 'a', text: 'second_largest([1, 2, 3])', correct: false },
        { id: 'b', text: 'second_largest([3, 3, 3])', correct: false },
        { id: 'c', text: 'second_largest([5])', correct: false },
        { id: 'd', text: 'B 和 C 都会崩溃', correct: true },
      ],
    },
    {
      id: 'q2',
      type: 'fill',
      question: '修复后的函数，对于 `second_largest([3, 3, 3])` 应该返回____。对于 `second_largest([5])` 应该返回____。',
      points: 20,
      blanks: [
        { id: '1', answer: 'None|null', placeholder: 'result' },
        { id: '2', answer: 'None|null', placeholder: 'result' },
      ],
    },
  ],
};

// C002: 算法时间复杂度对决
const c002Config = {
  title: '算法时间复杂度对决',
  description: '判断以下算法的时间复杂度',
  randomizeQuestions: true,
  passThreshold: 70,
  questions: [
    {
      id: 'q1',
      type: 'single',
      question: '二分查找算法的时间复杂度是？',
      points: 10,
      options: [
        { id: 'a', text: 'O(n)', correct: false },
        { id: 'b', text: 'O(n log n)', correct: false },
        { id: 'c', text: 'O(log n)', correct: true },
        { id: 'd', text: 'O(1)', correct: false },
      ],
    },
    {
      id: 'q2',
      type: 'single',
      question: '快速排序平均情况下的时间复杂度是？',
      points: 10,
      options: [
        { id: 'a', text: 'O(n)', correct: false },
        { id: 'b', text: 'O(n log n)', correct: true },
        { id: 'c', text: 'O(n^2)', correct: false },
        { id: 'd', text: 'O(log n)', correct: false },
      ],
    },
    {
      id: 'q3',
      type: 'single',
      question: '哈希表查找的平均时间复杂度是？',
      points: 10,
      options: [
        { id: 'a', text: 'O(1)', correct: true },
        { id: 'b', text: 'O(log n)', correct: false },
        { id: 'c', text: 'O(n)', correct: false },
        { id: 'd', text: 'O(n log n)', correct: false },
      ],
    },
    {
      id: 'q4',
      type: 'multiple',
      question: '下列哪些排序算法的最坏时间复杂度是 O(n log n)？',
      points: 20,
      minSelected: 2,
      maxSelected: 3,
      options: [
        { id: 'a', text: '快速排序', correct: false },
        { id: 'b', text: '归并排序', correct: true },
        { id: 'c', text: '堆排序', correct: true },
        { id: 'd', text: '希尔排序', correct: false },
      ],
    },
  ],
};

// N001: 生日悖论
const n001Config = {
  title: '生日悖论',
  description: '关于生日悖论的基础知识问答',
  randomizeQuestions: false,
  passThreshold: 60,
  questions: [
    {
      id: 'q1',
      type: 'single',
      question: '在一个房间里，要有多少人，才能让至少两个人生日相同的概率达到 50%？',
      points: 15,
      options: [
        { id: 'a', text: '127', correct: false },
        { id: 'b', text: '65', correct: false },
        { id: 'c', text: '23', correct: true },
        { id: 'd', text: '183', correct: false },
      ],
    },
    {
      id: 'q2',
      type: 'single',
      question: '生日悖论的本质原因是？',
      points: 15,
      options: [
        { id: 'a', text: '计算错误', correct: false },
        { id: 'b', text: '闰年影响', correct: false },
        { id: 'c', text: '我们问的是「任意两个人」而不是「特定某个人」', correct: true },
        { id: 'd', text: '生日分布不均匀', correct: false },
      ],
    },
    {
      id: 'q3',
      type: 'fill',
      question: '要让至少两个人生日相同的概率达到 99%，需要____人。',
      points: 10,
      blanks: [
        { id: '1', answer: '70|75', placeholder: '人数' },
      ],
    },
  ],
};

// N002: 无限旅馆悖论
const n002Config = {
  title: '无限旅馆悖论',
  description: '关于希尔伯特无限旅馆悖论的问答',
  randomizeQuestions: false,
  passThreshold: 70,
  questions: [
    {
      id: 'q1',
      type: 'single',
      question: '在希尔伯特旅馆中，旅馆已经住满了无限多个客人，现在来了一个新客人，经理应该怎么安排？',
      points: 15,
      options: [
        { id: 'a', text: '无法安排，已经满了', correct: false },
        { id: 'b', text: '让每个客人搬到 n+1 号房间，腾出 1 号房间', correct: true },
        { id: 'c', text: '放在走廊', correct: false },
        { id: 'd', text: '合并两个人到一个房间', correct: false },
      ],
    },
    {
      id: 'q2',
      type: 'single',
      question: '如果来了无限多个新客人，应该怎么安排？',
      points: 15,
      options: [
        { id: 'a', text: '无法安排', correct: false },
        { id: 'b', text: '原客人搬到 2n 号房间，腾出奇数号房间给新客人', correct: true },
        { id: 'c', text: '每层楼增加一层', correct: false },
        { id: 'd', text: '让新客人站着', correct: false },
      ],
    },
    {
      id: 'q3',
      type: 'fill',
      question: '无限集合____和它的真子集大小相等。（填「能」或「不能」）',
      points: 10,
      blanks: [
        { id: '1', answer: '能|可以', placeholder: '能/不能' },
      ],
    },
  ],
};

// S002: 为什么天空是蓝色的
const s002Config = {
  title: '为什么天空是蓝色的',
  description: '关于瑞利散射的问答',
  randomizeQuestions: false,
  passThreshold: 70,
  questions: [
    {
      id: 'q1',
      type: 'single',
      question: '瑞利散射强度和波长的关系是？',
      points: 10,
      options: [
        { id: 'a', text: 'I ∝ 1/λ', correct: false },
        { id: 'b', text: 'I ∝ 1/λ²', correct: false },
        { id: 'c', text: 'I ∝ 1/λ⁴', correct: true },
        { id: 'd', text: 'I ∝ λ', correct: false },
      ],
    },
    {
      id: 'q2',
      type: 'fill',
      question: '瑞利散射告诉我们，____波长的光散射更强。（填「较短」或「较长」）',
      points: 10,
      blanks: [
        { id: '1', answer: '较短|短', placeholder: '较短/较长' },
      ],
    },
    {
      id: 'q3',
      type: 'single',
      question: '为什么日落时天空看起来是红色的？',
      points: 15,
      options: [
        { id: 'a', text: '太阳光变红了', correct: false },
        { id: 'b', text: '短波蓝光被散射殆尽，只剩长波红光', correct: true },
        { id: 'c', text: '反射红光', correct: false },
        { id: 'd', text: '大气吸收红光', correct: false },
      ],
    },
  ],
};

// L001: 红帽子蓝帽子
const l001Config = {
  title: '红帽子蓝帽子',
  description: '经典逻辑推理题',
  randomizeQuestions: false,
  passThreshold: 100,
  questions: [
    {
      id: 'q1',
      type: 'fill',
      question: '三个人戴帽子，三顶帽子里有____顶红帽____顶蓝帽。',
      points: 10,
      blanks: [
        { id: '1', answer: '3', placeholder: '' },
        { id: '2', answer: '2', placeholder: '' },
      ],
    },
    {
      id: 'q2',
      type: 'single',
      question: '最后一个人（C）不知道自己帽子颜色，说明：',
      points: 15,
      options: [
        { id: 'a', text: 'A 和 B 都是蓝帽子', correct: false },
        { id: 'b', text: 'A 和 B 不都是蓝帽子', correct: true },
        { id: 'c', text: 'A 一定是红帽子', correct: false },
        { id: 'd', text: 'B 一定是红帽子', correct: false },
      ],
    },
    {
      id: 'q3',
      type: 'single',
      question: '最终 C 不知道，B 听到后还是不知道，说明：',
      points: 15,
      options: [
        { id: 'a', text: 'A 一定是蓝帽子', correct: false },
        { id: 'b', text: 'A 一定是红帽子', correct: true },
        { id: 'c', text: 'C 一定是红帽子', correct: false },
        { id: 'd', text: '无法得出结论', correct: false },
      ],
    },
    {
      id: 'q4',
      type: 'fill',
      question: '因此，____帽子一定是红色。',
      points: 10,
      blanks: [
        { id: '1', answer: 'A|a', placeholder: '谁的' },
      ],
    },
  ],
};

async function main() {
  const tasks = [
    { id: 'C001', config: c001Config },
    { id: 'C002', config: c002Config },
    { id: 'N001', config: n001Config },
    { id: 'N002', config: n002Config },
    { id: 'S002', config: s002Config },
    { id: 'L001', config: l001Config },
  ];

  console.log('Updating structured tasks...\n');

  for (const { id, config } of tasks) {
    await prisma.task.update({
      where: { id },
      data: {
        interactionConfig: JSON.stringify(config),
      },
    });
    console.log(`✅ ${id}: saved structured config with ${config.questions.length} questions`);
  }

  console.log('\n🎉 All done!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
