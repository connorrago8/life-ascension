# Scriptable widget (free, read-only)

LIFE ASCENSION can feed a Scriptable widget on iPhone without a paid Apple Developer account, a Mac, or Xcode. The widget reads one account: the person who created the token. It cannot see a partner's XP, level, or streak.

## 1. Create a token

1. Open `/settings/notifications` while signed in.
2. Tap **Create widget token**.
3. Copy the `la_widget_…` value. It is shown once. Revoke it on that same screen at any time.

The database stores only the SHA-256 of the token.

## 2. Scriptable script

In the free Scriptable app, create a script named `Life Ascension` and paste this. Replace the host and the token.

```javascript
const HOST = 'https://YOUR_PREVIEW.vercel.app';
const TOKEN = 'la_widget_PASTE_ONCE';

const request = new Request(`${HOST}/api/widget/today`);
request.headers = { Authorization: `Bearer ${TOKEN}` };
request.timeoutInterval = 20;
const data = await request.loadJSON();

const widget = new ListWidget();
widget.backgroundColor = new Color('#0c0e12');
widget.setPadding(12, 12, 12, 12);

const mark = widget.addText('LIFE ASCENSION');
mark.font = Font.mediumSystemFont(11);
mark.textColor = new Color('#c9a227');

widget.addSpacer(6);
const quests = widget.addText(`${data.completed}/${data.total} quests`);
quests.font = Font.boldSystemFont(22);
quests.textColor = new Color('#00f0ff');

const streak = widget.addText(`Streak ${data.streak}`);
streak.font = Font.mediumSystemFont(14);
streak.textColor = new Color('#ff2bd6');

const xp = widget.addText(`Lv ${data.level} · ${data.xpIntoLevel}/${data.xpForNext} XP`);
xp.font = Font.mediumSystemFont(13);
xp.textColor = new Color('#e8eaed');

widget.addSpacer(4);
const day = widget.addText(String(data.gameDay || ''));
day.font = Font.mediumSystemFont(11);
day.textColor = new Color('#9aa3ae');

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentSmall();
}
Script.complete();
```

Add a small Scriptable widget on the Home Screen and choose this script. A 401 means the token was revoked or typed wrong. Create a new one.

The endpoint is `GET /api/widget/today` with `Authorization: Bearer la_widget_…`. The body is:

```json
{
  "gameDay": "2026-11-14",
  "completed": 1,
  "total": 4,
  "remaining": 3,
  "streak": 2,
  "level": 3,
  "xpIntoLevel": 4,
  "xpForNext": 20,
  "lifetimeXp": 39
}
```

`completed` and `total` count that account's quest instances due on the current game day (the day starts at 5:00 AM). The on-screen status pill uses the same game day and the quest board's own glance, so a weekly quest can make those two numbers differ by a quest or two.
