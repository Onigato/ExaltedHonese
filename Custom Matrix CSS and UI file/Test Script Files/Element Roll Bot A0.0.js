import sdk from "matrix-js-sdk";
import crypto from "crypto";

/* ==============================
   CONFIG
============================== */

const MATRIX_HOMESERVER = "https://your-matrix-server.com";
const ACCESS_TOKEN = "YOUR_BOT_ACCESS_TOKEN";
const BOT_USER_ID = "@dicebot:yourserver.com";

/* ==============================
   MATRIX CLIENT
============================== */

const client = sdk.createClient({
  baseUrl: MATRIX_HOMESERVER,
  accessToken: ACCESS_TOKEN,
  userId: BOT_USER_ID,
});

client.startClient();
console.log("🌞 Exalted 2.5e Dice Bot Running...");

/* ==============================
   PARSER
============================== */

function parseExpression(expression) {
  const regex = /^(\d+)d10(?:t(\d+))?(d)?(?:\+(\d+))?$/i;
  const match = expression.match(regex);

  if (!match) return null;

  const numDice = parseInt(match[1]);
  const threshold = match[2] ? parseInt(match[2]) : 7;
  const doubleTens = !!match[3];
  const autoSuccesses = match[4] ? parseInt(match[4]) : 0;

  if (numDice <= 0 || numDice > 200) return null;
  if (threshold < 1 || threshold > 10) return null;

  return { numDice, threshold, doubleTens, autoSuccesses };
}

/* ==============================
   ROLL ENGINE
============================== */

function rollExalted({ numDice, threshold, doubleTens, autoSuccesses }) {
  const rolls = [];
  let diceSuccesses = 0;
  let hasOne = false;
  let hasSuccessFromDice = false;
  let allTens = true;

  for (let i = 0; i < numDice; i++) {
    const roll = crypto.randomInt(1, 11);
    rolls.push(roll);

    if (roll !== 10) allTens = false;
    if (roll === 1) hasOne = true;

    if (roll >= threshold) {
      hasSuccessFromDice = true;

      if (roll === 10 && doubleTens) {
        diceSuccesses += 2;
      } else {
        diceSuccesses += 1;
      }
    }
  }

  const totalSuccesses = diceSuccesses + autoSuccesses;

  const isBotch = !hasSuccessFromDice && hasOne;
  const isGod = allTens;

  return {
    rolls,
    diceSuccesses,
    autoSuccesses,
    totalSuccesses,
    isBotch,
    isGod,
  };
}

/* ==============================
   LISTENER
============================== */

client.on("Room.timeline", async (event, room) => {
  if (event.getType() !== "m.room.message") return;
  if (!event.getContent()?.body) return;

  const body = event.getContent().body.trim();

  if (!body.startsWith("!roll") && !body.startsWith("/roll")) return;

  const parts = body.split(" ");
  const expression = parts[1];

  if (!expression) {
    await client.sendTextMessage(
      room.roomId,
      "Usage: /roll 7d10t7d+2"
    );
    return;
  }

  const parsed = parseExpression(expression);

  if (!parsed) {
    await client.sendTextMessage(
      room.roomId,
      "Invalid format. Example: 7d10t7d+2"
    );
    return;
  }

  const result = rollExalted(parsed);

  const rollDisplay = result.rolls
    .map(r => {
      if (r === 10) return `**${r}**`;
      if (r >= parsed.threshold) return `*${r}*`;
      if (r === 1) return `_${r}_`;
      return r;
    })
    .join(", ");

  let response = `🌞 ${event.getSender()} rolled ${expression}<br><br>`;
  response += `Dice: [${rollDisplay}]<br>`;

  if (result.isGod) {
    response += `<br><span style="color:gold; font-weight:bold; font-size:1.2em;">GOD!</span>`;
  } else if (result.isBotch) {
    response += `<br><span style="color:red; font-weight:bold; font-size:1.2em;">BOTCH!</span>`;
  } else {
    response += `<br>Dice Successes: <b>${result.diceSuccesses}</b>`;
    
    if (result.autoSuccesses > 0) {
      response += `<br>Auto Successes: +${result.autoSuccesses}`;
    }

    response += `<br><br><b>Total Successes: ${result.totalSuccesses}</b>`;
  }

  await client.sendEvent(room.roomId, "m.room.message", {
    msgtype: "m.text",
    format: "org.matrix.custom.html",
    body: response,
    formatted_body: response
  });
});