/**
 * Offline inspiration dice for writers — pure local, no network.
 */

const CONFLICTS = [
  '信任被背叛：亲近之人隐瞒了关键真相',
  '资源争夺：双方都需要同一件稀缺之物',
  '身份暴露：伪装即将被识破',
  '时间压力：必须在时限内做出不可逆选择',
  '道德困境：救一人会害另一人',
  '旧仇重燃：以为结束的恩怨再次找上门',
  '误会导致决裂：一句听错的话改变立场',
  '权力倾轧：上位者拿主角当棋子',
  '情感三角：两份真心只能选一个',
  '规则崩坏：世界法则突然失效或改写'
]

const TWISTS = [
  '所谓敌人其实是被迫的盟友',
  '关键道具是赝品，真货另有其人',
  '死者未死，目击者在撒谎',
  '胜利条件被悄悄改写',
  '主角得到的「帮助」附带诅咒',
  '反派的目标比表面更高尚',
  '回忆被篡改过',
  '预言只说对了一半',
  '盟友中有内鬼，但不是最可疑的那个',
  '成功本身会触发更大危机'
]

const SENSORY = [
  '空气里有铁锈与雨后泥土混杂的气味',
  '远处鼓声与心跳逐渐同频',
  '灯火摇晃，影子比人先一步移动',
  '舌尖尝到不该出现的甜味',
  '指尖触到的温度异常冰冷/灼热',
  '耳鸣中夹杂一句听不清的低语',
  '地面细微震动，像有巨物在地底爬行',
  '衣物沾上无法擦去的荧光粉尘',
  '天色在数息间从昼转夜',
  '人群突然安静，只剩风声'
]

const DIALOGUE = [
  '「你若早说，何至于此。」',
  '「我不是来谈判的。」',
  '「这件事，到此为止。」',
  '「你以为你赢了？」',
  '「别用那种眼神看我。」',
  '「我欠你一次，今日还清。」',
  '「走这边。别回头。」',
  '「名字不重要，重要的是你站哪边。」',
  '「再问一次——你确定？」',
  '「有些真相，知道了就不能活。」'
]

const HOOKS = [
  '章末留下一封未署名的信',
  '关键人物失踪，只留下一枚信物',
  '地图上多了一个不该存在的地点',
  '功法/系统弹出无法关闭的警告',
  '夜观天象，星位与古籍记载不符',
  '敌人递来停战条件，条件过于诱人',
  '主角发现自己被跟踪了三天',
  '一场本该胜利的战斗被第三方打断',
  '旧物中夹着一张未来日期的票据',
  '梦境与现实出现完全相同的对话'
]

const CATEGORIES = [
  { key: 'conflict', name: '冲突', icon: '⚔️', list: CONFLICTS },
  { key: 'twist', name: '反转', icon: '🔄', list: TWISTS },
  { key: 'sensory', name: '感官', icon: '🌫️', list: SENSORY },
  { key: 'dialogue', name: '对白', icon: '💬', list: DIALOGUE },
  { key: 'hook', name: '钩子', icon: '🪝', list: HOOKS }
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function listInspirationCategories() {
  return CATEGORIES.map(({ key, name, icon }) => ({ key, name, icon }))
}

export function rollInspiration(categoryKey = 'all') {
  if (categoryKey && categoryKey !== 'all') {
    const cat = CATEGORIES.find((c) => c.key === categoryKey)
    if (cat) {
      return {
        category: cat.key,
        categoryName: cat.name,
        icon: cat.icon,
        text: pick(cat.list)
      }
    }
  }
  const cat = pick(CATEGORIES)
  return {
    category: cat.key,
    categoryName: cat.name,
    icon: cat.icon,
    text: pick(cat.list)
  }
}

export function rollInspirationSet(n = 3) {
  const out = []
  const used = new Set()
  let guard = 0
  while (out.length < n && guard < 40) {
    guard++
    const item = rollInspiration('all')
    const key = item.category + ':' + item.text
    if (used.has(key)) continue
    used.add(key)
    out.push(item)
  }
  return out
}

/** Build a short insertable note for the editor */
export function formatInspirationNote(item) {
  if (!item) return ''
  return `【灵感·${item.categoryName}】${item.text}`
}

export function buildExpandPrompt(item, novelTitle = '', chapterTitle = '', contextTail = '') {
  return `请根据以下写作灵感，扩写成 120～220 字的小说场景片段（只输出正文，不要标题解释）：
灵感类型：${item.categoryName}
灵感内容：${item.text}
作品：${novelTitle || '未命名'}
章节：${chapterTitle || '当前章'}
${contextTail ? `上文参考：\n${contextTail.slice(-500)}\n` : ''}
要求：与上文文风尽量一致；可包含动作、对话或心理，但保持简洁。`
}
