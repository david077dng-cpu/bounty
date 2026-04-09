const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Task data extracted directly from the original HTML
const TASKS = [
  {
    id:'M001', name:'书房密室谋杀案', tier:'medium', bounty:300, cat:'悬疑推理', catIcon:'🔍',
    question: "庄园书房被发现一具尸体。书房从内部上锁，唯一的窗户从外锁死。死者手中握着一张纸条，写着\"13\"。房间内的壁钟停在3:15。现场三名嫌疑人：管家9点就寝、厨娘声称整晚在厨房、园丁说天黑后未进入庄园。法医确认死亡时间在午夜前后。\n\n请问：凶手是谁，密室是如何制造的？请给出推理过程。",
    hint:"注意：壁钟、纸条上的数字、三人的供词之间存在逻辑矛盾。",
    steps:[
      ['step','[M001] 加载悬疑推理任务...'],
      ['think','→ 分析现场线索：壁钟 3:15 · 纸条 "13" · 密室结构'],
      ['think','→ 检查三人不在场证明...'],
      ['calc', '  管家：9点就寝 → 午夜无法证实'],
      ['calc', '  厨娘：厨房整晚 → 有独立空间，不可验证'],
      ['calc', '  园丁：天黑后未入庄园 → 但未说明天黑前行动'],
      ['think','→ 分析密室机制...'],
      ['calc', '  内锁结构：线绳穿过门缝可从外拉动门闩'],
      ['think','→ 解读 "13" 的含义...'],
      ['calc', '  3:15 镜像 → 壁钟被故意拨慢制造不在场证明'],
      ['think','→ 交叉验证嫌疑人...'],
      ['warn', '  园丁供词存在时间漏洞：天黑前行动未说明'],
      ['ok',   '→ 结论：厨娘，利用线绳密室机制，壁钟为障眼法'],
      ['ok',   '[M001] 推理完成 ✓'],
    ],
    answer:"**凶手：厨娘**。密室机制：用细线穿过门缝绕过门闩，出门后拉紧使门闩落下。壁钟被故意停在3:15（镜像为12:45暗示伪造时间轴），\"13\"是提示时间倒读。厨娘离开厨房作案后返回，无人证实其整晚在场。",
    scores:{ accuracy:82, reasoning:88, creativity:75, speed:80 }
  },
  {
    id:'M002', name:'五人谎言游戏', tier:'hard', bounty:500, cat:'悬疑推理', catIcon:'🔍',
    question:"五个人只有一个说真话，其余四个都说谎：\nA说：\"B在说谎。\"\nB说：\"C和D都在说谎。\"\nC说：\"A说的是真话。\"\nD说：\"C在说谎。\"\nE说：\"B说的是真话。\"\n\n请找出那个唯一说真话的人，并证明你的推理是完备的。",
    hint:"逐一假设每个人说真话，验证是否产生逻辑矛盾。",
    steps:[
      ['step','[M002] 加载逻辑推断任务...'],
      ['think','→ 假设 A 说真话 → B在说谎 → B的陈述\"C和D都说谎\"为假 → C或D说真话 → 但只能有一人说真话，矛盾'],
      ['calc', '  A=真 → 推导矛盾，排除A'],
      ['think','→ 假设 B 说真话 → C和D都说谎 → C说\"A说真话\"为假 → A说谎 → A说\"B在说谎\"为假 → B说真话 ✓'],
      ['calc', '  B=真 → E说\"B说真话\"为真 → E也说真话 → 矛盾（两人说真话）'],
      ['think','→ 假设 C 说真话 → \"A说真话\"为真 → A也说真话 → 矛盾'],
      ['calc', '  C=真 → 推导矛盾，排除C'],
      ['think','→ 假设 D 说真话 → \"C在说谎\"为真 → C的\"A说真话\"为假 → A说谎 ✓'],
      ['calc', '  D=真 → B说谎 → B的\"C和D都说谎\"为假 → C或D说真话 → D说真话 ✓'],
      ['calc', '  继续验证：E说\"B说真话\"为假 → E说谎 ✓ · 四人均说谎 ✓'],
      ['ok',   '→ 唯一自洽解：D说真话'],
      ['ok',   '[M002] 逻辑验证完成 ✓'],
    ],
    answer:"**D说真话**。验证：D=真→C说谎→A说谎→B说谎→E说谎，B说谎说明\"C和D都说谎\"为假，即C或D说真，D=真满足，完全自洽。其余四人假设均导致矛盾。",
    scores:{ accuracy:90, reasoning:95, creativity:70, speed:75 }
  },
  {
    id:'A001', name:'最后一块拼图', tier:'easy', bounty:150, cat:'综合联想', catIcon:'🧩',
    question:"以下五个词语之间隐藏着一个共同的联系，找出它并解释：\n\n🌊 海浪　　🎵 音符　　💓 心跳　　🌾 麦穗　　😴 睡眠\n\n提示：不是表面含义，而是它们共同指向的一个抽象概念。",
    hint:"想象这五个词都在描述同一种现象的不同侧面。",
    steps:[
      ['step','[A001] 启动跨域联想引擎...'],
      ['think','→ 提取每个词的核心特征...'],
      ['calc', '  海浪：起伏、周期性、振荡'],
      ['calc', '  音符：频率、波形、节律'],
      ['calc', '  心跳：脉冲、规律、间隔'],
      ['calc', '  麦穗：随风摆动、波浪形'],
      ['calc', '  睡眠：REM周期、脑波振荡'],
      ['think','→ 寻找共同抽象层...'],
      ['ok',   '→ 共同指向：「波动 / 节律」—— 一切皆以周期振荡的形式存在'],
      ['ok',   '[A001] 联想完成 ✓'],
    ],
    answer:"它们共同指向**「波/节律」**——海浪是水的振荡，音符是空气压力的振荡，心跳是血压的振荡，麦穗是受风的振荡，睡眠是脑电波的振荡。宇宙中几乎一切现象都以\"波动\"的形式存在。",
    scores:{ accuracy:85, reasoning:80, creativity:92, speed:90 }
  },
  {
    id:'A002', name:'跨界类比挑战', tier:'medium', bounty:260, cat:'综合联想', catIcon:'🧩',
    question:"完成以下类比，并解释你的逻辑：\n\n1. 大脑之于思想，正如 _________ 之于音乐\n2. 基因之于生物进化，正如 _________ 之于文化演变\n3. 黑洞之于宇宙，正如 _________ 之于经济体系\n\n每个答案需附一句解释。",
    hint:"寻找结构上的同构关系，而非表面相似。",
    steps:[
      ['step','[A002] 启动结构同构分析...'],
      ['think','→ 分析第1题：大脑→思想的关系'],
      ['calc', '  大脑是思想的物理底层载体 → 乐器是音乐的物理底层载体'],
      ['ok',   '  答：乐器（或「乐谱」）'],
      ['think','→ 分析第2题：基因→进化的关系'],
      ['calc', '  基因是可遗传、可变异的信息单元 → meme（文化基因）是文化中可复制传播的信息单元'],
      ['ok',   '  答：meme / 文化基因'],
      ['think','→ 分析第3题：黑洞→宇宙的关系'],
      ['calc', '  黑洞是物质无法逃脱的引力奇点、吞噬周边资源 → 垄断/央行 是资本聚集的奇点'],
      ['ok',   '  答：垄断企业 或 中央银行'],
      ['ok',   '[A002] 完成 ✓'],
    ],
    answer:"1. **乐器**——大脑是思想的物理载体，乐器是音乐的物理载体；2. **Meme（文化基因）**——基因在生物层面携带可变异的遗传信息，meme在文化层面携带可传播变异的思想单元；3. **垄断企业**——黑洞以引力奇点吸噬周边物质，垄断企业以网络效应吸噬市场资源，两者都使周边系统难以逃脱。",
    scores:{ accuracy:80, reasoning:85, creativity:90, speed:78 }
  },
  {
    id:'C001', name:'找出隐藏的Bug', tier:'easy', bounty:180, cat:'代码能力', catIcon:'💻',
    question:"以下 Python 函数声称能返回列表中第二大的数字，但存在 Bug。找出所有错误并给出修正版本：\n\n```python\ndef second_largest(nums):\n    nums = list(set(nums))  # 去重\n    nums.sort()\n    return nums[-2]\n```\n\n测试用例：second_largest([3,3,3]) 会发生什么？second_largest([5]) 呢？",
    hint:"考虑边界条件：重复元素、列表长度不足。",
    steps:[
      ['step','[C001] 静态代码分析...'],
      ['calc', '  case 1: [3,3,3] → set → {3} → sort → [3] → [-2] → IndexError ❌'],
      ['calc', '  case 2: [5] → set → {5} → [-2] → IndexError ❌'],
      ['think','→ 识别 Bug：未处理去重后长度 < 2 的情况'],
      ['ok',   '→ 修复方案：去重后检查长度，不足则返回 None 或抛出自定义异常'],
      ['ok',   '[C001] 分析完成 ✓'],
    ],
    answer:"**Bug**：去重后若元素 < 2 个，`nums[-2]` 会抛出 `IndexError`。\n\n修正版本：\n```python\ndef second_largest(nums):\n    unique = sorted(set(nums), reverse=True)\n    if len(unique) < 2:\n        return None  # 或 raise ValueError\n    return unique[1]\n```",
    scores:{ accuracy:95, reasoning:90, creativity:70, speed:88 }
  },
  {
    id:'C002', name:'算法时间复杂度对决', tier:'hard', bounty:480, cat:'代码能力', catIcon:'💻',
    question:"给定一个整数数组，找出其中「和为目标值的两个数的下标」。\n\n请分别用以下三种方法实现，并分析各自的时间/空间复杂度：\n1. 暴力枚举（双重循环）\n2. 排序 + 双指针\n3. 哈希表\n\n数组：[2, 7, 11, 15, 3, 6]，目标值：9",
    hint:"注意：方法2需要记录原始下标，这会改变其空间复杂度。",
    steps:[
      ['step','[C002] 算法分析任务加载...'],
      ['calc','→ 方法1 暴力：O(n²) 时间, O(1) 空间'],
      ['calc','  枚举所有对 → [2,7]→9 ✓ 返回[0,1]'],
      ['calc','→ 方法2 双指针：O(n log n) 时间（排序）, O(n) 空间（存原始索引）'],
      ['warn','  双指针法修改了数组顺序，需要额外存储原始下标对'],
      ['calc','→ 方法3 哈希表：O(n) 时间, O(n) 空间 ← 最优'],
      ['calc','  遍历时查 {9-2=7} 是否在表中 → 发现 → 返回[0,1]'],
      ['ok',   '→ 推荐方案：哈希表（时间最优，空间可接受）'],
      ['ok',   '[C002] 完成 ✓'],
    ],
    answer:"三种方法对比：\n**1.暴力** O(n²)/O(1)；**2.双指针** O(n log n)/O(n)；**3.哈希表** O(n)/O(n)。\n\n哈希表实现：\n```python\ndef two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target-n], i]\n        seen[n] = i\n```\n输出：[0, 1]（2+7=9）",
    scores:{ accuracy:92, reasoning:88, creativity:75, speed:82 }
  },
  {
    id:'N001', name:'生日悖论', tier:'medium', bounty:240, cat:'数学基础', catIcon:'🔢',
    question:"在一个随机聚集的群体中，至少需要多少人，才能使「其中至少两人生日相同」的概率超过 50%？\n\n请不要直接给出答案，而是推导出计算公式，并解释为什么结果会让大多数人感到惊讶。",
    hint:"先计算「所有人生日都不同」的概率，再用补集。假设一年365天，忽略闰年。",
    steps:[
      ['step','[N001] 概率计算任务...'],
      ['think','→ 思路：用补集 P(至少两人同生日) = 1 - P(所有人生日不同)'],
      ['calc', '  P(所有人不同) = 365/365 × 364/365 × 363/365 × ... × (365-n+1)/365'],
      ['calc', '  n=23时：P(不同) ≈ 0.4927 → P(有相同) ≈ 0.5073 > 50%'],
      ['think','→ 为何反直觉？'],
      ['calc', '  人们直觉思考\"我与某人相同\"：P=22/365≈6%'],
      ['calc', '  实际计算\"任意两人相同\"：C(23,2)=253对，每对有1/365概率'],
      ['calc', '  253 × (1/365) ≈ 0.69，远大于直觉'],
      ['ok',   '→ 答案：23人，概率约50.7%'],
      ['ok',   '[N001] 完成 ✓'],
    ],
    answer:"只需**23人**！\n\n公式：P(有相同) = 1 − ∏(k=0 to n-1) (365-k)/365\n\nn=23时≈50.7%。\n\n**反直觉原因**：我们错误地用\"我与某人相同\"来类比，但实际上是23人中**任意两人**组合，共C(23,2)=253对，概率叠加远超预期。",
    scores:{ accuracy:88, reasoning:90, creativity:80, speed:75 }
  },
  {
    id:'N002', name:'无限旅馆悖论', tier:'hard', bounty:440, cat:'数学基础', catIcon:'🔢',
    question:"希尔伯特大饭店有无限多个房间（1号、2号、3号……），且全部住满。\n\n现在发生了三种情况，请分别说明饭店如何在不赶走任何客人的情况下安置新客人：\n1. 来了1位新客人\n2. 来了无限多位新客人（可列无穷）\n3. 来了无限多辆大巴，每辆大巴上有无限多位乘客\n\n请解释这个悖论揭示了什么数学本质。",
    hint:"关键操作：现有客人的移动规则。",
    steps:[
      ['step','[N002] 无穷集合分析...'],
      ['think','→ 情况1：1位新客'],
      ['calc', '  操作：n号房客移到n+1号 → 1号空出 → 安置新客 ✓'],
      ['think','→ 情况2：可列无穷多新客'],
      ['calc', '  操作：n号房客移到2n号（全移到偶数房） → 所有奇数房空出 → 安置无穷新客 ✓'],
      ['think','→ 情况3：无限大巴×无限乘客'],
      ['calc', '  操作：利用质数编码：原客移到2^n房，第k辆大巴第m位乘客移到p_k^m房（p_k为第k个质数）'],
      ['calc', '  由算术基本定理，质数幂次唯一，无碰撞 ✓'],
      ['think','→ 数学本质：∞+1=∞，∞×∞=∞（可列无穷的基数ℵ₀的性质）'],
      ['ok',   '[N002] 完成 ✓'],
    ],
    answer:"**情况1**：所有人移到n+1房，腾出1号。**情况2**：所有人移到2n号（偶数房），无穷奇数房空出。**情况3**：用质数编码——原客到2^n，第k辆大巴第m位到p_k^m，算术基本定理保证不冲突。\n\n**数学本质**：揭示可列无穷（ℵ₀）的自相似性——它与自身的有限倍、可列倍等势，∞+n=∞×n=∞。",
    scores:{ accuracy:85, reasoning:92, creativity:88, speed:70 }
  },
  {
    id:'S001', name:'费米估算：钢琴调音师', tier:'easy', bounty:160, cat:'自然科学', catIcon:'🔬',
    question:"芝加哥有多少位钢琴调音师？\n\n这是一道经典的费米估算题。不需要查任何资料，只需用合理假设 + 逐步推导，给出一个数量级正确的估算。",
    hint:"从芝加哥人口出发，估算钢琴数量，再估算每位调音师每年能服务多少台。",
    steps:[
      ['step','[S001] 费米估算引擎启动...'],
      ['calc', '  芝加哥人口：约300万'],
      ['calc', '  家庭平均2.5人 → 约120万户家庭'],
      ['calc', '  有钢琴的家庭比例：约1/20 → 6万台家用钢琴'],
      ['calc', '  学校/教堂/餐厅等机构：约3万台'],
      ['calc', '  合计约9万台钢琴'],
      ['calc', '  每台钢琴每年调音1次'],
      ['calc', '  调音师每天调4台，每年工作250天 → 每人年处理1000台'],
      ['calc', '  需要调音师：90000/1000 = 约90人'],
      ['ok',   '→ 估算结果：50~100人（真实答案约125人）✓'],
      ['ok',   '[S001] 完成 ✓'],
    ],
    answer:"估算约**50~100位**调音师（实际约125位）。\n\n推导：300万人→120万户→6万家用钢琴+3万机构钢琴=9万台；每台年调一次；每位调音师年处理1000台 → 需90人。数量级正确即为成功。",
    scores:{ accuracy:85, reasoning:88, creativity:82, speed:90 }
  },
  {
    id:'S002', name:'为什么天空是蓝色的', tier:'medium', bounty:200, cat:'自然科学', catIcon:'🔬',
    question:"解释「天空为什么是蓝色的」，要求：\n1. 用瑞利散射公式说明为何蓝色被散射更多\n2. 解释为什么日落时天空变红\n3. 如果地球大气层密度更高，天空会是什么颜色？\n\n答案需严谨但不失通俗。",
    hint:"瑞利散射强度与波长的四次方成反比：I ∝ 1/λ⁴",
    steps:[
      ['step','[S002] 光学物理分析...'],
      ['calc', '  瑞利散射：I ∝ 1/λ⁴'],
      ['calc', '  蓝光λ≈450nm，红光λ≈700nm'],
      ['calc', '  散射比：(700/450)⁴ ≈ 5.8倍 → 蓝光散射是红光的近6倍'],
      ['think','→ 日落：阳光穿过更厚的大气层，蓝光被散射殆尽，只剩长波红橙光'],
      ['think','→ 大气更密：散射更强，短波端紫外线也被散射 → 天空可能呈紫色'],
      ['calc', '  但人眼对紫色敏感度低于蓝色，且大气会吸收部分紫光 → 偏白或紫白色'],
      ['ok',   '[S002] 完成 ✓'],
    ],
    answer:"**1. 蓝天**：瑞利散射 I∝1/λ⁴，蓝光(450nm)比红光(700nm)散射强约6倍，蓝光被大气分子向四面八方散射，充满天空。\n\n**2. 红霞**：日落时光线斜穿更厚大气，蓝光被散射消耗殆尽，只剩长波红橙光直射眼睛。\n\n**3. 更密大气**：散射更剧烈，紫光(更短)也被大量散射，理论上天空偏紫，但因人眼对紫不敏感，可能显现为白紫色。",
    scores:{ accuracy:90, reasoning:88, creativity:78, speed:82 }
  },
  {
    id:'L001', name:'红帽子蓝帽子', tier:'easy', bounty:140, cat:'逻辑能力', catIcon:'🧠',
    question:"三个聪明人A、B、C站成一排（A在最后，能看到B和C；B在中间，能看到C；C在最前，什么都看不到）。\n\n他们头上各戴一顶帽子，帽子颜色为红色或蓝色，共有3顶红帽和2顶蓝帽。三人都知道总数。\n\n游戏开始：A看了看后说「我不知道我的帽子颜色」，B听后说「我也不知道」，C听后说「我知道了！」\n\nC头上是什么颜色的帽子？",
    hint:"A不知道 → 能推断什么？B听到A不知道，再结合自己看到的能推断什么？",
    steps:[
      ['step','[L001] 帽子逻辑推断...'],
      ['think','→ A「不知道」意味着：B和C不全是蓝色（否则A能确定自己是红色）'],
      ['calc', '  → B和C中至少有一顶红帽'],
      ['think','→ B听到后，B看向C：'],
      ['calc', '  若C是蓝帽：B知道B和C中至少一顶红，那B一定是红 → B应该知道！'],
      ['calc', '  但B说「不知道」→ C不是蓝帽'],
      ['ok',   '→ C推断：我的帽子不是蓝色 → 我是红色'],
      ['ok',   '[L001] 推断完成 ✓'],
    ],
    answer:"C的帽子是**红色**。\n\n推理链：①A不知道→B、C非全蓝；②B知道此信息，若C是蓝帽，B可推自己是红帽（从①得B和C至少一红），B会知道→但B说不知道→C非蓝；③C据此推断：自己是红色。",
    scores:{ accuracy:92, reasoning:95, creativity:70, speed:85 }
  },
  {
    id:'L002', name:'囚徒困境升级版', tier:'hard', bounty:520, cat:'逻辑能力', catIcon:'🧠',
    question:"100名囚犯，编号1-100。狱长在一个房间放了100个抽屉，每个抽屉里放着随机一名囚犯的编号（1-100的排列）。\n\n每名囚犯依次进入，最多打开**50个**抽屉，如果找到自己的编号就算成功。全部100人都成功才释放所有人，否则全部处决。\n\n囚犯可以事先商量策略，但进入房间后无法通信。直觉上成功率约(1/2)^100 ≈ 0，但有一种策略成功率超过**30%**。\n\n请描述这个策略，并解释为什么它有效。",
    hint:"想想「循环」——每个抽屉的编号指向另一个抽屉。",
    steps:[
      ['step','[L002] 组合数学分析...'],
      ['think','→ 最优策略：「循环追踪」'],
      ['calc', '  每位囚犯i：先开第i号抽屉，看到数字k，再开第k号抽屉，如此跟随循环'],
      ['think','→ 为何有效？'],
      ['calc', '  100个编号构成若干循环置换'],
      ['calc', '  囚犯i一定在自己所在的循环中 → 只要循环长度≤50，i就能找到自己'],
      ['calc', '  策略失败仅当：存在长度>50的循环（长循环中的所有人都失败）'],
      ['calc', '  P(存在长度>50的循环) = 1/51+1/52+...+1/100 ≈ ln(100)-ln(50) ≈ ln(2) ≈ 0.6931'],
      ['calc', '  P(成功) = 1 - 0.6931 ≈ 31.2%'],
      ['ok',   '→ 成功率约31.2%，远超随机策略的(1/2)^100'],
      ['ok',   '[L002] 完成 ✓'],
    ],
    answer:"**策略：循环追踪**。囚犯i先开第i号抽屉，看到编号j后开第j号，以此类推，形成追踪。\n\n**原理**：100个编号构成循环置换，每人必在自己的循环中。只要该循环长度≤50，必然成功。\n\n**失败条件**：唯有存在长度>50的循环才会导致失败。P(存在长>50循环) = Σ(1/k, k=51到100) ≈ ln2 ≈ 69%。因此**成功率≈31%**，而随机策略为(1/2)^100≈0。",
    scores:{ accuracy:88, reasoning:94, creativity:90, speed:70 }
  },
];

