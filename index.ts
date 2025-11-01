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
  const seatnumOffset = 2;

  let output = "";
  output += `PokerStars Hand #${handId}:  Hold'em No Limit ${BetStructure} (${sb}/${bb}) - ${date} ET\n`;
  output += `Table 'Home Game' 5-max  (Play Money) Seat #${blinds.ButtonPlayerNum - seatnumOffset} is the button\n`;

  // --- 座席情報 ---
  Players.forEach((p) => {
    output += `Seat ${p.PlayerNum - seatnumOffset}: ${p.Name} (${(p.StartStackAmt)} in chips)\n`;
  });

  output += `${getPlayerName(Players, blinds.SmallBlindPlayerNum)}: posts small blind ${sb}\n`;
  output += `${getPlayerName(Players, blinds.BigBlindPlayerNum)}: posts big blind ${bb}\n`;

  // --- HOLE CARDS ---
  output += "*** HOLE CARDS ***\n";

  Players.forEach((p) => {
    if (p.HoleCards?.length) {
      output += `Dealt to ${p.Name} [${cardNumConverter(p.HoleCards[0])}]\n`;
    }
  });

  // --- アクションイベント処理 ---
  const board: string[] = [];
  const streets: Record<string, string[]> = { FLOP: [], TURN: [], RIVER: [] };
  let currentStreet = "PREFLOP";
  let lastbetamount = bb; //プリフロはベットされた状態からとする
  Events.forEach((e) => {
    switch (e.EventType) {
      case "BOARD CARD":
        board.push(e.BoardCards!);
        if (board.length === 3) {
          currentStreet = "FLOP" ;
          lastbetamount = 0;
        } 
        else if (board.length === 4) {
          currentStreet = "TURN";
          lastbetamount = 0;
        }
        else if (board.length === 5) {
          currentStreet = "RIVER";
           lastbetamount = 0;
        }
        break;
      case "BET":
        if (currentStreet !== "PREFLOP") {
          if (streets[currentStreet]) {
            streets[currentStreet].push(formatAction(e, Players, lastbetamount));
          }
        } else {
          streets["PREFLOP"] = streets["PREFLOP"] || [];
          streets["PREFLOP"].push(formatAction(e, Players, lastbetamount));
        }
        lastbetamount = e.BetAmt;
        break;
      case "CALL":
        if (currentStreet !== "PREFLOP") {
          if (streets[currentStreet]) {
            streets[currentStreet].push(formatAction(e, Players, lastbetamount));
          }
        } else {
          streets["PREFLOP"] = streets["PREFLOP"] || [];
          streets["PREFLOP"].push(formatAction(e, Players, lastbetamount));
        }
        break;
      case "FOLD":
        if (currentStreet !== "PREFLOP") {
          if (streets[currentStreet]) {
            streets[currentStreet].push(formatAction(e, Players, lastbetamount));
          }
        } else {
          streets["PREFLOP"] = streets["PREFLOP"] || [];
          streets["PREFLOP"].push(formatAction(e, Players, lastbetamount));
        }
        break;
      case "CHECK":
        if (currentStreet !== "PREFLOP") {
          if (streets[currentStreet]) {
            streets[currentStreet].push(formatAction(e, Players, lastbetamount));
          }
        } else {
          streets["PREFLOP"] = streets["PREFLOP"] || [];
          streets["PREFLOP"].push(formatAction(e, Players, lastbetamount));
        }
        break;
    }
  });

  // --- ストリート毎に出力 ---
  if (streets["PREFLOP"]?.length) output += streets["PREFLOP"].join("\n") + "\n";

  if (board.length >= 3) {
    output += `*** FLOP *** [${cardNumConverter(board.slice(0, 3).join(" "))}]\n`;
    output += streets["FLOP"].join("\n") + "\n";
  }

  if (board.length >= 4) {
    output += `*** TURN *** [${cardNumConverter(board.slice(0, 3).join(" "))}] [${board[3]}]\n`;
    output += streets["TURN"].join("\n") + "\n";
  }

  if (board.length >= 5) {
    output += `*** RIVER *** [${cardNumConverter(board.slice(0, 3).join(" "))}] [${board[4]}]\n`;
    output += streets["RIVER"].join("\n") + "\n";
  }

  // --- SHOWDOWN ---
  output += "*** SHOW DOWN ***\n";
  Players.forEach((p) => {
    if (p.HoleCards?.length) {
      output += `${p.Name}: shows [${cardNumConverter(p.HoleCards[0])}]\n`;
    }
  });

  const winner = Players.find((p) => p.CumulativeWinningsAmt > 0);
  if (winner) {
    output += `${winner.Name} collected ${(winner.CumulativeWinningsAmt)} from pot\n`;
  }

  // --- SUMMARY ---
  output += "*** SUMMARY ***\n";
  output += `Total pot ${(Players.reduce((a, b) => a + Math.abs(b.CumulativeWinningsAmt), 0))} | Rake 0\n`;
  output += `Board [${cardNumConverter(board.join(" "))}]\n`;

  Players.forEach((p) => {
    const win = p.CumulativeWinningsAmt > 0;
    const lose = p.CumulativeWinningsAmt < 0;
    if (win)
      output += `Seat ${p.PlayerNum - seatnumOffset}: ${p.Name} showed [${cardNumConverter(p.HoleCards[0])}] and won (${(
        p.CumulativeWinningsAmt
      )})\n`;
    else if (lose)
      output += `Seat ${p.PlayerNum - seatnumOffset}: ${p.Name} showed [${cardNumConverter(p.HoleCards[0])}] and lost\n`;
    else output += `Seat ${p.PlayerNum - seatnumOffset}: ${p.Name} folded before Flop (didn't bet)\n`;
  });

  return output;
}

function cardNumConverter(hand: string): string {
  // スペース区切りでカードを抽出（余分な空白にも対応）
  const cards = hand.trim().split(/\s+/);

  const rankMap: Record<string, string> = {
    '10': 'T',
    'j': 'J',
    'q': 'Q',
    'k': 'K',
    'a': 'A',
  };

  const converted = cards.map(card => {
    // ランク部分（例: 10, k, q, j, a, 9...）
    const match = card.match(/^([0-9]+|[a-zA-Z])([shdc])$/i);
    if (!match) return card; // 不正なフォーマットならそのまま返す

    const [, rank, suit] = match;
    const convertedRank = rankMap[rank.toLowerCase()] ?? rank;

    return `${convertedRank}${suit}`; // スート情報を保持
  });

  return converted.join(' ');
}

function formatAction(e: Event, players: Player[], bet: number): string {
  const name = getPlayerName(players, e.PlayerNum);
  console.log(bet)
  switch (e.EventType) {
    case "BET":
      if (bet == 0) {
        return `${name}: bets ${(e.BetAmt)}`;
      } else {
        return `${name}: raises ${(e.BetAmt - bet)} to ${(e.BetAmt)}`;
      }
    case "CALL":
      return `${name}: calls ${(e.BetAmt - bet)}`;
    case "FOLD":
      return `${name}: folds`;
    case "CHECK":
      return `${name}: checks`;
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