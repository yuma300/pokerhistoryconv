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
  Pot: number;
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

interface PlayerAction {
  playerName: string;
  action: string;
  betAmount: number;
}

// --- メイン変換関数 ---
function convertPokerGFXtoPokerStars(hand: Hand, handId: number): string {
  //const hand = json;
  const {
    Players,
    Events,
    FlopDrawBlinds: blinds,
    GameVariant,
    BetStructure,
    StartDateTimeUTC,
  } = hand;

  const sb = (blinds.SmallBlindAmt);
  const bb = (blinds.BigBlindAmt);

  const date = new Date(StartDateTimeUTC).toISOString().replace(/-/g, "/").replace("T", " ").split(".")[0];
  const seatnum = Players.filter(e => e.StartStackAmt != 0).length
  const seatnumOffset:number = 0; //シートのオフセット、starsでは必ずシートは1から始まる必要がある
  const heroname:string = "aaaa 8"; //シートのオフセット、starsでは必ずシートは1から始まる必要がある  

  let output = "";
  output += `PokerStars Hand #${handId}:  Hold'em No Limit ${BetStructure} (${sb}/${bb}/${bb}) - ${date} ET\n`;
  output += `Table 'Home Game' ${seatnum}-max  (Play Money) Seat #${blinds.ButtonPlayerNum - seatnumOffset} is the button\n`;

  // --- 座席情報 ---
  Players.forEach((p) => {
    if (p.StartStackAmt != 0) output += `Seat ${p.PlayerNum - seatnumOffset}: ${p.Name} (${(p.StartStackAmt)} in chips)\n`;
  });

  output += `${getPlayerName(Players, blinds.SmallBlindPlayerNum)}: posts small blind ${sb}\n`;
  output += `${getPlayerName(Players, blinds.BigBlindPlayerNum)}: posts big blind ${bb}\n`;
  output += `${getPlayerName(Players, blinds.BigBlindPlayerNum)}: posts the ante ${bb}\n`;

  // --- HOLE CARDS ---
  output += "*** HOLE CARDS ***\n";

  Players.forEach((p) => {
    if (p.HoleCards?.length && p.Name == heroname) {
      output += `Dealt to ${p.Name} [${cardNumConverter(p.HoleCards[0])}]\n`;
    }
  });

  // --- アクションイベント処理 ---
  const board: string[] = [];
  const streets: Record<string, string[]> = { FLOP: [], TURN: [], RIVER: [] };
  let currentStreet = "PREFLOP";
  let lastbetamount = bb; //プリフロはベットされた状態からとする
  let playeractions: PlayerAction[] = []
  let lastevent: Event = Events[0];
  let totalPotAmt = sb + bb + bb;
  playeractions.push({playerName: getPlayerName(Players, blinds.SmallBlindPlayerNum), action: "BET", betAmount: sb}) //sbの最後のアクション入れる
  playeractions.push({playerName: getPlayerName(Players, blinds.BigBlindPlayerNum), action: "BET", betAmount: bb}) //bbの最後のアクション入れる
  Events.forEach((e) => {
    const name = getPlayerName(Players, e.PlayerNum);
    const player = playeractions.find((e) => e.playerName === name)

    switch (e.EventType) {
      case "BOARD CARD":
        board.push(e.BoardCards!);
        if (board.length === 3) {
          currentStreet = "FLOP" ;
          lastbetamount = 0;
          playeractions = []
        } 
        else if (board.length === 4) {
          currentStreet = "TURN";
          lastbetamount = 0;
          playeractions = []
        }
        else if (board.length === 5) {
          currentStreet = "RIVER";
           lastbetamount = 0;
           playeractions = []
        }
        break;
      case "BET":
        if (currentStreet !== "PREFLOP") {
          if (streets[currentStreet]) {
            streets[currentStreet].push(formatAction(e, Players, lastbetamount, playeractions));
          }
        } else {
          streets["PREFLOP"] = streets["PREFLOP"] || [];
          streets["PREFLOP"].push(formatAction(e, Players, lastbetamount, playeractions));
        }
        lastbetamount = e.BetAmt;
        totalPotAmt += (e.BetAmt - (player? player.betAmount : 0));
        console.log(`name: ${name}, e.BetAmt: ${e.BetAmt}, player.betAmount: ${player? player.betAmount : 0}`)
        break;
      case "ALL IN":
        if (currentStreet !== "PREFLOP") {
          if (streets[currentStreet]) {
            streets[currentStreet].push(formatAction(e, Players, lastbetamount, playeractions));
          }
        } else {
          streets["PREFLOP"] = streets["PREFLOP"] || [];
          streets["PREFLOP"].push(formatAction(e, Players, lastbetamount, playeractions));
        }
        lastbetamount = e.BetAmt;
        totalPotAmt += (e.BetAmt - (player? player.betAmount : 0));
        console.log(`name: ${name}, e.BetAmt: ${e.BetAmt}, player.betAmount: ${player? player.betAmount : 0}`)
        break;
      case "CALL":
        if (currentStreet !== "PREFLOP") {
          if (streets[currentStreet]) {
            streets[currentStreet].push(formatAction(e, Players, lastbetamount, playeractions));
          }
        } else {
          streets["PREFLOP"] = streets["PREFLOP"] || [];
          streets["PREFLOP"].push(formatAction(e, Players, lastbetamount, playeractions));
        }
        totalPotAmt += (e.BetAmt - (player? player.betAmount : 0));
        console.log(`name: ${name}, e.BetAmt: ${e.BetAmt}, player.betAmount: ${player? player.betAmount : 0}`)
        break;
      case "FOLD":
        if (currentStreet !== "PREFLOP") {
          if (streets[currentStreet]) {
            streets[currentStreet].push(formatAction(e, Players, lastbetamount, playeractions));
          }
        } else {
          streets["PREFLOP"] = streets["PREFLOP"] || [];
          streets["PREFLOP"].push(formatAction(e, Players, lastbetamount, playeractions));
        }
        break;
      case "CHECK":
        if (currentStreet !== "PREFLOP") {
          if (streets[currentStreet]) {
            streets[currentStreet].push(formatAction(e, Players, lastbetamount, playeractions));
          }
        } else {
          streets["PREFLOP"] = streets["PREFLOP"] || [];
          streets["PREFLOP"].push(formatAction(e, Players, lastbetamount, playeractions));
        }
        break;
    }
    console.log(`totalpotamt ${totalPotAmt}`)
    if (e.EventType != "FOLD") lastevent = e;
  });
  console.log(`lastevent.Pot: ${lastevent.Pot} , lastevent.BetAmt: ${lastevent.BetAmt}`)
//  if (Events.slice(-1)[0].EventType != "CALL") {
//    totalPotAmt -= lastevent.BetAmt;
//  }

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
    if (p.HoleCards?.length && p.StartStackAmt != 0) {
      output += `${p.Name}: shows [${cardNumConverter(p.HoleCards[0])}]\n`;
    }
  });

  const winners = Players.filter((p) => p.EndStackAmt - p.StartStackAmt > 0);
  winners.forEach((winner) => {
    output += `${winner.Name} collected ${Math.floor(totalPotAmt / winners.length)} from pot\n`;    
  })

