// Логика матчей: подсчёт очков, тай-брейк по времени, награды.
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
const src=readFileSync("src/lib/tournament.ts","utf8").replace(/import type \{[^}]*\} from "[^"]*";/g,"");
const {code}=await transform(src,{loader:"ts",format:"esm"});
const m=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const { teamScores, matchWinner, roundComplete, roundExpired, rewardFor,
        MODE_SIZE, ROUND_SECONDS, MATCH_REWARD } = m;

let pass=0,fail=0;
const eq=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);
  console.log(`${ok?"  ok  ":"  FAIL"} ${n}${ok?"":` — ${JSON.stringify(g)} ≠ ${JSON.stringify(w)}`}`);ok?pass++:fail++;};

const mk = (answers, rounds=2) => ({
  id:"m1", kind:"math", mode:"1v1", grade:3, status:"playing",
  players:[{profileId:"a",name:"A",avatar:"🦊",team:"A"},
           {profileId:"b",name:"B",avatar:"🐻",team:"B"}],
  rounds:Array.from({length:rounds},()=>({question:"2+2",options:["3","4"],correct:1})),
  currentRound:0, roundDeadline:0, answers, createdAt:0,
});

console.log("\n── подсчёт очков ──");
{
  const match = mk({ "0:a":{option:1,ms:3000}, "0:b":{option:0,ms:2000},
                     "1:a":{option:1,ms:4000}, "1:b":{option:1,ms:1000} });
  eq("очки считаются по верным ответам", teamScores(match), {A:2,B:1});
  eq("побеждает команда с бóльшим счётом", matchWinner(match), "A");
}

console.log("\n── ничья решается скоростью ──");
{
  // Оба ответили верно в обоих раундах, но B был быстрее.
  const match = mk({ "0:a":{option:1,ms:9000}, "0:b":{option:1,ms:2000},
                     "1:a":{option:1,ms:9000}, "1:b":{option:1,ms:2000} });
  eq("счёт равный", teamScores(match), {A:2,B:2});
  eq("выигрывает тот, кто решал быстрее", matchWinner(match), "B");
}

console.log("\n── неответивший не блокирует матч ──");
{
  const match = mk({ "0:a":{option:1,ms:3000} });
  eq("раунд не завершён, пока не ответили все", roundComplete(match), false);
  match.roundDeadline = 1000;
  eq("но по истечении срока раунд закрывается", roundExpired(match, 2000), true);
  // Не ответивший получает 0 очков и штрафное время — матч идёт дальше.
  eq("молчание не даёт очков", teamScores(match), {A:1,B:0});
}

console.log("\n── все ответили — ждать таймер не нужно ──");
{
  const match = mk({ "0:a":{option:1,ms:1000}, "0:b":{option:0,ms:1200} });
  eq("раунд завершён досрочно", roundComplete(match), true);
}

console.log("\n── награды ──");
{
  eq("победа", rewardFor("A","A"), MATCH_REWARD.win);
  eq("поражение всё же что-то даёт", rewardFor("A","B") > 0, true);
  eq("поражение меньше победы", rewardFor("A","B") < rewardFor("A","A"), true);
  eq("ничья между ними", rewardFor("draw","A"), MATCH_REWARD.draw);
}

console.log("\n── размеры команд ──");
eq("1v1", MODE_SIZE["1v1"], 1);
eq("3v3", MODE_SIZE["3v3"], 3);
eq("на раунд 20 секунд", ROUND_SECONDS, 20);



// Отдельно проверяем построение вариантов ответа: правильный обязан быть
// среди них, и позиция не должна быть предсказуемой.
console.log("\n── варианты ответа в матче ──");
{
  const { readFileSync } = await import("node:fs");
  const { transform } = await import("esbuild");
  const gsrc = readFileSync("src/lib/mathGenerator.ts","utf8").replace(/import type \{[^}]*\} from "[^"]*";/g,"");
  const g = await transform(gsrc,{loader:"ts",format:"esm"});
  const { dailyTasks } = await import("data:text/javascript;base64,"+Buffer.from(g.code).toString("base64"));

  // Повторяем ту же логику, что в ArenaPage.buildMathRounds.
  const build = (grade, ROUNDS=5) => {
    const pool = dailyTasks(grade);
    const rounds = [];
    for (let i=0;i<ROUNDS;i++){
      const task = pool[i % pool.length];
      const num = parseInt((task.answer.match(/-?\d+/) ?? ["0"])[0], 10);
      const distractors = [num+1, num-1, num+(num>10?10:2)].filter(n=>n!==num && n>=0);
      const options = [String(num), ...distractors.slice(0,3).map(String)];
      const shift = (i*7)%options.length;
      const rotated = [...options.slice(shift), ...options.slice(0,shift)];
      rounds.push({ question: task.text, options: rotated, correct: rotated.indexOf(String(num)) });
    }
    return rounds;
  };

  let allValid = true, positions = new Set();
  for (let grade=1; grade<=4; grade++){
    for (const r of build(grade)) {
      if (r.correct < 0) allValid = false;
      if (r.options[r.correct] === undefined) allValid = false;
      if (new Set(r.options).size !== r.options.length) allValid = false;
      positions.add(r.correct);
    }
  }
  eq("правильный ответ всегда среди вариантов", allValid, true);
  eq("варианты не дублируются", allValid, true);
  eq("позиция правильного меняется", positions.size > 1, true);
}

console.log(`\nитого: ${pass} прошло, ${fail} упало\n`);
process.exit(fail?1:0);
