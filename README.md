# THE DAILY GRIND

A corporate-office 2D platformer. It's Monday, 8:59 AM. You've had enough.
Escape the building — floor by floor — and quit gloriously.

**Zero dependencies.** Open `index.html` in any modern browser (or serve the folder with any static server).

## How to play

| Input | Action |
| --- | --- |
| ← → / A D | Move |
| Space / W / ↑ / Z | Jump (press again mid-air to double-jump) |
| ↑ / W (hold) | Climb ladder · ↓ / S to climb down |
| Shift / X / C | Dash |
| F / 📎 button | Fire the trusty red stapler |
| ↓ / S (+jump) | Drop through one-way shelves |
| P / Esc | Pause |
| M | Mute |
| R | Restart current day |
| Enter | Confirm / start |
| F11 / ⛶ | Fullscreen (desktop) |
| < / > (staff pick) | Browse staff — everyone plays differently ↓ |

Every run opens with a staff-pick screen, a punch-in card, and a short
**dialogue scene** with MANAGEMENT (typewriter text, any key advances,
Esc skips). THE CEO gets his own standoff scene before the fight and
concedes defeat in one when you win — his attacks telegraph
(`LEAP INCOMING!` / `VOLLEY INCOMING!`), his dizzy windows show a
countdown bar, and staples & stomps only land then. Outside them his
suit goes `CLANK!`.

## Staff kits

| | Perk | World | Ouch |
| --- | --- | --- | --- |
| 🆓 **The Intern** | 4 morale | climbs 35% faster · **tailgates through closed security gates** | managers barely notice him |
| 🟣 **Priya · QA** | twin-staple burst | belts can't move her · **staples jam shredders** (2.5s, P1 fix) | 25% slower fire cycle |
| 😎 **Chad · Sales** | triple jump + fast dash | springs launch 22% higher | 2 morale max |
| 👔 **Meera · HR** | survives her first KO | HR drones ignore her (stompable) | −8% speed |

## The gig

- **Chug coffee (☕)** for a burst of speed + score
- **Stomp managers** Mario-style — they had it coming
- **Staple everything** (F key) — interns & HR drones drop in one hit, paper planes get returned to sender; managers take two staples and get angry about it
- **Collect TPS report files** for big points
- Dodge **paper airplanes**, **shredders**, **stapler volleys**
- Punch the **time clock** checkpoints to save progress & restore morale
- Survive all 3 floors, then beat **THE CEO** in the boardroom
- Get ranked at the end: from *Certified Unpaid Intern* to *Legendary Quitter*

## Days

1. **The Cubicle Farm** — learn the ropes
2. **Accounting** — the spreadsheets have teeth
3. **Executive Floor** — marble floors, zero mercy
4. **The Boardroom** — final performance review (boss fight)

## The challenge loop

Every run ends with a **SHARE RUN** button (or press `S`) that posts a
resignation-letter-style card *with a challenge link baked in*:

```
...?#/index.html#c=<score>~<YourName>
```

Whoever opens it sees **"⚠ CHALLENGE: <YOUR NAME> POSTED <score>"** on the
title screen, a live **TARGET** HUD while playing, and a **CHALLENGE LEAD!**
the moment they overtake you. Their share then carries *their* score — the
product distributes itself.

You also pick your staff avatar (`<` / `>` on title, persisted), and your
name signs every share card. The office record + holder name is stamped on
the title screen.

Everything (art, music, sound) is generated procedurally in code:
Canvas2D for rendering, WebAudio for the chiptune soundtrack and SFX.

## Files

- `index.html` — shell + touch controls
- `js/game.js` — engine: physics, entities, boss AI, renderer, juice
- `js/levels.js` — level data (programmatic tile maps)
- `js/audio.js` — synthesized SFX + music sequencer
