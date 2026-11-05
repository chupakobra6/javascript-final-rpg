import { describe, test, expect, jest, afterEach } from '@jest/globals';
import {
  Weapon, Arm, Bow, Sword, Knife, Staff, LongBow, Axe, StormStaff,
  Player, Warrior, Archer, Mage, Dwarf, Crossbowman, Demiurge, play,
} from '../src/index.js';

afterEach(() => jest.restoreAllMocks());

describe('Оружие', () => {
  test.each([
    [Arm, 'Рука', 1, Infinity, 1], [Bow, 'Лук', 10, 200, 3],
    [Sword, 'Меч', 25, 500, 1], [Knife, 'Нож', 5, 300, 1],
    [Staff, 'Посох', 8, 300, 2], [LongBow, 'Длинный лук', 15, 200, 4],
    [Axe, 'Секира', 27, 800, 1], [StormStaff, 'Посох Бури', 10, 300, 3],
  ])('%s имеет характеристики из таблицы', (Type, name, attack, durability, range) => {
    expect(new Type()).toMatchObject({
      name,
      attack,
      durability,
      initDurability: durability,
      range
    });
  });

  test('улучшенное оружие наследует базовый тип', () => {
    expect(new LongBow()).toBeInstanceOf(Bow);
    expect(new Axe()).toBeInstanceOf(Sword);
    expect(new StormStaff()).toBeInstanceOf(Staff);
  });

  test('урон зависит от прочности, которая ограничена нулём', () => {
    const weapon = new Weapon('Тест', 20, 100, 2);
    weapon.takeDamage(70);
    expect(weapon.getDamage()).toBe(20);
    weapon.takeDamage(1);
    expect(weapon.getDamage()).toBe(10);
    expect(weapon.isBroken()).toBe(false);
    weapon.takeDamage(100);
    expect(weapon.durability).toBe(0);
    expect(weapon.getDamage()).toBe(0);
    expect(weapon.isBroken()).toBe(true);
    const arm = new Arm();
    arm.takeDamage(100);
    expect(arm.durability).toBe(Infinity);
    expect(arm.getDamage()).toBe(1);
  });
});

