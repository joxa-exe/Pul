const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

// ===== CONFIG =====
const BOT_TOKEN = '8466964240:AAFnraSAV1Dif2rzj76E6-OWum2bhgNFJFk';
const ADMIN_IDS = [6499472207, 8309765828];  // admin ID
const CHANNELS = ['GOJO_SHOP_ROBLOX']; // majburiy obuna kanallar
// ===== ANTI FLOOD =====
const floodMap = {};
const FLOOD_LIMIT = 4;   // 5 soniyada nechta xabar ruxsat
const FLOOD_TIME = 5000; // millisekund
// ===== BOT =====
const bot = new Telegraf(BOT_TOKEN);

// ===== DATABASE =====
const DB_FILE = './db.json';
let db = { users: {}, pendingPayments: {} };

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE));
    if (!db.pendingPayments) db.pendingPayments = {};
  } catch (e) {
    console.log('DB error:', e);
  }
}

const saveDB = () =>
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

const ensureUser = (id, username) => {
  if (!db.users[id]) {
    db.users[id] = { username, balance: 0, ref: null };
    saveDB();
  }
};

// ===== MENULAR =====
const mainMenu = Markup.keyboard([
  ['💰 Robux sotib olish'],
  ['🎁 Balans', '👥 Referral link'],
  ['📤 Yechib olish'],
  ['📞 Admin']
]).resize();

const backMenu = Markup.keyboard([['⬅️ Orqaga']]).resize();

// ===== ROBUX PAKETLARI =====
const robuxPackages = [
  [40, 7000],[80,14000],[120,21000],[160,28000],[200,35000],
  [240,42000],[280,49000],[320,56000],[360,60000],[400,61000],
  [500,65000],[540,72000],[580,79000],[620,86000],[660,100000],
  [700,106000],[740,121000],[780,128000],[820,130000],
  [2200,265000],[5250,660000],[11000,1310000],[26400,2620000]
];

// ===== FUNKSIYA: MAJBURIY OBUNA =====
async function checkSubscriptions(userId) {
  for (const ch of CHANNELS) {
    try {
      const member = await bot.telegram.getChatMember(`@${ch}`, userId);
      if (!['member','creator','administrator'].includes(member.status)) return false;
    } catch (e) {
      console.log('Obuna tekshirishda xato:', e.description || e);
      return false;
    }
  }
  return true;
}

// ===== FUNKSIYA: OBUNA BO‘LMASA INLINE =====
async function requireSubscription(ctx) {
  const id = ctx.from.id;
  const subscribed = await checkSubscriptions(id);
  if (!subscribed) {
    const buttons = CHANNELS.map(ch =>
      Markup.button.url(`🔗 Obuna bo‘ling: ${ch}`, `https://t.me/${ch}`)
    );
    await ctx.reply(
      'Botdan foydalanish uchun quyidagi kanallarga obuna bo‘ling:',
      Markup.inlineKeyboard(buttons, { columns: 1 })
    );
    return false;
  }
  return true;
}

bot.use(async (ctx, next) => {
  if (!ctx.from) return next();

  // Adminlar flooddan ozod
  if (ADMIN_IDS.includes(ctx.from.id)) return next();

  const userId = ctx.from.id;
  const now = Date.now();

  if (!floodMap[userId]) {
    floodMap[userId] = { count: 1, time: now };
    return next();
  }

  if (now - floodMap[userId].time < FLOOD_TIME) {
    floodMap[userId].count++;

    if (floodMap[userId].count > FLOOD_LIMIT) {
      try {
        await ctx.reply('⛔ Flood! Iltimos 5 soniya kuting.');
      } catch {}
      return; // ❌ shu yerda to‘xtaydi
    }
  } else {
    floodMap[userId] = { count: 1, time: now };
  }

  return next();
});

// ===== START =====
bot.start(async ctx => {
  const id = ctx.from.id;
  ensureUser(id, ctx.from.username);

  // Referral
  if (ctx.startPayload) {
    const ref = Number(ctx.startPayload);
    if (ref && ref !== id && db.users[ref] && !db.users[id].ref) {
      db.users[id].ref = ref;
      db.users[ref].balance += 1; // har bir yangi foydalanuvchi uchun 1 Robux
      saveDB();
      try {
        await ctx.telegram.sendMessage(ref, '🎁 Sizga 1 Robux referral bonus!');
      } catch {}
    }
  }

  // Obuna tekshirish
  if (!(await requireSubscription(ctx))) return;

  ctx.reply('🏪 Robux shopga xush kelibsiz                 🧑‍💻 dev:@OnGDsLJs', mainMenu);
});