async function main() {
  console.log('Start seeding...');

  // Create categories first
  const categories = [
    { name: '悬疑推理', icon: '🔍' },
    { name: '综合联想', icon: '🧩' },
    { name: '代码能力', icon: '💻' },
    { name: '数学基础', icon: '🔢' },
    { name: '自然科学', icon: '🔬' },
    { name: '逻辑能力', icon: '🧠' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  console.log('Categories created');
  console.log(`Found ${TASKS.length} tasks`);

  for (const task of TASKS) {
    const category = await prisma.category.findUnique({
      where: { name: task.cat },
    });

    if (!category) {
      console.warn(`Category ${task.cat} not found, skipping task ${task.id}`);
      continue;
    }

    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: {
        id: task.id,
        name: task.name,
        tier: task.tier,
        bounty: task.bounty,
        categoryId: category.id,
        catIcon: task.catIcon,
        question: task.question,
        hint: task.hint || null,
        answer: task.answer,
        refAccuracy: task.scores.accuracy,
        refReasoning: task.scores.reasoning,
        refCreativity: task.scores.creativity,
        refSpeed: task.scores.speed,
        steps: JSON.stringify(task.steps),
      },
    });
  }

  // Seed progressive courses by difficulty
  const courses = [
    {
      name: 'Beginner: MCP Basics',
      description: 'Learn the fundamentals of Model Context Protocol (MCP) and how to use external tools with AI agents',
      difficulty: 'beginner',
      icon: '🔌',
      order: 1,
      lessons: [
        {
          title: 'What is MCP?',
          description: 'Introduction to Model Context Protocol and why it enables powerful AI agents',
          taskId: 'M001',
          order: 1,
          bounty: 50,
          isMcpTask: false,
          requiresLessonId: null,
        },
        {
          title: 'Connecting Your First MCP Server',
          description: 'Learn how to add and test an MCP server connection',
          taskId: 'M002',
          order: 2,
          bounty: 75,
          isMcpTask: true,
          requiresLessonId: null,
        },
        {
          title: 'Listing Available Tools',
          description: 'Understand how to discover and list tools from an MCP server',
          taskId: 'A001',
          order: 3,
          bounty: 100,
          isMcpTask: true,
          requiresLessonId: 2,
        },
        {
          title: 'Calling Your First Tool',
          description: 'Make your first tool call with proper JSON arguments',
          taskId: 'A002',
          order: 4,
          bounty: 125,
          isMcpTask: true,
          requiresLessonId: 3,
        },
      ],
    },
    {
      name: 'Intermediate: Tool Reasoning',
      description: 'Learn advanced techniques for reasoning about which tools to use and when',
      difficulty: 'intermediate',
      icon: '🧠',
      order: 2,
      lessons: [
        {
          title: 'Tool Selection Strategy',
          description: 'How to choose the right tool for the job',
          taskId: 'C001',
          order: 1,
          bounty: 150,
          isMcpTask: true,
          requiresLessonId: null,
        },
        {
          title: 'Chaining Multiple Tools',
          description: 'Combine multiple tool calls to solve complex problems',
          taskId: 'C002',
          order: 2,
          bounty: 200,
          isMcpTask: true,
          requiresLessonId: 5,
        },
      ],
    },
    {
      name: 'Advanced: Agent Design Patterns',
      description: 'Master ReAct, Reflection, and other advanced agent patterns with MCP',
      difficulty: 'advanced',
      icon: '🚀',
      order: 3,
      lessons: [
        {
          title: 'ReAct Pattern with MCP',
          description: 'Implement Reason + Act cycles with external tools',
          taskId: 'N001',
          order: 1,
          bounty: 250,
          isMcpTask: true,
          requiresLessonId: null,
        },
        {
          title: 'Self-Reflection on Tool Output',
          description: 'Learn to reflect on tool results and improve your answer',
          taskId: 'N002',
          order: 2,
          bounty: 300,
          isMcpTask: true,
          requiresLessonId: 7,
        },
      ],
    },
  ];

  console.log('Creating courses...');
  for (const courseData of courses) {
    const { lessons, ...course } = courseData;
    const createdCourse = await prisma.course.upsert({
      where: { id: course.order },
      update: {},
      create: course,
    });

    for (const lessonData of lessons) {
      const { requiresLessonId, ...lesson } = lessonData;
      await prisma.lesson.upsert({
        where: { id: lessonData.order + (createdCourse.id - 1) * 100 },
        update: {},
        create: {
          ...lesson,
          courseId: createdCourse.id,
          requiresLessonId,
        },
      });
    }
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
