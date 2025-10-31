import fs from "fs";

interface Player {
  Name: string;
  HoleCards: string[];
  StartStackAmt: number;
  EndStackAmt: number;
  CumulativeWinningsAmt: number;
  PlayerNum: number;
}

interface Event {
  EventType: string;
  PlayerNum: number;
  BetAmt: number;
  BoardCards?: string | null;
}

interface Hand {
  HandNum: number;
  GameVariant: string;
  BetStructure: string;
  Players: Player[];
  Events: Event[];
  FlopDrawBlinds: {
    SmallBlindAmt: number;
    BigBlindAmt: number;
    ButtonPlayerNum: number;
    SmallBlindPlayerNum: number;
    BigBlindPlayerNum: number;
  };
  StartDateTimeUTC: string;
}

interface PokerGFXData {
  Hands: Hand[];
}

// --- メイン変換関数 ---
function convertPokerGFXtoPokerStars(json: PokerGFXData): string {
  const hand = json.Hands[0];
  const {
    Players,
    Events,
    FlopDrawBlinds: blinds,
    GameVariant,
    BetStructure,
    StartDateTimeUTC,
  } = hand;

  const handId = 202510260001; // 任意で連番に変更可能
  const sb = (blinds.SmallBlindAmt);
  const bb = (blinds.BigBlindAmt);
  const date = new Date(StartDateTimeUTC).toISOString().replace("T", " ").split(".")[0];

  let output = "";
  output += `PokerStars Hand #${handId}:  Hold'em No Limit ${BetStructure} (${sb}/${bb}) - ${date} ET\n`;
  output += `Table 'Home Game' 5-max  (Play Money) Seat #${blinds.ButtonPlayerNum} is the button\n`;

  // --- 座席情報 ---
  Players.forEach((p) => {
    output += `Seat ${p.PlayerNum}: ${p.Name} (${(p.StartStackAmt)} in chips)\n`;
  });

  output += `${getPlayerName(Players, blinds.SmallBlindPlayerNum)}: posts small blind ${sb}\n`;
  output += `${getPlayerName(Players, blinds.BigBlindPlayerNum)}: posts big blind ${bb}\n`;

  // --- HOLE CARDS ---
  output += "*** HOLE CARDS ***\n";

  Players.forEach((p) => {
    if (p.HoleCards?.length) {
      output += `Dealt to ${p.Name} [${p.HoleCards[0]}]\n`;
    }
  });

  // --- アクションイベント処理 ---
  const board: string[] = [];
  const streets: Record<string, string[]> = { FLOP: [], TURN: [], RIVER: [] };
  let currentStreet = "PREFLOP";

  Events.forEach((e) => {
    switch (e.EventType) {
      case "BOARD CARD":
        board.push(e.BoardCards!);
        if (board.length === 3) currentStreet = "FLOP";
        else if (board.length === 4) currentStreet = "TURN";
        else if (board.length === 5) currentStreet = "RIVER";
        break;
      case "BET":
      case "CALL":
      case "FOLD":
      case "CHECK":
      case "RAISE":
        if (currentStreet !== "PREFLOP") {
          if (streets[currentStreet]) {
            streets[currentStreet].push(formatAction(e, Players));
          }
        } else {
          streets["PREFLOP"] = streets["PREFLOP"] || [];
          streets["PREFLOP"].push(formatAction(e, Players));
        }
        break;
    }
  });

  // --- ストリート毎に出力 ---
  if (streets["PREFLOP"]?.length) output += streets["PREFLOP"].join("\n") + "\n";

  if (board.length >= 3) {
    output += `*** FLOP *** [${board.slice(0, 3).join(" ")}]\n`;
    output += streets["FLOP"].join("\n") + "\n";
  }

  if (board.length >= 4) {
    output += `*** TURN *** [${board.slice(0, 3).join(" ")}] [${board[3]}]\n`;
    output += streets["TURN"].join("\n") + "\n";
  }

  if (board.length >= 5) {
    output += `*** RIVER *** [${board.slice(0, 4).join(" ")}] [${board[4]}]\n`;
    output += streets["RIVER"].join("\n") + "\n";
  }

  // --- SHOWDOWN ---
  output += "*** SHOW DOWN ***\n";
  Players.forEach((p) => {
    if (p.HoleCards?.length) {
      output += `${p.Name}: shows [${p.HoleCards[0]}]\n`;
    }
  });

  const winner = Players.find((p) => p.CumulativeWinningsAmt > 0);
  if (winner) {
    output += `${winner.Name}: collected ${(winner.CumulativeWinningsAmt)} from pot\n`;
  }

  // --- SUMMARY ---
  output += "*** SUMMARY ***\n";
  output += `Total pot ${(Players.reduce((a, b) => a + Math.abs(b.CumulativeWinningsAmt), 0))} | Rake 0\n`;
  output += `Board [${board.join(" ")}]\n`;

  Players.forEach((p) => {
    const win = p.CumulativeWinningsAmt > 0;
    const lose = p.CumulativeWinningsAmt < 0;
    if (win)
      output += `Seat ${p.PlayerNum}: ${p.Name} showed [${p.HoleCards[0]}] and won (${(
        p.CumulativeWinningsAmt
      )})\n`;
    else if (lose)
      output += `Seat ${p.PlayerNum}: ${p.Name} showed [${p.HoleCards[0]}] and lost\n`;
    else output += `Seat ${p.PlayerNum}: ${p.Name} folded before Flop (didn't bet)\n`;
  });

  return output;
}

function formatAction(e: Event, players: Player[]): string {
  const name = getPlayerName(players, e.PlayerNum);
  switch (e.EventType) {
    case "BET":
      return `${name}: bets ${(e.BetAmt)}`;
    case "CALL":
      return `${name}: calls ${(e.BetAmt)}`;
    case "FOLD":
      return `${name}: folds`;
    case "CHECK":
      return `${name}: checks`;
    case "RAISE":
      return `${name}: raises to ${(e.BetAmt)}`;
    default:
      return "";
  }
}

function getPlayerName(players: Player[], num: number): string {
  return players.find((p) => p.PlayerNum === num)?.Name || `Player${num}`;
}

// --- 実行例 ---
const data = JSON.parse(fs.readFileSync("hand.json", "utf-8")) as PokerGFXData;
const result = convertPokerGFXtoPokerStars(data);

fs.writeFileSync("hand-history.txt", result);
console.log("✅ PokerStars形式のハンド履歴を hand-history.txt に出力しました！");