// ===== ORQAGA =====
bot.hears('⬅️ Orqaga', async ctx => {
  if (!(await requireSubscription(ctx))) return;
  ctx.reply('Asosiy menyu', mainMenu);
});

// ===== ROBUX SOTIB OLISH =====
bot.hears('💰 Robux sotib olish', async ctx => {
  if (!(await requireSubscription(ctx))) return;

  const btns = robuxPackages.map(p => [`💵 ${p[0]} ROBUX - ${p[1]}`]);
  btns.push(['⬅️ Orqaga']);
  ctx.reply('Paketni tanlang:', Markup.keyboard(btns).resize());
});

// ===== PAKET TANLANDI =====
bot.hears(/💵 (\d+) ROBUX - (\d+)/, async ctx => {
  if (!(await requireSubscription(ctx))) return;

  const id = ctx.from.id;
  ensureUser(id, ctx.from.username);

  const [, robux, price] = ctx.message.text.match(/💵 (\d+) ROBUX - (\d+)/);

  db.pendingPayments[id] = { robux: Number(robux), price: Number(price) };
  saveDB();

  ctx.reply(
    `💳 TO‘LOV QILING\n\n🎁 ${robux} ROBUX\n💵 ${price} so‘m\n\n💳 KARTA: 5614 6818 7469 8719\nXashimov X\n\n📸 Chek rasmini yuboring`,
    backMenu
  );
});

// ===== CHEK RASM YUBORILDI =====
bot.on('photo', async ctx => {
  const id = ctx.from.id;
  if (!db.pendingPayments[id]) return;

  for (const a of ADMIN_IDS) {
    try {
      await ctx.telegram.sendPhoto(
        a,
        ctx.message.photo.at(-1).file_id,
        {
          caption: `💰 YANGI BUYURTMA\n👤 @${ctx.from.username}\n🎁 ${db.pendingPayments[id].robux} ROBUX\n💵 ${db.pendingPayments[id].price}`
        }
      );
    } catch {}
  }

  delete db.pendingPayments[id];
  saveDB();
  ctx.reply('✅ Chek yuborildi', mainMenu);
});

// ===== BALANS =====
bot.hears('🎁 Balans', async ctx => {
  if (!(await requireSubscription(ctx))) return;

  ensureUser(ctx.from.id, ctx.from.username);
  ctx.reply(`💎 Balans: ${db.users[ctx.from.id].balance} Robux`);
});

// ===== YECHIB OLISH =====
bot.hears('📤 Yechib olish', async ctx => {
  if (!(await requireSubscription(ctx))) return;

  const user = db.users[ctx.from.id];
  if (user.balance < 40) return ctx.reply('❌ Kamida 40 Robux kerak');

  for (const a of ADMIN_IDS) {
    try {
      await ctx.telegram.sendMessage(a, `📤 YECHIB OLISH\n@${user.username}\n${user.balance} Robux`);
    } catch {}
  }

  user.balance = 0;
  saveDB();
  ctx.reply('✅ So‘rov yuborildi');
});

// ===== REFERRAL =====
bot.hears('👥 Referral link', async ctx => {
  if (!(await requireSubscription(ctx))) return;

  const id = ctx.from.id;
  const link = `https://t.me/${ctx.botInfo.username}?start=${id}`;
  let count = 0;
  for (let u in db.users) if (db.users[u].ref === id) count++;

  ctx.reply(`👥 Referral linkingiz:\n${link}\n\n👤 Takliflar: ${count}\n🎁 Bonus: ${count * 1} Robux`);
});


// ===== ADMIN =====
bot.hears('📞 Admin', async ctx => {
  if (!(await requireSubscription(ctx))) return;

  ctx.reply('✍️ Xabaringizni yozing');
});

bot.on('text', async ctx => {
  if (ctx.message.text.startsWith('/')) return;

  const id = ctx.from.id;
  if (!(await requireSubscription(ctx))) return;

  for (const a of ADMIN_IDS) {
    try {
      await ctx.telegram.sendMessage(a, `📩 @${ctx.from.username}: ${ctx.message.text}`);
    } catch {}
  }
});

// ===== LAUNCH =====
bot.launch().then(() => console.log('✅ Bot ishga tushdi'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