describe('Персонажи', () => {
  test.each([
    [Player, 100, 20, 1, 10, 5, 10, 'Игрок', Arm],
    [Warrior, 120, 20, 2, 10, 5, 10, 'Воин', Sword],
    [Archer, 80, 35, 1, 5, 10, 10, 'Лучник', Bow],
    [Mage, 70, 100, 1, 5, 8, 10, 'Маг', Staff],
    [Dwarf, 130, 20, 2, 15, 5, 20, 'Гном', Axe],
    [Crossbowman, 85, 35, 1, 8, 20, 15, 'Арбалетчик', LongBow],
    [Demiurge, 80, 120, 1, 6, 8, 12, 'Демиург', StormStaff],
  ])('%s получает характеристики и аргументы конструктора', (Type, life, magic, speed, attack, agility, luck, description, WeaponType) => {
    const player = new Type(7, 'Имя');
    expect(player).toMatchObject({
      life,
      magic,
      speed,
      attack,
      agility,
      luck,
      description,
      position: 7,
      name: 'Имя'
    });
    expect(player.weapon).toBeInstanceOf(WeaponType);
  });

  test('улучшенные персонажи наследуют соответствующий класс', () => {
    expect(new Dwarf(0, 'Гном')).toBeInstanceOf(Warrior);
    expect(new Crossbowman(0, 'Арбалетчик')).toBeInstanceOf(Archer);
    expect(new Demiurge(0, 'Демиург')).toBeInstanceOf(Mage);
  });

  test('удача использует непрерывное случайное число', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.23456);
    expect(new Player(0, 'Игрок').getLuck()).toBeCloseTo(0.33456);
  });

  test('базовый удар учитывает дальность и расстояние', () => {
    const player = new Player(0, 'Игрок');
    player.weapon = new Bow();
    jest.spyOn(player, 'getLuck').mockReturnValue(0.5);
    expect(player.getDamage(2)).toBeCloseTo(5);
    expect(player.getDamage(4)).toBe(0);
    player.takeDamage(200);
    expect(player.life).toBe(0);
    expect(player.isDead()).toBe(true);
  });

  test('лучник сильнее бьёт на дальней дистанции в пределах оружия', () => {
    const archer = new Archer(0, 'Лучник');
    jest.spyOn(archer, 'getLuck').mockReturnValue(0.6);
    expect(archer.getDamage(1)).toBeCloseTo(3);
    expect(archer.getDamage(3)).toBeCloseTo(9);
    expect(archer.getDamage(4)).toBe(0);
  });

  test('воин использует ману при здоровье ниже половины и достаточной удаче', () => {
    const warrior = new Warrior(0, 'Воин');
    jest.spyOn(warrior, 'getLuck').mockReturnValue(0.9);
    warrior.takeDamage(60);
    warrior.takeDamage(10); // ровно половина здоровья ещё не включает защиту
    expect(warrior.life).toBe(50);
    warrior.takeDamage(25);
    expect(warrior.magic).toBe(0);
    expect(warrior.life).toBe(45);
    warrior.takeDamage(5);
    expect(warrior.life).toBe(40);
  });

  test('воин без удачи получает урон здоровью', () => {
    const warrior = new Warrior(0, 'Воин');
    warrior.life = 50;
    jest.spyOn(warrior, 'getLuck').mockReturnValue(0.8);
    warrior.takeDamage(10);
    expect(warrior.life).toBe(40);
    expect(warrior.magic).toBe(20);
  });

  test('маг тратит ману и получает половину урона, пока маны больше половины', () => {
    const mage = new Mage(0, 'Маг');
    mage.takeDamage(20);
    expect(mage.life).toBe(60);
    expect(mage.magic).toBe(88);
    mage.magic = 50;
    mage.takeDamage(20);
    expect(mage.life).toBe(40);
    expect(mage.magic).toBe(50);
  });

  test('гном снижает каждый шестой полученный удар при удаче выше порога', () => {
    const dwarf = new Dwarf(0, 'Гном');
    jest.spyOn(dwarf, 'getLuck').mockReturnValue(0.6);
    for (let i = 0; i < 6; i += 1) {
      dwarf.takeDamage(10);
    }
    expect(dwarf.life).toBe(75);
    const unlucky = new Dwarf(0, 'Гном');
    jest.spyOn(unlucky, 'getLuck').mockReturnValue(0.5);
    for (let i = 0; i < 6; i += 1) {
      unlucky.takeDamage(10);
    }
    expect(unlucky.life).toBe(70);
  });

  test('демиург усиливает удар только при наличии маны и удаче выше порога', () => {
    const mage = new Demiurge(0, 'Демиург');
    const luck = jest.spyOn(mage, 'getLuck').mockReturnValue(0.7);
    expect(mage.getDamage(1)).toBeCloseTo(16 * 0.7 * 1.5);
    luck.mockReturnValue(0.6);
    expect(mage.getDamage(1)).toBeCloseTo(16 * 0.6);
    mage.magic = 0;
    luck.mockReturnValue(0.7);
    expect(mage.getDamage(1)).toBeCloseTo(16 * 0.7);
  });
});

