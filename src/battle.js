export function play(players, {
  log = console.log,
  maxRounds = Infinity,
  onRound,
  onEvent
} = {}) {
  let survivors = players.filter((player) => !player.isDead());

  for (let round = 1; round <= maxRounds && survivors.length > 1; round += 1) {
    log(`Раунд ${round}`);
    for (const player of survivors) {
      if (!player.isDead()) {
        if (onEvent) {
          player.turn(survivors, log, (event) => onEvent(round, event));
        } else {
          player.turn(survivors, log);
        }
      }
    }

    survivors = survivors.filter((player) => !player.isDead());
    onRound?.(round);
  }

  if (survivors.length === 1) {
    log(`Победитель – ${survivors[0].name}.`);
    return survivors[0];
  }

  log(survivors.length === 0 ? 'На поле нет бойцов.' : 'Ничья. Достигнут лимит раундов.');
  return null;
}