//  if (winner) {
//    output += `${winner.Name} collected ${totalPotAmt} from pot\n`;
//  }

  // --- SUMMARY ---
  output += "*** SUMMARY ***\n";
  output += `Total pot ${totalPotAmt} | Rake 0\n`;
  output += `Board [${cardNumConverter(board.join(" "))}]\n`;

  Players.forEach((p) => {
    const win = p.EndStackAmt - p.StartStackAmt > 0;
    const lose = p.EndStackAmt - p.StartStackAmt < 0;
    if (p.StartStackAmt == 0) return;
    if (win)
      output += `Seat ${p.PlayerNum - seatnumOffset}: ${p.Name} showed [${cardNumConverter(p.HoleCards[0])}] and won (${(
        Math.floor(totalPotAmt / winners.length)
      )})\n`;
    else if (lose)
      output += `Seat ${p.PlayerNum - seatnumOffset}: ${p.Name} showed [${cardNumConverter(p.HoleCards[0])}] and lost\n`;
    else output += `Seat ${p.PlayerNum - seatnumOffset}: ${p.Name} folded before Flop (didn't bet)\n`;
  });
  output += `\n\n`;
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

function formatAction(e: Event, players: Player[], bet: number, playeractions: Array<PlayerAction>): string {
  const name = getPlayerName(players, e.PlayerNum);
  switch (e.EventType) {
    case "BET":
      playeractions.push({playerName: name, action: e.EventType, betAmount: e.BetAmt})
      if (bet == 0) {
        return `${name}: bets ${(e.BetAmt)}`;
      } else {
        return `${name}: raises ${(e.BetAmt - bet)} to ${(e.BetAmt)}`;
      }
    case "ALL IN":
      playeractions.push({playerName: name, action: e.EventType, betAmount: e.BetAmt})
      if (bet == 0) {
        return `${name}: bets ${(e.BetAmt)}`;
      } else {
        return `${name}: raises ${(e.BetAmt - bet)} to ${(e.BetAmt)}`;
      }
    case "CALL":
      const player = playeractions.find((e) => e.playerName === name)
      playeractions.push({playerName: name, action: e.EventType, betAmount: e.BetAmt})
      return `${name}: calls ${(e.BetAmt - (player? player.betAmount : 0))}`;
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
let handId = 201956253908; // 任意で連番に変更可能


const data = JSON.parse(fs.readFileSync("hand.json", "utf-8")) as PokerGFXData;
data.Hands.forEach(json => {
  const result = convertPokerGFXtoPokerStars(json, handId);  
  fs.appendFileSync("hand-history.txt", result);
  handId++;
});

//const result = convertPokerGFXtoPokerStars(data.Hands[0]);
//fs.appendFileSync("hand-history.txt", result);

console.log("✅ PokerStars形式のハンド履歴を hand-history.txt に出力しました！");