describe('Движение и бой', () => {
  test('движение ограничено скоростью и учитывает направление', () => {
    const warrior = new Warrior(6, 'Воин');
    warrior.moveLeft(5);
    expect(warrior.position).toBe(4);
    warrior.moveRight(1);
    expect(warrior.position).toBe(5);
    warrior.move(-5);
    expect(warrior.position).toBe(3);
    warrior.move(5);
    expect(warrior.position).toBe(5);
  });

  test('порог блока и уклонения строгий', () => {
    const player = new Player(0, 'Игрок');
    const luck = jest.spyOn(player, 'getLuck').mockReturnValue(0.9);
    expect(player.isAttackBlocked()).toBe(false);
    luck.mockReturnValue(0.91);
    expect(player.isAttackBlocked()).toBe(true);
    luck.mockReturnValue(0.92);
    expect(player.dodged()).toBe(false);
    luck.mockReturnValue(0.93);
    expect(player.dodged()).toBe(true);
  });

  test('блок изнашивает оружие; уклонение и обычное попадание различаются', () => {
    const player = new Warrior(0, 'Воин');
    const block = jest.spyOn(player, 'isAttackBlocked').mockReturnValue(true);
    const dodge = jest.spyOn(player, 'dodged').mockReturnValue(true);
    player.takeAttack(20);
    expect(player.weapon.durability).toBe(480);
    expect(player.life).toBe(120);
    expect(dodge).not.toHaveBeenCalled();
    block.mockReturnValue(false);
    player.takeAttack(20);
    expect(player.life).toBe(120);
    dodge.mockReturnValue(false);
    player.takeAttack(20);
    expect(player.life).toBe(100);
  });

  test.each([Warrior, Archer, Mage, Dwarf, Crossbowman, Demiurge])('%s меняет сломанное оружие на нож и руку', (Type) => {
    const player = new Type(0, 'Игрок');
    player.weapon.takeDamage(Infinity);
    player.checkWeapon();
    expect(player.weapon).toBeInstanceOf(Knife);
    player.weapon.takeDamage(Infinity);
    player.checkWeapon();
    expect(player.weapon).toBeInstanceOf(Arm);
    player.checkWeapon();
    expect(player.weapon).toBeInstanceOf(Arm);
  });

  test('недосягаемый удар не изнашивает оружие', () => {
    const attacker = new Warrior(0, 'Воин');
    const enemy = new Player(3, 'Враг');
    const hit = jest.spyOn(enemy, 'takeAttack');
    attacker.tryAttack(enemy);
    expect(attacker.weapon.durability).toBe(500);
    expect(hit).not.toHaveBeenCalled();
  });

  test('износ происходит до расчёта удара; совпадение позиций отбрасывает и удваивает урон', () => {
    const attacker = new Warrior(0, 'Воин');
    const enemy = new Player(0, 'Враг');
    attacker.weapon.durability = 151;
    jest.spyOn(attacker, 'getLuck').mockReturnValue(1);
    const hit = jest.spyOn(enemy, 'takeAttack').mockImplementation(() => {});
    attacker.tryAttack(enemy);
    expect(attacker.weapon.durability).toBe(141);
    expect(enemy.position).toBe(1);
    expect(hit).toHaveBeenCalledTimes(1);
    expect(hit).toHaveBeenCalledWith(45);
  });

  test('выбор слабейшего живого противника и движение к нему', () => {
    const player = new Warrior(0, 'Воин');
    const healthy = new Player(-5, 'Здоровый');
    const weak = new Player(5, 'Слабый');
    const dead = new Player(1, 'Мёртвый');
    weak.life = 10;
    dead.life = 0;
    expect(player.chooseEnemy([player, healthy, weak, dead])).toBe(weak);
    player.moveToEnemy(weak);
    expect(player.position).toBe(2);
    player.moveToEnemy(healthy);
    expect(player.position).toBe(0);
  });

  test('ход выбирает противника, движется и атакует в этом порядке', () => {
    const player = new Warrior(0, 'Воин');
    const enemy = new Player(3, 'Враг');
    const choose = jest.spyOn(player, 'chooseEnemy');
    const move = jest.spyOn(player, 'moveToEnemy');
    const attack = jest.spyOn(player, 'tryAttack');
    jest.spyOn(enemy, 'isAttackBlocked').mockReturnValue(false);
    jest.spyOn(enemy, 'dodged').mockReturnValue(false);
    jest.spyOn(player, 'getLuck').mockReturnValue(0.5);
    const log = jest.fn();
    player.turn([player, enemy], log);
    expect(choose).toHaveBeenCalledWith([player, enemy]);
    expect(move).toHaveBeenCalledWith(enemy);
    expect(attack).toHaveBeenCalledWith(enemy, log);
    expect(choose.mock.invocationCallOrder[0]).toBeLessThan(move.mock.invocationCallOrder[0]);
    expect(move.mock.invocationCallOrder[0]).toBeLessThan(attack.mock.invocationCallOrder[0]);
    expect(enemy.life).toBeLessThan(100);
  });

  test('игра пропускает погибших и возвращает победителя', () => {
    const winner = new Warrior(0, 'Победитель');
    const loser = new Player(1, 'Проигравший');
    const dead = new Player(2, 'Мёртвый');
    loser.life = 1;
    dead.life = 0;
    jest.spyOn(winner, 'getLuck').mockReturnValue(1);
    jest.spyOn(loser, 'isAttackBlocked').mockReturnValue(false);
    jest.spyOn(loser, 'dodged').mockReturnValue(false);
    const deadTurn = jest.spyOn(dead, 'turn');
    expect(play([winner, loser, dead], { log: () => {}, maxRounds: 10 })).toBe(winner);
    expect(deadTurn).not.toHaveBeenCalled();
  });

  test('обычный бой доходит до победы даже на большой начальной дистанции', () => {
    const attacker = new Player(0, 'А');
    const defender = new Player(5000, 'Б');
    defender.life = 1;
    jest.spyOn(Math, 'random').mockReturnValue(0.4);
    expect(play([attacker, defender], { log: () => {} })).toBe(attacker);
    expect(defender.isDead()).toBe(true);
  });

  test('ограничение числа раундов завершает ничью', () => {
    const first = new Player(0, 'А');
    const second = new Player(100, 'Б');
    expect(play([first, second], { log: () => {}, maxRounds: 1 })).toBeNull();
  });
});
